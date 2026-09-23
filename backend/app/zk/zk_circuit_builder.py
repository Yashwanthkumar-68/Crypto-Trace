import hashlib
import json

class ZkCircuitBuilder:
    """
    Mocks the behavior of compiling a Circom circuit.
    In a real environment, this would generate a .wasm and .zkey file
    representing the constraint system for the path verification.
    """
    
    @staticmethod
    def generate_verification_key() -> dict:
        """
        Simulates generating a verification key (vkey.json) from the circuit.
        """
        mock_vkey = {
            "protocol": "groth16",
            "curve": "bn128",
            "nPublic": 3,
            "vk_alpha_1": ["0x123...", "0x456...", "1"],
            "vk_beta_2": [["0x...", "0x..."], ["0x...", "0x..."], ["1", "0"]],
            "vk_gamma_2": [["0x...", "0x..."], ["0x...", "0x..."], ["1", "0"]],
            "vk_delta_2": [["0x...", "0x..."], ["0x...", "0x..."], ["1", "0"]],
            "IC": []
        }
        
        # We generate a deterministic hash of this "key" to represent the circuit
        vkey_hash = hashlib.sha256(json.dumps(mock_vkey, sort_keys=True).encode()).hexdigest()
        return {
            "vkey": mock_vkey,
            "vkey_hash": vkey_hash
        }

    @staticmethod
    def build_circuit_constraints(max_hops: int):
        """
        Simulates defining the constraints.
        e.g., intermediate_nodes[i] != intermediate_nodes[j]
        hash(intermediate_nodes) == public_hash
        """
        return f"Circuit compiled successfully for max_hops={max_hops}. (Mock)"
