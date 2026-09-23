import hashlib
from datetime import datetime
from .proof_verifier import ProofVerifier

class ZkEvidenceLocker:
    """
    Manages the sealing of digital evidence using ZK proofs.
    """
    
    # In-memory mock storage for sealed evidence
    _sealed_evidence = {} # evidence_id -> seal_data
    
    @staticmethod
    def seal_evidence(case_id: str, evidence_id: str, proof_bytes: str, public_signals: list[str], vkey_hash: str) -> dict:
        """
        Validates a ZK proof and if valid, mathematically binds it to the evidence item.
        """
        
        is_valid = ProofVerifier.verify_proof(proof_bytes, public_signals, vkey_hash)
        
        if not is_valid:
            return {
                "sealed": False,
                "message": "Zero-Knowledge proof failed cryptographic verification.",
                "digital_signature": None
            }
            
        # Create a digital signature binding the proof to the evidence ID
        seal_payload = f"{case_id}:{evidence_id}:{proof_bytes}:{public_signals[2]}"
        digital_signature = hashlib.sha512(seal_payload.encode()).hexdigest()
        
        seal_record = {
            "case_id": case_id,
            "evidence_id": evidence_id,
            "digital_signature": digital_signature,
            "timestamp": datetime.utcnow().isoformat(),
            "status": "SEALED_AND_ADMISSIBLE"
        }
        
        ZkEvidenceLocker._sealed_evidence[evidence_id] = seal_record
        
        return {
            "sealed": True,
            "message": "Evidence successfully sealed with ZK path proof.",
            "digital_signature": digital_signature
        }

    @staticmethod
    def get_seal(evidence_id: str) -> dict:
        return ZkEvidenceLocker._sealed_evidence.get(evidence_id)
