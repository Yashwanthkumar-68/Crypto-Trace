from pydantic import BaseModel, Field
from typing import List, Optional

class GeneratePathProofRequest(BaseModel):
    case_id: str
    from_wallet: str = Field(..., description="The suspect's origin wallet address")
    to_wallet: str = Field(..., description="The destination exchange/VASP wallet address")
    max_hops: int = Field(default=5, description="Maximum number of hops allowed in the path")

class ZkProofResponse(BaseModel):
    proof_bytes: str = Field(..., description="Hex representation of the Groth16 proof")
    public_signals: List[str] = Field(..., description="Public inputs (from_wallet, to_wallet, hash)")
    verification_key_hash: str = Field(..., description="Hash of the circuit's verification key")
    timestamp: str

class VerifyProofRequest(BaseModel):
    proof_bytes: str
    public_signals: List[str]
    verification_key_hash: str

class VerifyProofResponse(BaseModel):
    is_valid: bool
    message: str

class SealEvidenceRequest(BaseModel):
    case_id: str
    evidence_id: str
    proof_bytes: str

class SealEvidenceResponse(BaseModel):
    sealed: bool
    digital_signature: str
    message: str
