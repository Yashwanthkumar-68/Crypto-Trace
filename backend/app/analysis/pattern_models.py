import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class DeFiParameters(BaseModel):
    block_position: Optional[int] = Field(None, description="Tx position in block (0 = front-run suspect)")
    same_block_profit: float = Field(0.0, description="Net profit in single block in ETH")
    calldata_signature: Optional[str] = Field(None, description="4-byte function selector, e.g. 0xa9059cbb")
    internal_tx_count: int = Field(0, description="Internal ETH transfer count")
    token_approval_count: int = Field(0, description="Unlimited ERC-20 approvals count")
    lp_token_burn_ratio: float = Field(0.0, description="Fraction of LP burned in one tx (0.0 to 1.0)")

class PatternFinding(BaseModel):
    pattern_id: str
    pattern_name: str
    severity: str = "MEDIUM"  # "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
    confidence: float = 1.0   # 0.0 to 1.0
    description: str
    wallet_address: str
    related_wallets: List[str] = Field(default_factory=list)
    related_transaction_hashes: List[str] = Field(default_factory=list)
    evidence: Dict[str, Any] = Field(default_factory=dict)
    defi_parameters: Optional[DeFiParameters] = None
    detected_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)

class PatternAnalysisResponse(BaseModel):
    wallet_address: str
    blockchain: str = "Ethereum"
    chain_id: int = 11155111
    case_id: Optional[str] = None
    total_patterns_detected: int = 0
    patterns: List[PatternFinding] = Field(default_factory=list)
    summary: Dict[str, Any] = Field(default_factory=dict)
    analyzed_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)

class CasePatternsResponse(BaseModel):
    case_id: str
    suspect_wallet: Optional[str] = None
    blockchain: str = "Ethereum"
    total_patterns_detected: int = 0
    patterns: List[PatternFinding] = Field(default_factory=list)
    analyzed_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)

class MempoolTxItem(BaseModel):
    tx_hash: str
    from_address: str
    to_address: Optional[str] = None
    value_eth: float = 0.0
    gas_price_gwei: float = 20.0
    max_priority_fee_gwei: Optional[float] = None
    max_fee_gwei: Optional[float] = None
    calldata: Optional[str] = "0x"
    timestamp: Optional[datetime.datetime] = None
    nonce: Optional[int] = 0

class MempoolSimulationRequest(BaseModel):
    blockchain: str = "Ethereum"
    target_wallet: Optional[str] = None
    pending_transactions: List[MempoolTxItem] = Field(default_factory=list)
    base_fee_gwei: float = 15.0

class SimulatedTxResult(BaseModel):
    tx_hash: str
    from_address: str
    to_address: Optional[str] = None
    value_eth: float = 0.0
    block_position: int
    calldata_signature: Optional[str] = None
    effective_gas_price_gwei: float
    is_frontrun_suspect: bool = False
    is_sandwich_suspect: bool = False
    estimated_profit_eth: float = 0.0

class MempoolSimulationResponse(BaseModel):
    simulated_block_size: int
    base_fee_gwei: float
    ordered_transactions: List[SimulatedTxResult]
    detected_patterns: List[PatternFinding]
    summary: Dict[str, Any]

class EvmTraceEvaluateRequest(BaseModel):
    tx_hash: str
    from_address: str
    to_address: Optional[str] = None
    value_eth: float = 0.0
    calldata: Optional[str] = "0x"
    internal_calls: Optional[List[Dict[str, Any]]] = None
    logs: Optional[List[Dict[str, Any]]] = None
    block_position: Optional[int] = None
    same_block_profit: Optional[float] = None

class EvmTraceEvaluateResponse(BaseModel):
    tx_hash: str
    defi_parameters: DeFiParameters
    decoded_calldata: Dict[str, Any]
    detected_patterns: List[PatternFinding]
    trace_summary: Dict[str, Any]

