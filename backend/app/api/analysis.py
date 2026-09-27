import logging
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.database.models import Case, Transaction, AddressLabel, RiskFinding, User, FindingSeverity
from app.api.auth import get_current_user
from app.graph.graph_builder import GraphBuilder
from app.graph.path_analysis import PathAnalyzer
from app.risk.rules import SuspiciousPatternEngine
from app.risk.priority import InvestigationPriorityEngine
from app.risk.explainability import RiskExplainability

logger = logging.getLogger("api.analysis")
router = APIRouter(prefix="/analysis", tags=["Graph & Trail Analysis"])

def get_case_extended_transactions(db: Session, case_id: str, suspect_wallet: Optional[str] = None, max_hops: int = 5) -> List[Transaction]:
    all_tx_ids = set()
    result_txs = []
    visited_addresses = set()
    current_frontier = set()

    if suspect_wallet:
        root = suspect_wallet.lower().strip()
        visited_addresses.add(root)
        current_frontier.add(root)

    # 1. Transactions directly assigned to this case
    case_txs = db.query(Transaction).filter(Transaction.case_id == case_id).all()
    for tx in case_txs:
        if tx.id not in all_tx_ids:
            all_tx_ids.add(tx.id)
            result_txs.append(tx)
            if tx.to_address:
                visited_addresses.add(tx.to_address.lower())
            if tx.from_address:
                visited_addresses.add(tx.from_address.lower())

    # If no transactions exist for suspect_wallet yet, auto-sync from Sepolia via explorer and live RPC indexer
    if not result_txs and suspect_wallet:
        try:
            from app.services.transaction_service import TransactionService
            logger.info(f"Auto-syncing real on-chain transactions for {suspect_wallet}...")
            TransactionService.sync_wallet_transactions(db, suspect_wallet, case_id=case_id)
            synced_txs = db.query(Transaction).filter(
                (Transaction.case_id == case_id) |
                (Transaction.from_address.ilike(suspect_wallet)) |
                (Transaction.to_address.ilike(suspect_wallet))
            ).all()

            # If TransactionService found nothing, invoke the AsyncEVMIndexer for live on-chain BFS indexing
            if not synced_txs:
                try:
                    from app.blockchain.live_indexer import AsyncEVMIndexer
                    logger.info(f"Invoking AsyncEVMIndexer for live block/crawler lookup on {suspect_wallet}...")
                    indexer = AsyncEVMIndexer()
                    indexer.sync_wallet_live_to_db(db, suspect_wallet, case_id=case_id, max_depth=2)
                    synced_txs = db.query(Transaction).filter(
                        (Transaction.case_id == case_id) |
                        (Transaction.from_address.ilike(suspect_wallet)) |
                        (Transaction.to_address.ilike(suspect_wallet))
                    ).all()
                except Exception as live_err:
                    logger.warning(f"AsyncEVMIndexer lookup failed: {live_err}")

            for tx in synced_txs:
                if tx.id not in all_tx_ids:
                    all_tx_ids.add(tx.id)
                    result_txs.append(tx)
                    if tx.to_address:
                        visited_addresses.add(tx.to_address.lower())
                    if tx.from_address:
                        visited_addresses.add(tx.from_address.lower())
        except Exception as e:
            logger.warning(f"Auto-sync for {suspect_wallet} failed: {e}")

    if not suspect_wallet:
        return result_txs

    expanded_addresses = set()
    current_frontier = {suspect_wallet.lower().strip()}

    # Include destinations of case_txs in frontier
    for tx in case_txs:
        if tx.to_address:
            current_frontier.add(tx.to_address.lower())

    # 2. Multi-hop forward expansion from suspect wallet
    for _ in range(max_hops):
        to_expand = current_frontier - expanded_addresses
        if not to_expand:
            break
        expanded_addresses.update(to_expand)

        # For newly discovered frontier addresses, if not yet cached, attempt auto-sync from Sepolia
        for addr in list(to_expand):
            has_outgoing = db.query(Transaction).filter(Transaction.from_address.ilike(addr)).first()
            if not has_outgoing:
                try:
                    from app.services.transaction_service import TransactionService
                    TransactionService.sync_wallet_transactions(db, addr, case_id=case_id)
                except Exception:
                    pass

        outgoing = db.query(Transaction).filter(
            Transaction.from_address.in_(list(to_expand))
        ).all()

        next_frontier = set()
        for tx in outgoing:
            if tx.id not in all_tx_ids:
                all_tx_ids.add(tx.id)
                result_txs.append(tx)
            if tx.to_address:
                to_lower = tx.to_address.lower()
                if to_lower not in expanded_addresses:
                    next_frontier.add(to_lower)
        current_frontier = next_frontier

    # 3. Direct incoming transactions to suspect wallet
    incoming = db.query(Transaction).filter(
        Transaction.to_address.ilike(suspect_wallet)
    ).all()
    for tx in incoming:
        if tx.id not in all_tx_ids:
            all_tx_ids.add(tx.id)
            result_txs.append(tx)

    return result_txs

@router.get("/graph/{case_id}")
def get_case_graph(
    case_id: str,
    hops: int = Query(default=3, ge=1, le=5),
    suspicious_only: bool = Query(default=False),
    anti_dust: bool = Query(default=True, description="Enable mathematical anti-dusting pruning to suppress adversarial micro-tx noise"),
    dust_threshold: float = Query(default=0.02, ge=0.0, le=0.5, description="Relative outflow threshold below which transactions are pruned as dust"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(Case).filter(Case.case_id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    transactions = get_case_extended_transactions(db, case_id, case.suspect_wallet, max_hops=hops)
    labels_map = {lbl.address.lower(): lbl for lbl in db.query(AddressLabel).all()}

    # Gather suspicious transaction hashes
    findings = db.query(RiskFinding).filter(
        (RiskFinding.case_id == case_id) |
        (RiskFinding.wallet_address.ilike(case.suspect_wallet if case.suspect_wallet else ""))
    ).all()
    suspicious_txs = set()
    for f in findings:
        if f.evidence_txs:
            for h in f.evidence_txs:
                suspicious_txs.add(h)

    gb = GraphBuilder()
    gb.populate_from_transactions(transactions, labels_map)
    graph = gb.get_graph()

    pa = PathAnalyzer(graph)
    subgraph = pa.get_k_hop_subgraph(
        source=case.suspect_wallet,
        max_hops=hops,
        suspicious_only=suspicious_only,
        suspicious_tx_hashes=suspicious_txs,
        anti_dust=anti_dust,
        dust_threshold=dust_threshold
    )

    return subgraph

@router.get("/trail/{case_id}")
def get_money_trail(
    case_id: str,
    max_hops: int = Query(default=5, ge=1, le=5),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(Case).filter(Case.case_id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    transactions = get_case_extended_transactions(db, case_id, case.suspect_wallet, max_hops=max_hops)
    labels_map = {lbl.address.lower(): lbl for lbl in db.query(AddressLabel).all()}

    gb = GraphBuilder()
    gb.populate_from_transactions(transactions, labels_map)
    graph = gb.get_graph()

    pa = PathAnalyzer(graph)
    vasp_paths = pa.trace_paths_to_vasp(case.suspect_wallet, max_hops=max_hops)

    has_known_vasp = any("VASP" in p.get("destination_vasp", "") or "Exchange" in p.get("destination_vasp", "") or "Binance" in p.get("destination_vasp", "") for p in vasp_paths)

    if vasp_paths:
        if has_known_vasp:
            status_msg = f"Discovered {len(vasp_paths)} verified liquidation route(s) terminating at recognized VASP."
        else:
            status_msg = f"Discovered {len(vasp_paths)} forward liquidation trail(s) terminating at active destination sink wallet(s)."
    else:
        status_msg = "No verified liquidation path was found in the currently indexed data."

    return {
        "case_id": case_id,
        "victim_name": case.victim_name,
        "suspect_wallet": case.suspect_wallet,
        "amount_lost": case.amount_lost,
        "currency": case.currency,
        "paths_to_vasp": vasp_paths,
        "verified_paths_count": len(vasp_paths),
        "status_message": status_msg
    }

@router.get("/patterns/{case_id}")
def get_detected_patterns(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(Case).filter(Case.case_id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    wallet = case.suspect_wallet or ""
    findings = db.query(RiskFinding).filter(
        (RiskFinding.case_id == case_id) |
        (RiskFinding.wallet_address.ilike(wallet if wallet else ""))
    ).all()

    # If no findings in DB, dynamically evaluate patterns against case transactions
    if not findings and wallet:
        try:
            txs = get_case_extended_transactions(db, case_id, wallet, max_hops=4)
            if txs:
                labels_map = {lbl.address.lower(): lbl for lbl in db.query(AddressLabel).all()}
                gb = GraphBuilder()
                gb.populate_from_transactions(txs, labels_map)
                pa = PathAnalyzer(gb.get_graph())
                cycles = pa.find_cycles(wallet)

                # 1. Base suspicious patterns (mixers, peeling)
                evaluated = SuspiciousPatternEngine.evaluate_patterns(
                    wallet_address=wallet,
                    transactions=txs,
                    labels_map=labels_map,
                    max_hop_depth=min(4, max(1, len(txs))),
                    cycles_detected=cycles
                )
                
                # 2. Advanced Crime Profiling (Ransomware, Scams, Phishing)
                from app.utils.crime_profiler import CrimeProfiler
                crime_profile = CrimeProfiler.analyze_topology(txs, wallet)
                
                if crime_profile["confidence"] in ["MEDIUM", "HIGH", "CRITICAL"]:
                    # Map severity
                    conf_map = {"MEDIUM": FindingSeverity.MEDIUM, "HIGH": FindingSeverity.HIGH, "CRITICAL": FindingSeverity.CRITICAL}
                    
                    evaluated.append({
                        "finding_type": f"CRIME_TOPOLOGY: {crime_profile['crime_type']}",
                        "severity": conf_map.get(crime_profile["confidence"], FindingSeverity.MEDIUM),
                        "score_delta": float(crime_profile.get("risk_score", 50.0)),
                        "evidence_txs": [],  # High-level topology finding
                        "explanation": crime_profile["reason"]
                    })

                for item in evaluated:
                    sev_str = item.get("severity")
                    if isinstance(sev_str, FindingSeverity):
                        sev_enum = sev_str
                    else:
                        try:
                            sev_enum = FindingSeverity(str(sev_str).upper())
                        except Exception:
                            sev_enum = FindingSeverity.MEDIUM

                    rf = RiskFinding(
                        case_id=case_id,
                        wallet_address=wallet,
                        finding_type=item.get("finding_type", "SUSPICIOUS_ACTIVITY"),
                        severity=sev_enum,
                        score_delta=float(item.get("score_delta", 15.0)),
                        evidence_txs=item.get("evidence_txs", []),
                        explanation=item.get("explanation", "")
                    )
                    db.add(rf)
                db.commit()
                db.commit()
                findings = db.query(RiskFinding).filter(RiskFinding.case_id == case_id).all()
        except Exception as e:
            logger.error(f"Error evaluating patterns dynamically for case {case_id}: {e}")
            db.rollback()

    findings_dicts = [
        {
            "finding_type": f.finding_type,
            "severity": f.severity.value if hasattr(f.severity, "value") else str(f.severity),
            "score_delta": f.score_delta,
            "explanation": f.explanation,
            "evidence_txs": f.evidence_txs or []
        }
        for f in findings
    ]
    risk_summary = RiskExplainability.compute_risk_score(findings_dicts)
    return {
        "case_id": case_id,
        "risk_assessment": risk_summary,
        "findings": [
            {
                "id": f.id,
                "finding_type": f.finding_type,
                "severity": f.severity.value if hasattr(f.severity, "value") else str(f.severity),
                "score_delta": f.score_delta,
                "explanation": f.explanation,
                "evidence_txs": f.evidence_txs or [],
                "created_at": str(f.created_at) if f.created_at else None
            }
            for f in findings
        ]
    }

@router.get("/bridges/{case_id}")
def get_case_cross_chain_bridges(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Detects cross-chain bridge movements (e.g. Ethereum -> Bitcoin / Solana / Tron)
    for a case using deterministic time/value slippage heuristics.
    """
    case = db.query(Case).filter(Case.case_id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    from app.blockchain.cross_chain import analyze_cross_chain_hops
    txs = get_case_extended_transactions(db, case_id, case.suspect_wallet, max_hops=4)

    # Convert DB Transaction objects to dictionary representation
    tx_dicts = []
    for t in txs:
        tx_dicts.append({
            "tx_hash": t.tx_hash,
            "blockchain": t.blockchain or "Ethereum",
            "from_address": t.from_address,
            "to_address": t.to_address,
            "value_eth": t.value_eth,
            "block_timestamp": t.block_timestamp
        })

    detected_hops = analyze_cross_chain_hops(tx_dicts)
    return {
        "case_id": case_id,
        "total_analyzed_transactions": len(tx_dicts),
        "bridge_hops_count": len(detected_hops),
        "detected_hops": detected_hops
    }

from pydantic import BaseModel
class CrossChainMatchRequest(BaseModel):
    deposit_tx: Dict[str, Any]
    candidate_withdrawals: List[Dict[str, Any]]
    time_window_minutes: Optional[int] = 15
    max_slippage_pct: Optional[float] = 0.05

@router.post("/cross-chain/match")
def match_cross_chain_transfer(
    req: CrossChainMatchRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Direct heuristic matching of a deposit transaction against candidate withdrawal transactions
    across disparate blockchains.
    """
    from app.blockchain.cross_chain import CrossChainAnalyzer
    analyzer = CrossChainAnalyzer(
        time_window_minutes=req.time_window_minutes or 15,
        max_value_slippage_pct=req.max_slippage_pct or 0.05
    )
    result = analyzer.detect_bridge_hop(req.deposit_tx, req.candidate_withdrawals)
    return {
        "matched": result is not None,
        "result": result
    }

@router.get("/case/{case_id}/evasion-countermeasures")
def get_case_evasion_countermeasures(
    case_id: str,
    anti_dust: bool = Query(default=True),
    dust_threshold: float = Query(default=0.02),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Advanced Evasion Countermeasures Engine (Red Team vs Blue Team):
    1. Anti-Dusting Pruner (Neutralizes graph cluttering micro-transactions)
    2. Mixer Correlation Engine (Breaks Tornado Cash zero-knowledge unlinking via volume & time slippage)
    3. Cross-Chain Bridge Correlator (Links disparate chains across bridge protocols)
    """
    case = db.query(Case).filter(Case.case_id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    transactions = get_case_extended_transactions(db, case_id, case.suspect_wallet, max_hops=1)
    labels_map = {lbl.address.lower(): lbl for lbl in db.query(AddressLabel).all()}

    # 1. Anti-Dusting Analysis
    gb = GraphBuilder()
    gb.populate_from_transactions(transactions, labels_map)
    graph = gb.get_graph()
    pa = PathAnalyzer(graph)
    subgraph = pa.get_k_hop_subgraph(
        source=case.suspect_wallet,
        max_hops=1,
        anti_dust=anti_dust,
        dust_threshold=dust_threshold
    )
    dust_metrics = subgraph.get("dust_metrics", {})

    # 2. Mixer Correlation Analysis (Defeating Tornado Cash)
    from app.utils.crime_profiler import MixerCorrelationEngine
    mixer_analysis = MixerCorrelationEngine.correlate_mixer_transactions(
        transactions=transactions,
        target_wallet=case.suspect_wallet or "",
        time_window_hours=24
    )

    # 3. Cross-Chain Bridge Correlator
    from app.blockchain.cross_chain import analyze_cross_chain_hops
    tx_dicts = []
    for t in transactions:
        tx_dicts.append({
            "tx_hash": getattr(t, "transaction_hash", None) or getattr(t, "tx_hash", "") or "",
            "blockchain": getattr(t, "blockchain", "Ethereum") or "Ethereum",
            "from_address": getattr(t, "from_address", "") or "",
            "to_address": getattr(t, "to_address", "") or "",
            "value_eth": getattr(t, "value_eth", getattr(t, "amount_native", 0.0)) or 0.0,
            "block_timestamp": getattr(t, "timestamp", None) or getattr(t, "block_timestamp", None)
        })
    detected_bridge_hops = analyze_cross_chain_hops(tx_dicts)

    return {
        "case_id": case_id,
        "suspect_wallet": case.suspect_wallet,
        "dust_countermeasures": dust_metrics,
        "mixer_countermeasures": mixer_analysis,
        "cross_chain_countermeasures": {
            "bridge_hops_count": len(detected_bridge_hops),
            "detected_hops": detected_bridge_hops
        },
        "engine_version": "RED_BLUE_DEFENSE_V2.1",
        "status": "ACTIVE_DEFENSE_ENGAGED"
    }

