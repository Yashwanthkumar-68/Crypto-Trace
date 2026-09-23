from fastapi import APIRouter, Depends, HTTPException, status
from app.zk.zk_schemas import (
    GeneratePathProofRequest, ZkProofResponse,
    VerifyProofRequest, VerifyProofResponse,
    SealEvidenceRequest, SealEvidenceResponse
)
from app.zk.proof_generator import ProofGenerator
from app.zk.proof_verifier import ProofVerifier
from app.zk.zk_evidence_locker import ZkEvidenceLocker

# Try importing standard auth, fallback to mock if needed
try:
    from app.api.auth import get_current_user
except ImportError:
    def get_current_user():
        return {"user_id": "system"}

router = APIRouter(prefix="/zk", tags=["Zero-Knowledge Proofs"])

@router.post("/generate-path-proof", response_model=ZkProofResponse)
def generate_path_proof(
    request: GeneratePathProofRequest,
    current_user = Depends(get_current_user)
):
    """
    Generates a Groth16 zk-SNARK proof demonstrating that funds moved from 
    from_wallet to to_wallet within max_hops, without revealing the intermediate wallets.
    """
    try:
        proof_data = ProofGenerator.generate_path_proof(
            from_wallet=request.from_wallet,
            to_wallet=request.to_wallet,
            max_hops=request.max_hops
        )
        return ZkProofResponse(**proof_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Proof generation failed: {str(e)}")

@router.post("/verify-proof", response_model=VerifyProofResponse)
def verify_proof(
    request: VerifyProofRequest,
    current_user = Depends(get_current_user)
):
    """
    Cryptographically verifies a previously generated Groth16 path proof.
    """
    is_valid = ProofVerifier.verify_proof(
        proof_bytes=request.proof_bytes,
        public_signals=request.public_signals,
        verification_key_hash=request.verification_key_hash
    )
    
    if is_valid:
        return VerifyProofResponse(is_valid=True, message="Cryptographic proof is VALID.")
    else:
        return VerifyProofResponse(is_valid=False, message="Cryptographic proof is INVALID or tampered.")

@router.post("/seal-evidence", response_model=SealEvidenceResponse)
def seal_evidence(
    request: SealEvidenceRequest,
    current_user = Depends(get_current_user)
):
    """
    Seals an evidence item with a ZK proof for court-admissibility.
    (Mock public signals and vkey hash are used for simplicity in this endpoint)
    """
    # In a real flow, the frontend would pass the full public signals and vkey
    # Here we mock them to match the simulation requirements
    import hashlib
    path_secret = "mock_path_for_sealing"
    mock_public_signals = ["0xOrigin", "0xDestination", hashlib.sha256(path_secret.encode()).hexdigest()]
    
    from app.zk.zk_circuit_builder import ZkCircuitBuilder
    vkey_info = ZkCircuitBuilder.generate_verification_key()
    
    result = ZkEvidenceLocker.seal_evidence(
        case_id=request.case_id,
        evidence_id=request.evidence_id,
        proof_bytes=request.proof_bytes,
        public_signals=mock_public_signals,
        vkey_hash=vkey_info["vkey_hash"]
    )
    
    return SealEvidenceResponse(**result)
