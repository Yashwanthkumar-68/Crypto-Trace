from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from web3 import Web3
from app.database.database import get_db
from app.analysis.pattern_service import PatternService
from app.analysis.pattern_models import (
    PatternAnalysisResponse, CasePatternsResponse,
    MempoolSimulationRequest, MempoolSimulationResponse,
    EvmTraceEvaluateRequest, EvmTraceEvaluateResponse,
    DeFiParameters
)
from app.analysis.mempool_simulator import MempoolSimulator
from app.analysis.evm_tracer import EvmTraceAnalyzer
from app.analysis.pattern_rules import PatternRules

router = APIRouter(prefix="/analysis", tags=["Suspicious Pattern Detection"])

@router.get("/wallet/{address}/patterns", response_model=PatternAnalysisResponse)
def get_wallet_patterns(
    address: str,
    max_hops: int = Query(default=3, ge=1, le=5, description="Hop depth for multi-hop pattern detection"),
    blockchain: str = Query(default="Ethereum"),
    chain_id: int = Query(default=11155111),
    db: Session = Depends(get_db)
):
    """
    Analyzes transaction behavior and multi-hop flows for a suspect wallet and
    returns detected suspicious patterns (Phase 5) without declaring definitive criminality.
    """
    if not Web3.is_address(address):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid wallet address format: '{address}'. Must be a valid 0x Ethereum address."
        )

    try:
        return PatternService.analyze_wallet_patterns(
            db=db,
            wallet_address=address,
            max_hops=max_hops,
            blockchain=blockchain,
            chain_id=chain_id,
            persist=True
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pattern analysis failed: {str(e)}")

@router.get("/case/{case_id}/patterns", response_model=CasePatternsResponse)
def get_case_patterns(
    case_id: str,
    max_hops: int = Query(default=3, ge=1, le=5),
    db: Session = Depends(get_db)
):
    """
    Analyzes transactions and flow paths for all wallets linked to a specific case.
    """
    try:
        return PatternService.analyze_case_patterns(
            db=db,
            case_id=case_id,
            max_hops=max_hops
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Case pattern analysis failed: {str(e)}")

@router.post("/mempool/simulate", response_model=MempoolSimulationResponse)
def simulate_mempool(
    request: MempoolSimulationRequest
):
    """
    Simulates block inclusion from pending mempool transactions, computing block positions,
    effective priority gas auctions, and detecting front-running & MEV sandwich sequences.
    """
    try:
        return MempoolSimulator.simulate_mempool(
            pending_txs=request.pending_transactions,
            base_fee_gwei=request.base_fee_gwei,
            target_wallet=request.target_wallet
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Mempool simulation failed: {str(e)}")

@router.post("/trace/evaluate", response_model=EvmTraceEvaluateResponse)
def evaluate_evm_trace(
    request: EvmTraceEvaluateRequest
):
    """
    Analyzes EVM internal call traces, decodes 4-byte calldata signatures using eth-abi,
    extracts the 6 DeFi parameters, and evaluates exploit patterns.
    """
    try:
        # Mock/wrap tx for parameter extraction
        class TraceTxObj:
            def __init__(self, req: EvmTraceEvaluateRequest):
                self.tx_hash = req.tx_hash
                self.from_address = req.from_address
                self.to_address = req.to_address
                self.value_eth = req.value_eth
                self.calldata = req.calldata
                self.block_position = req.block_position
                self.same_block_profit = req.same_block_profit or 0.0

        tx_obj = TraceTxObj(request)
        defi_params = EvmTraceAnalyzer.evaluate_defi_parameters(
            tx=tx_obj,
            block_position=request.block_position,
            same_block_profit=request.same_block_profit or 0.0,
            internal_calls=request.internal_calls,
            logs=request.logs
        )
        decoded = EvmTraceAnalyzer.decode_calldata(request.calldata)

        findings = []
        # Check flash loan
        findings.extend(PatternRules.detect_flash_loan_exploit(request.from_address, [tx_obj]))
        # Check rug pull
        findings.extend(PatternRules.detect_rug_pull(request.from_address, [tx_obj]))
        # Check oracle manipulation
        findings.extend(PatternRules.detect_oracle_manipulation(request.from_address, [tx_obj]))

        return EvmTraceEvaluateResponse(
            tx_hash=request.tx_hash,
            defi_parameters=defi_params,
            decoded_calldata=decoded,
            detected_patterns=findings,
            trace_summary={
                "has_internal_calls": bool(request.internal_calls),
                "internal_calls_count": len(request.internal_calls or []),
                "has_logs": bool(request.logs),
                "decoded_function": decoded.get("function_name"),
                "selector": defi_params.calldata_signature
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Trace evaluation failed: {str(e)}")

