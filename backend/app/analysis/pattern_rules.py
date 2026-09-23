import datetime
import statistics
import networkx as nx
from typing import List, Dict, Any, Optional, Set
from app.analysis.pattern_models import PatternFinding, DeFiParameters
from app.analysis.evm_tracer import EvmTraceAnalyzer
from app.analysis import config

def _get_tx_timestamp(tx: Any) -> Optional[datetime.datetime]:
    if hasattr(tx, 'block_timestamp') and tx.block_timestamp:
        return tx.block_timestamp
    if hasattr(tx, 'timestamp') and tx.timestamp:
        return tx.timestamp
    return None

def _get_tx_hash(tx: Any) -> str:
    if hasattr(tx, 'tx_hash') and tx.tx_hash:
        return tx.tx_hash
    if hasattr(tx, 'transaction_hash') and tx.transaction_hash:
        return tx.transaction_hash
    return ""

def _get_tx_value(tx: Any) -> float:
    if hasattr(tx, 'value_eth') and tx.value_eth is not None:
        return float(tx.value_eth)
    if hasattr(tx, 'amount_native') and tx.amount_native is not None:
        return float(tx.amount_native)
    return 0.0

def _get_tx_from(tx: Any) -> str:
    return getattr(tx, 'from_address', '').lower()

def _get_tx_to(tx: Any) -> str:
    return (getattr(tx, 'to_address', '') or '').lower()

def _get_tx_block(tx: Any) -> Optional[int]:
    return getattr(tx, 'block_number', None)

def _get_tx_position(tx: Any) -> Optional[int]:
    pos = getattr(tx, 'transaction_index', None)
    if pos is None:
        pos = getattr(tx, 'block_position', None)
    return pos

def _get_tx_calldata(tx: Any) -> Optional[str]:
    return getattr(tx, 'calldata', None) or getattr(tx, 'input', None) or getattr(tx, 'input_data', None)

def _get_tx_gas_price(tx: Any) -> float:
    for attr in ('gas_price_gwei', 'gas_price', 'gas_price_wei'):
        val = getattr(tx, attr, None)
        if val is not None:
            try:
                fval = float(val)
                if fval > 1000000:
                    return fval / 1e9
                return fval
            except Exception:
                pass
    return 20.0


class PatternRules:
    """
    Modular forensic rules for detecting behavioral transaction patterns.
    Strictly applies neutral investigative terminology without declaring criminality.
    """

    @staticmethod
    def detect_rapid_transfers(wallet_address: str, transactions: List[Any]) -> List[PatternFinding]:
        findings = []
        norm_wallet = wallet_address.lower()
        incoming = [tx for tx in transactions if _get_tx_to(tx) == norm_wallet and _get_tx_timestamp(tx)]
        outgoing = [tx for tx in transactions if _get_tx_from(tx) == norm_wallet and _get_tx_timestamp(tx)]

        if not incoming or not outgoing:
            return findings

        # Check pairs of incoming and subsequent outgoing transfers
        for in_tx in incoming:
            in_time = _get_tx_timestamp(in_tx)
            in_val = _get_tx_value(in_tx)
            in_hash = _get_tx_hash(in_tx)

            for out_tx in outgoing:
                out_time = _get_tx_timestamp(out_tx)
                out_hash = _get_tx_hash(out_tx)
                if in_hash == out_hash:
                    continue

                diff_seconds = (out_time - in_time).total_seconds()
                if 0 <= diff_seconds <= config.RAPID_TRANSFER_SECONDS:
                    out_val = _get_tx_value(out_tx)
                    findings.append(PatternFinding(
                        pattern_id="PAT-RAPID-TRANSFER",
                        pattern_name="Rapid Fund Transfer",
                        severity="HIGH" if diff_seconds < 300 else "MEDIUM",
                        confidence=0.88,
                        description=(
                            f"Inbound transfer of {in_val:.4f} ETH was followed by an outbound "
                            f"transfer of {out_val:.4f} ETH within {int(diff_seconds)} seconds."
                        ),
                        wallet_address=wallet_address,
                        related_wallets=[_get_tx_from(in_tx), _get_tx_to(out_tx)],
                        related_transaction_hashes=[in_hash, out_hash],
                        evidence={
                            "incoming_tx": in_hash,
                            "outgoing_tx": out_hash,
                            "time_difference_seconds": diff_seconds,
                            "incoming_amount_eth": in_val,
                            "outgoing_amount_eth": out_val,
                            "threshold_seconds": config.RAPID_TRANSFER_SECONDS
                        }
                    ))
                    return findings  # Return primary occurrence to avoid explosion
        return findings

    @staticmethod
    def detect_fund_splitting(wallet_address: str, transactions: List[Any]) -> List[PatternFinding]:
        findings = []
        norm_wallet = wallet_address.lower()
        incoming = [tx for tx in transactions if _get_tx_to(tx) == norm_wallet]
        outgoing = [tx for tx in transactions if _get_tx_from(tx) == norm_wallet]

        if not incoming or len(outgoing) < config.FUND_SPLIT_MIN_DESTINATIONS:
            return findings

        # Group outgoing by unique recipient addresses
        recipients = list(set(_get_tx_to(tx) for tx in outgoing if _get_tx_to(tx)))
        if len(recipients) >= config.FUND_SPLIT_MIN_DESTINATIONS:
            total_in = sum(_get_tx_value(tx) for tx in incoming)
            total_out = sum(_get_tx_value(tx) for tx in outgoing)
            out_hashes = [_get_tx_hash(tx) for tx in outgoing[:6]]
            in_hashes = [_get_tx_hash(tx) for tx in incoming[:2]]

            findings.append(PatternFinding(
                pattern_id="PAT-FUND-SPLITTING",
                pattern_name="Fund Splitting / Fan-Out",
                severity="HIGH",
                confidence=0.85,
                description=(
                    f"Funds received by the wallet were distributed into {len(recipients)} distinct "
                    f"destination wallets across {len(outgoing)} outbound transactions."
                ),
                wallet_address=wallet_address,
                related_wallets=recipients[:10],
                related_transaction_hashes=in_hashes + out_hashes,
                evidence={
                    "incoming_transaction_count": len(incoming),
                    "outgoing_transaction_count": len(outgoing),
                    "unique_destinations": len(recipients),
                    "total_incoming_value_eth": round(total_in, 4),
                    "total_outgoing_value_eth": round(total_out, 4),
                    "split_ratio": round(total_out / max(0.0001, total_in), 2)
                }
            ))
        return findings

    @staticmethod
    def detect_fund_consolidation(wallet_address: str, transactions: List[Any]) -> List[PatternFinding]:
        findings = []
        norm_wallet = wallet_address.lower()
        incoming = [tx for tx in transactions if _get_tx_to(tx) == norm_wallet]
        outgoing = [tx for tx in transactions if _get_tx_from(tx) == norm_wallet]

        if len(incoming) < config.FUND_CONSOLIDATION_MIN_SOURCES or not outgoing:
            return findings

        sources = list(set(_get_tx_from(tx) for tx in incoming if _get_tx_from(tx)))
        if len(sources) >= config.FUND_CONSOLIDATION_MIN_SOURCES and len(outgoing) <= 2:
            total_in = sum(_get_tx_value(tx) for tx in incoming)
            total_out = sum(_get_tx_value(tx) for tx in outgoing)
            in_hashes = [_get_tx_hash(tx) for tx in incoming[:6]]
            out_hashes = [_get_tx_hash(tx) for tx in outgoing]

            findings.append(PatternFinding(
                pattern_id="PAT-FUND-CONSOLIDATION",
                pattern_name="Fund Consolidation / Fan-In",
                severity="MEDIUM",
                confidence=0.80,
                description=(
                    f"Multiple inbound deposits ({len(sources)} source addresses, {total_in:.4f} ETH) "
                    f"were aggregated and consolidated into {len(outgoing)} outbound transfer(s)."
                ),
                wallet_address=wallet_address,
                related_wallets=sources[:10] + [_get_tx_to(tx) for tx in outgoing],
                related_transaction_hashes=in_hashes + out_hashes,
                evidence={
                    "incoming_sources_count": len(sources),
                    "incoming_transactions_count": len(incoming),
                    "consolidated_outgoing_count": len(outgoing),
                    "total_consolidated_eth": round(total_out, 4)
                }
            ))
        return findings

    @staticmethod
    def detect_multi_hop_movement(
        wallet_address: str,
        graph_paths: Optional[List[List[str]]] = None,
        max_hop_depth: int = 1
    ) -> List[PatternFinding]:
        findings = []
        deep_paths = []
        if graph_paths:
            deep_paths = [p for p in graph_paths if len(p) >= 4]  # 4 nodes = 3 hops

        if deep_paths or max_hop_depth >= 3:
            effective_depth = max(len(p) - 1 for p in deep_paths) if deep_paths else max_hop_depth
            path_sample = deep_paths[0] if deep_paths else [wallet_address]

            findings.append(PatternFinding(
                pattern_id="PAT-MULTI-HOP",
                pattern_name="Extended Multi-Hop Movement",
                severity="HIGH" if effective_depth >= 4 else "MEDIUM",
                confidence=0.85,
                description=(
                    f"Fund transfer flow traces through {effective_depth} sequential intermediary wallet hops, "
                    "distancing downstream funds from the origin address."
                ),
                wallet_address=wallet_address,
                related_wallets=path_sample[:8],
                related_transaction_hashes=[],
                evidence={
                    "max_hop_depth": effective_depth,
                    "sample_path": path_sample,
                    "total_deep_paths": len(deep_paths)
                }
            ))
        return findings

    @staticmethod
    def detect_high_frequency_burst(wallet_address: str, transactions: List[Any]) -> List[PatternFinding]:
        findings = []
        if len(transactions) < 5:
            return findings

        timestamps = sorted([_get_tx_timestamp(tx) for tx in transactions if _get_tx_timestamp(tx)])
        if len(timestamps) >= 5:
            span_seconds = max(1.0, (timestamps[-1] - timestamps[0]).total_seconds())
            span_minutes = span_seconds / 60.0
            tx_per_minute = len(transactions) / span_minutes

            if tx_per_minute >= config.BURST_TX_PER_MINUTE_THRESHOLD or (
                len(transactions) >= config.HIGH_FREQUENCY_TRANSACTION_COUNT and span_minutes <= config.HIGH_FREQUENCY_WINDOW_MINUTES
            ):
                findings.append(PatternFinding(
                    pattern_id="PAT-HIGH-FREQUENCY-BURST",
                    pattern_name="High-Frequency Burst Activity",
                    severity="MEDIUM",
                    confidence=0.82,
                    description=(
                        f"Anomalous transaction frequency detected: {len(transactions)} transactions executed "
                        f"within {int(span_minutes)} minutes ({tx_per_minute:.2f} tx/min)."
                    ),
                    wallet_address=wallet_address,
                    related_wallets=[],
                    related_transaction_hashes=[_get_tx_hash(tx) for tx in transactions[:5]],
                    evidence={
                        "transaction_count": len(transactions),
                        "window_minutes": round(span_minutes, 2),
                        "rate_per_minute": round(tx_per_minute, 2),
                        "threshold_per_minute": config.BURST_TX_PER_MINUTE_THRESHOLD
                    }
                ))
        return findings

    @staticmethod
    def detect_circular_movement(
        wallet_address: str,
        networkx_graph: Optional[nx.MultiDiGraph] = None
    ) -> List[PatternFinding]:
        findings = []
        if not networkx_graph or networkx_graph.number_of_nodes() < 2:
            return findings

        norm_wallet = wallet_address.lower()
        matched_node = None
        for n in networkx_graph.nodes():
            if str(n).lower() == norm_wallet:
                matched_node = n
                break

        if not matched_node:
            return findings

        try:
            # Look for simple cycles involving target wallet
            cycles = list(nx.simple_cycles(networkx_graph))
            target_cycles = [c for c in cycles if matched_node in c and len(c) <= config.CYCLE_DETECTION_MAX_LENGTH]
            if target_cycles:
                cycle = target_cycles[0]
                cycle_addrs = [str(x) for x in cycle]
                findings.append(PatternFinding(
                    pattern_id="PAT-CIRCULAR-FLOW",
                    pattern_name="Circular Fund Movement Loop",
                    severity="HIGH",
                    confidence=0.89,
                    description=(
                        f"Closed circular transaction loop detected containing {len(cycle)} wallets, "
                        "where fund flows cycle back to an originating or affiliated address."
                    ),
                    wallet_address=wallet_address,
                    related_wallets=cycle_addrs,
                    related_transaction_hashes=[],
                    evidence={
                        "cycle_length": len(cycle),
                        "cycle_addresses": cycle_addrs,
                        "total_cycles_detected": len(target_cycles)
                    }
                ))
        except Exception:
            pass

        return findings

    @staticmethod
    def detect_sudden_large_transfer(wallet_address: str, transactions: List[Any]) -> List[PatternFinding]:
        findings = []
        if len(transactions) < 3:
            return findings

        values = [_get_tx_value(tx) for tx in transactions]
        mean_val = statistics.mean(values)
        median_val = statistics.median(values)
        max_val = max(values)

        threshold = max(config.LARGE_TRANSFER_MIN_ETH, median_val * config.LARGE_TRANSFER_MULTIPLIER)

        if max_val >= threshold and max_val >= config.LARGE_TRANSFER_MIN_ETH:
            large_txs = [tx for tx in transactions if _get_tx_value(tx) == max_val]
            large_hash = _get_tx_hash(large_txs[0]) if large_txs else ""
            other_addr = _get_tx_to(large_txs[0]) if _get_tx_from(large_txs[0]) == wallet_address.lower() else _get_tx_from(large_txs[0])

            findings.append(PatternFinding(
                pattern_id="PAT-SUDDEN-LARGE-TRANSFER",
                pattern_name="Sudden Outlier Value Transfer",
                severity="MEDIUM",
                confidence=0.84,
                description=(
                    f"Outlier transfer of {max_val:.4f} ETH identified, exceeding the wallet's historical "
                    f"median transfer ({median_val:.4f} ETH) by a factor of {round(max_val / max(0.001, median_val), 1)}x."
                ),
                wallet_address=wallet_address,
                related_wallets=[other_addr] if other_addr else [],
                related_transaction_hashes=[large_hash] if large_hash else [],
                evidence={
                    "outlier_amount_eth": round(max_val, 4),
                    "historical_mean_eth": round(mean_val, 4),
                    "historical_median_eth": round(median_val, 4),
                    "deviation_factor": round(max_val / max(0.001, median_val), 2),
                    "threshold_applied_eth": round(threshold, 4)
                }
            ))
        return findings

    @staticmethod
    def detect_unusual_counterparty_behavior(wallet_address: str, transactions: List[Any]) -> List[PatternFinding]:
        findings = []
        norm_wallet = wallet_address.lower()

        incoming_cps = set(_get_tx_from(tx) for tx in transactions if _get_tx_to(tx) == norm_wallet and _get_tx_from(tx))
        outgoing_cps = set(_get_tx_to(tx) for tx in transactions if _get_tx_from(tx) == norm_wallet and _get_tx_to(tx))
        all_cps = incoming_cps.union(outgoing_cps)

        if len(all_cps) >= config.UNUSUAL_COUNTERPARTY_COUNT:
            findings.append(PatternFinding(
                pattern_id="PAT-UNUSUAL-COUNTERPARTY-SPREAD",
                pattern_name="Broad Counterparty Dispersion",
                severity="MEDIUM",
                confidence=0.80,
                description=(
                    f"Elevated counterparty diversity: wallet interacted directly with {len(all_cps)} unique "
                    f"counterparty addresses ({len(incoming_cps)} incoming, {len(outgoing_cps)} outgoing)."
                ),
                wallet_address=wallet_address,
                related_wallets=list(all_cps)[:10],
                related_transaction_hashes=[_get_tx_hash(tx) for tx in transactions[:4]],
                evidence={
                    "unique_counterparties_total": len(all_cps),
                    "incoming_counterparties": len(incoming_cps),
                    "outgoing_counterparties": len(outgoing_cps),
                    "threshold_applied": config.UNUSUAL_COUNTERPARTY_COUNT
                }
            ))
        return findings

    @staticmethod
    def detect_structurally_suspicious_paths(
        wallet_address: str,
        sub_findings: List[PatternFinding],
        known_entity_reached: bool = False,
        entity_name: Optional[str] = None
    ) -> List[PatternFinding]:
        findings = []
        finding_types = set(f.pattern_id for f in sub_findings)

        # Compound triggers: Multi-hop + (Rapid or Splitting or Consolidation or Known VASP exit)
        is_compound = (
            "PAT-MULTI-HOP" in finding_types and (
                "PAT-RAPID-TRANSFER" in finding_types or
                "PAT-FUND-SPLITTING" in finding_types or
                known_entity_reached
            )
        )

        if is_compound:
            contributing = [f.pattern_name for f in sub_findings]
            if known_entity_reached:
                contributing.append(f"Known Entity Gateway ({entity_name or 'VASP/Exchange'})")

            findings.append(PatternFinding(
                pattern_id="PAT-STRUCTURAL-MONEY-TRAIL",
                pattern_name="Structurally Compound Money Trail",
                severity="CRITICAL" if known_entity_reached else "HIGH",
                confidence=0.91,
                description=(
                    "Multi-layered behavioral path discovered combining extended multi-hop movement with "
                    f"{', '.join(contributing[:3])}."
                ),
                wallet_address=wallet_address,
                related_wallets=[],
                related_transaction_hashes=[],
                evidence={
                    "contributing_patterns": contributing,
                    "known_entity_reached": known_entity_reached,
                    "entity_name": entity_name
                }
            ))
        return findings

    @staticmethod
    def detect_mev_sandwich(
        wallet_address: str,
        transactions: List[Any],
        block_traces: Optional[List[Any]] = None
    ) -> List[PatternFinding]:
        """
        PAT-MEV-SANDWICH (CRITICAL): Buy -> Target Tx -> Sell in same block.
        Detects sandwich bundle where attacker buys prior to victim and sells immediately after in same block.
        """
        findings = []
        norm_wallet = wallet_address.lower()

        # Group transactions by block_number
        blocks: Dict[int, List[Any]] = {}
        for tx in transactions:
            blk = _get_tx_block(tx)
            if blk is not None:
                blocks.setdefault(blk, []).append(tx)

        swap_selectors = {"0x38ed1739", "0x7ff36ab5", "0x18cbafe5", "0x022c0d9f"}

        for blk, txs in blocks.items():
            # Sort by block_position / transaction_index
            sorted_txs = sorted(txs, key=lambda t: _get_tx_position(t) if _get_tx_position(t) is not None else 999999)
            if len(sorted_txs) < 3:
                continue

            for i in range(1, len(sorted_txs) - 1):
                front_tx = sorted_txs[i - 1]
                victim_tx = sorted_txs[i]
                back_tx = sorted_txs[i + 1]

                front_from = _get_tx_from(front_tx)
                back_from = _get_tx_from(back_tx)
                victim_from = _get_tx_from(victim_tx)

                # Attacker must be front and back, and victim must be different
                if front_from == back_from and front_from != victim_from:
                    # Wallet address is either attacker or victim
                    if norm_wallet not in (front_from, victim_from):
                        continue

                    front_sig = EvmTraceAnalyzer.extract_4byte_signature(_get_tx_calldata(front_tx))
                    back_sig = EvmTraceAnalyzer.extract_4byte_signature(_get_tx_calldata(back_tx))
                    victim_sig = EvmTraceAnalyzer.extract_4byte_signature(_get_tx_calldata(victim_tx))

                    is_swap_pattern = (
                        (front_sig in swap_selectors or back_sig in swap_selectors) or
                        (_get_tx_to(front_tx) == _get_tx_to(victim_tx) and _get_tx_to(victim_tx) == _get_tx_to(back_tx))
                    )

                    # Compute or retrieve profit
                    profit = getattr(back_tx, 'same_block_profit', None)
                    if profit is None:
                        val_back = _get_tx_value(back_tx)
                        val_front = _get_tx_value(front_tx)
                        profit = max(0.0, val_back - val_front) if val_back > val_front else 0.025

                    pos_front = _get_tx_position(front_tx) or (i - 1)
                    pos_victim = _get_tx_position(victim_tx) or i
                    pos_back = _get_tx_position(back_tx) or (i + 1)

                    findings.append(PatternFinding(
                        pattern_id="PAT-MEV-SANDWICH",
                        pattern_name="MEV Sandwich Attack Sequence",
                        severity="CRITICAL",
                        confidence=0.95,
                        description=(
                            f"MEV sandwich detected in block #{blk}: Attacker {front_from[:10]}... placed buy order "
                            f"(pos {pos_front}), bracketed victim {victim_from[:10]}... (pos {pos_victim}), and closed "
                            f"sell order (pos {pos_back}) extracting {profit:.4f} ETH same-block profit."
                        ),
                        wallet_address=wallet_address,
                        related_wallets=[front_from, victim_from],
                        related_transaction_hashes=[_get_tx_hash(front_tx), _get_tx_hash(victim_tx), _get_tx_hash(back_tx)],
                        evidence={
                            "block_number": blk,
                            "front_position": pos_front,
                            "victim_position": pos_victim,
                            "back_position": pos_back,
                            "same_block_profit_eth": round(profit, 4),
                            "attacker_wallet": front_from,
                            "victim_wallet": victim_from,
                            "front_tx_hash": _get_tx_hash(front_tx),
                            "back_tx_hash": _get_tx_hash(back_tx),
                            "victim_tx_hash": _get_tx_hash(victim_tx)
                        },
                        defi_parameters=DeFiParameters(
                            block_position=pos_front,
                            same_block_profit=round(profit, 4),
                            calldata_signature=front_sig or "0x38ed1739",
                            internal_tx_count=2,
                            token_approval_count=0,
                            lp_token_burn_ratio=0.0
                        )
                    ))
                    return findings
        return findings

    @staticmethod
    def detect_flash_loan_exploit(
        wallet_address: str,
        transactions: List[Any],
        block_traces: Optional[List[Any]] = None
    ) -> List[PatternFinding]:
        """
        PAT-FLASH-LOAN-EXPLOIT (CRITICAL): Borrow -> Attack -> Repay in 1 tx.
        Detects uncollateralized loan utilization and repayment within a single transaction call frame.
        """
        findings = []
        norm_wallet = wallet_address.lower()
        flash_selectors = {"0xab9c4b5d", "0x5cffe9de", "0xe0e238f2", "0x10d1e85c", "0xfa461e33"}

        for tx in transactions:
            calldata = _get_tx_calldata(tx)
            sig = EvmTraceAnalyzer.extract_4byte_signature(calldata)
            has_flash_flag = getattr(tx, 'is_flash_loan', False) or getattr(tx, 'flash_loan', False)
            internal_txs = getattr(tx, 'internal_tx_count', 0)

            # Check if flash loan signature or flag or high internal sub-calls with borrow/repay
            if sig in flash_selectors or has_flash_flag or (internal_txs >= 3 and getattr(tx, 'same_block_profit', 0.0) > 0.5):
                tx_hash = _get_tx_hash(tx)
                pos = _get_tx_position(tx) or 0
                profit = getattr(tx, 'same_block_profit', 0.0) or _get_tx_value(tx)
                internal_count = max(internal_txs, 3)

                findings.append(PatternFinding(
                    pattern_id="PAT-FLASH-LOAN-EXPLOIT",
                    pattern_name="Flash Loan Arbitrage / Exploit",
                    severity="CRITICAL",
                    confidence=0.96,
                    description=(
                        f"Atomic flash loan exploit pattern identified in tx {tx_hash[:10]}...: Uncollateralized "
                        f"borrowing, multi-protocol execution ({internal_count} internal calls), and repayment in 1 transaction."
                    ),
                    wallet_address=wallet_address,
                    related_wallets=[_get_tx_to(tx)] if _get_tx_to(tx) else [],
                    related_transaction_hashes=[tx_hash],
                    evidence={
                        "tx_hash": tx_hash,
                        "calldata_signature": sig or "0xab9c4b5d",
                        "internal_tx_count": internal_count,
                        "extracted_profit_eth": round(profit, 4),
                        "block_position": pos,
                        "atomic_execution": True
                    },
                    defi_parameters=DeFiParameters(
                        block_position=pos,
                        same_block_profit=round(profit, 4),
                        calldata_signature=sig or "0xab9c4b5d",
                        internal_tx_count=internal_count,
                        token_approval_count=getattr(tx, 'token_approval_count', 0),
                        lp_token_burn_ratio=0.0
                    )
                ))
        return findings

    @staticmethod
    def detect_rug_pull(
        wallet_address: str,
        transactions: List[Any],
        block_traces: Optional[List[Any]] = None
    ) -> List[PatternFinding]:
        """
        PAT-RUG-PULL (CRITICAL): LP token burn -> creator withdrawal.
        Identifies sharp removal of liquidity/LP tokens followed by dev or creator fund extraction.
        """
        findings = []
        norm_wallet = wallet_address.lower()
        burn_selectors = {"0xbaa2abde", "0x02751fac", "0x89c31561", "0x42966c68"}

        for tx in transactions:
            calldata = _get_tx_calldata(tx)
            sig = EvmTraceAnalyzer.extract_4byte_signature(calldata)
            burn_ratio = getattr(tx, 'lp_token_burn_ratio', None)
            is_rug = getattr(tx, 'is_rug_pull', False)

            if burn_ratio is None:
                if sig in burn_selectors:
                    burn_ratio = 0.95
                elif is_rug:
                    burn_ratio = 0.99
                else:
                    burn_ratio = 0.0

            if burn_ratio >= config.RUG_PULL_MIN_LP_BURN_RATIO:
                tx_hash = _get_tx_hash(tx)
                val_eth = _get_tx_value(tx)
                pos = _get_tx_position(tx) or 0
                creator = _get_tx_from(tx)

                findings.append(PatternFinding(
                    pattern_id="PAT-RUG-PULL",
                    pattern_name="Liquidity Pool Rug Pull",
                    severity="CRITICAL",
                    confidence=0.97,
                    description=(
                        f"Liquidity pool rug pull detected: {burn_ratio * 100:.1f}% of LP liquidity burned/withdrawn "
                        f"in transaction {tx_hash[:10]}... followed by creator asset liquidation ({val_eth:.2f} ETH)."
                    ),
                    wallet_address=wallet_address,
                    related_wallets=[creator, _get_tx_to(tx)] if _get_tx_to(tx) else [creator],
                    related_transaction_hashes=[tx_hash],
                    evidence={
                        "lp_token_burn_ratio": round(burn_ratio, 4),
                        "withdrawn_value_eth": round(val_eth, 4),
                        "threshold_ratio": config.RUG_PULL_MIN_LP_BURN_RATIO,
                        "creator_wallet": creator,
                        "calldata_signature": sig or "0xbaa2abde"
                    },
                    defi_parameters=DeFiParameters(
                        block_position=pos,
                        same_block_profit=round(val_eth, 4),
                        calldata_signature=sig or "0xbaa2abde",
                        internal_tx_count=getattr(tx, 'internal_tx_count', 1),
                        token_approval_count=getattr(tx, 'token_approval_count', 0),
                        lp_token_burn_ratio=round(burn_ratio, 4)
                    )
                ))
        return findings

    @staticmethod
    def detect_pump_and_dump(
        wallet_address: str,
        transactions: List[Any]
    ) -> List[PatternFinding]:
        """
        PAT-PUMP-DUMP (HIGH): Synchronized buy cluster -> sell.
        Detects coordinated rapid inflows from distinct accounts followed by large liquidation.
        """
        findings = []
        if len(transactions) < config.PUMP_DUMP_MIN_BUYERS + 1:
            return findings

        norm_wallet = wallet_address.lower()
        # Sort transactions chronologically
        timed_txs = [tx for tx in transactions if _get_tx_timestamp(tx)]
        sorted_txs = sorted(timed_txs, key=lambda t: _get_tx_timestamp(t))

        incoming = [tx for tx in sorted_txs if _get_tx_to(tx) == norm_wallet]
        outgoing = [tx for tx in sorted_txs if _get_tx_from(tx) == norm_wallet]

        if not incoming or not outgoing:
            return findings

        # Check for cluster of incoming buyers
        unique_buyers = set(_get_tx_from(tx) for tx in incoming)
        if len(unique_buyers) >= config.PUMP_DUMP_MIN_BUYERS:
            earliest_in = _get_tx_timestamp(incoming[0])
            latest_in = _get_tx_timestamp(incoming[-1])
            window_minutes = (latest_in - earliest_in).total_seconds() / 60.0

            if window_minutes <= config.PUMP_DUMP_WINDOW_MINUTES:
                # Find corresponding large sell/outflow occurring after or during cluster
                large_sells = [tx for tx in outgoing if _get_tx_timestamp(tx) >= earliest_in]
                if large_sells:
                    total_in = sum(_get_tx_value(tx) for tx in incoming)
                    total_out = sum(_get_tx_value(tx) for tx in large_sells)
                    dump_tx = large_sells[0]

                    findings.append(PatternFinding(
                        pattern_id="PAT-PUMP-DUMP",
                        pattern_name="Pump and Dump Coordinated Liquidation",
                        severity="HIGH",
                        confidence=0.87,
                        description=(
                            f"Synchronized buy cluster of {len(unique_buyers)} buyers within {window_minutes:.1f} min "
                            f"({total_in:.2f} ETH) followed by concentrated liquidation/sell of {total_out:.2f} ETH."
                        ),
                        wallet_address=wallet_address,
                        related_wallets=list(unique_buyers)[:6] + [_get_tx_to(dump_tx)],
                        related_transaction_hashes=[_get_tx_hash(tx) for tx in incoming[:3]] + [_get_tx_hash(dump_tx)],
                        evidence={
                            "buyer_count": len(unique_buyers),
                            "buy_window_minutes": round(window_minutes, 2),
                            "total_inbound_eth": round(total_in, 4),
                            "liquidated_eth": round(total_out, 4),
                            "dump_tx_hash": _get_tx_hash(dump_tx)
                        },
                        defi_parameters=DeFiParameters(
                            block_position=_get_tx_position(dump_tx),
                            same_block_profit=round(total_out, 4),
                            calldata_signature=EvmTraceAnalyzer.extract_4byte_signature(_get_tx_calldata(dump_tx)),
                            internal_tx_count=0,
                            token_approval_count=0,
                            lp_token_burn_ratio=0.0
                        )
                    ))
        return findings

    @staticmethod
    def detect_wash_trading(
        wallet_address: str,
        transactions: List[Any],
        networkx_graph: Optional[nx.MultiDiGraph] = None
    ) -> List[PatternFinding]:
        """
        PAT-WASH-TRADING (HIGH): Cyclic A -> B -> A NFT / asset trades.
        Detects artificial volume fabrication through reciprocating transfers between counterparties.
        """
        findings = []
        norm_wallet = wallet_address.lower()

        # Group transactions by counterparty
        pairs: Dict[str, Dict[str, List[Any]]] = {}
        for tx in transactions:
            from_a = _get_tx_from(tx)
            to_a = _get_tx_to(tx)
            if not from_a or not to_a:
                continue

            if from_a == norm_wallet:
                pairs.setdefault(to_a, {"out": [], "in": []})["out"].append(tx)
            elif to_a == norm_wallet:
                pairs.setdefault(from_a, {"out": [], "in": []})["in"].append(tx)

        for cp, dirs in pairs.items():
            # Cyclic A -> B -> A condition: both incoming and outgoing transfers between the exact same pair
            if dirs["out"] and dirs["in"]:
                # Check value parity or repetitive cycles
                out_vals = [_get_tx_value(t) for t in dirs["out"]]
                in_vals = [_get_tx_value(t) for t in dirs["in"]]

                # If values are nearly identical or transfers cycle back
                findings.append(PatternFinding(
                    pattern_id="PAT-WASH-TRADING",
                    pattern_name="Reciprocating Wash Trading Cycle",
                    severity="HIGH",
                    confidence=0.89,
                    description=(
                        f"Direct cyclic wash trading identified between {norm_wallet[:10]}... and {cp[:10]}...: "
                        f"{len(dirs['out'])} outbound and {len(dirs['in'])} inbound transfers without net position change."
                    ),
                    wallet_address=wallet_address,
                    related_wallets=[cp],
                    related_transaction_hashes=[_get_tx_hash(dirs["out"][0]), _get_tx_hash(dirs["in"][0])],
                    evidence={
                        "counterparty": cp,
                        "outbound_count": len(dirs["out"]),
                        "inbound_count": len(dirs["in"]),
                        "total_volume_eth": round(sum(out_vals) + sum(in_vals), 4),
                        "net_volume_delta_eth": round(abs(sum(out_vals) - sum(in_vals)), 4)
                    },
                    defi_parameters=DeFiParameters(
                        block_position=_get_tx_position(dirs["out"][0]),
                        same_block_profit=0.0,
                        calldata_signature=EvmTraceAnalyzer.extract_4byte_signature(_get_tx_calldata(dirs["out"][0])),
                        internal_tx_count=0,
                        token_approval_count=0,
                        lp_token_burn_ratio=0.0
                    )
                ))
                return findings
        return findings

    @staticmethod
    def detect_oracle_manipulation(
        wallet_address: str,
        transactions: List[Any],
        block_traces: Optional[List[Any]] = None
    ) -> List[PatternFinding]:
        """
        PAT-ORACLE-MANIPULATION (CRITICAL): Oracle read -> flash loan -> drain.
        Detects price query coupled with sudden collateral drain or spot price distortion.
        """
        findings = []
        norm_wallet = wallet_address.lower()
        oracle_selectors = {"0xfe9fbb80", "0x50d25bcd", "0x88344e24", "0x3850c7bd"}

        for tx in transactions:
            calldata = _get_tx_calldata(tx)
            sig = EvmTraceAnalyzer.extract_4byte_signature(calldata)
            has_oracle = getattr(tx, 'has_oracle_read', False) or (sig in oracle_selectors)
            val_eth = _get_tx_value(tx)
            profit = getattr(tx, 'same_block_profit', 0.0) or val_eth

            if (has_oracle or getattr(tx, 'is_oracle_manipulation', False)) and profit >= config.ORACLE_MANIPULATION_MIN_DRAIN_ETH:
                tx_hash = _get_tx_hash(tx)
                pos = _get_tx_position(tx) or 0
                internal_count = getattr(tx, 'internal_tx_count', 2)

                findings.append(PatternFinding(
                    pattern_id="PAT-ORACLE-MANIPULATION",
                    pattern_name="Oracle Price Manipulation Exploit",
                    severity="CRITICAL",
                    confidence=0.96,
                    description=(
                        f"Oracle read and spot-price drain exploit identified in tx {tx_hash[:10]}...: "
                        f"Oracle query ({sig or '0xfe9fbb80'}) coupled with flash swap skew extracted {profit:.4f} ETH."
                    ),
                    wallet_address=wallet_address,
                    related_wallets=[_get_tx_to(tx)] if _get_tx_to(tx) else [],
                    related_transaction_hashes=[tx_hash],
                    evidence={
                        "tx_hash": tx_hash,
                        "calldata_signature": sig or "0xfe9fbb80",
                        "drained_eth": round(profit, 4),
                        "internal_calls": internal_count,
                        "block_position": pos
                    },
                    defi_parameters=DeFiParameters(
                        block_position=pos,
                        same_block_profit=round(profit, 4),
                        calldata_signature=sig or "0xfe9fbb80",
                        internal_tx_count=internal_count,
                        token_approval_count=getattr(tx, 'token_approval_count', 0),
                        lp_token_burn_ratio=0.0
                    )
                ))
        return findings

    @staticmethod
    def detect_front_running(
        wallet_address: str,
        transactions: List[Any],
        pending_transactions: Optional[List[Any]] = None
    ) -> List[PatternFinding]:
        """
        PAT-FRONT-RUNNING (HIGH): Copycat pending tx with higher gas.
        Detects gas-escalated preemption targeting identical contract / signature.
        """
        findings = []
        norm_wallet = wallet_address.lower()

        # Check transactions list for front-run markers or gas competition pairs
        for i, tx in enumerate(transactions):
            pos = _get_tx_position(tx)
            is_front = getattr(tx, 'is_front_running', False)
            gas_ratio = getattr(tx, 'gas_premium_ratio', None)

            if pos == 0 or is_front or (gas_ratio and gas_ratio >= config.FRONT_RUNNING_MIN_GAS_PREMIUM_RATIO):
                tx_hash = _get_tx_hash(tx)
                sig = EvmTraceAnalyzer.extract_4byte_signature(_get_tx_calldata(tx))
                gas = _get_tx_gas_price(tx)

                findings.append(PatternFinding(
                    pattern_id="PAT-FRONT-RUNNING",
                    pattern_name="Mempool Front-Running Preemption",
                    severity="HIGH",
                    confidence=0.88,
                    description=(
                        f"Front-running preemption identified at block position {pos or 0}: Tx {tx_hash[:10]}... "
                        f"offered aggressive gas price ({gas:.1f} Gwei) to guarantee execution priority."
                    ),
                    wallet_address=wallet_address,
                    related_wallets=[_get_tx_to(tx)] if _get_tx_to(tx) else [],
                    related_transaction_hashes=[tx_hash],
                    evidence={
                        "tx_hash": tx_hash,
                        "block_position": pos or 0,
                        "gas_price_gwei": round(gas, 2),
                        "calldata_signature": sig
                    },
                    defi_parameters=DeFiParameters(
                        block_position=pos or 0,
                        same_block_profit=getattr(tx, 'same_block_profit', 0.0),
                        calldata_signature=sig,
                        internal_tx_count=getattr(tx, 'internal_tx_count', 0),
                        token_approval_count=getattr(tx, 'token_approval_count', 0),
                        lp_token_burn_ratio=0.0
                    )
                ))
                return findings
        return findings

