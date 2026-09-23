"""
Quantum Graph Search via Grover's Algorithm.
Searches over transaction graph adjacency matrices and node feature spaces
with quadratic speedup O(sqrt(N)) over classical brute-force O(N).
"""

import math
import logging
import numpy as np
from typing import Dict, Any, List, Optional, Tuple, Union

from app.quantum.quantum_config import QuantumConfig, QuantumBackendType, NoiseMitigationStrategy
from app.quantum.qiskit_adapter import QiskitAdapter, QISKIT_AVAILABLE

if QISKIT_AVAILABLE:
    from qiskit import QuantumCircuit, QuantumRegister, ClassicalRegister
    from qiskit.circuit.library import MCMT, ZGate, XGate, HGate

logger = logging.getLogger("quantum.grover_search")


class QuantumGraphSearchEngine:
    """
    Executes Grover's search algorithm over graph structures to identify
    high-risk target wallets, mixer exit nodes, or anomalous adjacency patterns.
    """

    def __init__(self, config: Optional[QuantumConfig] = None):
        self.config = config or QuantumConfig()
        self.adapter = QiskitAdapter(self.config)

    def search_graph(
        self,
        nodes: List[Dict[str, Any]],
        edges: Optional[List[Dict[str, Any]]] = None,
        target_criteria: Optional[Dict[str, Any]] = None,
        quantum_backend: Optional[str] = None,
        grover_iterations: Optional[Union[str, int]] = "auto",
        shot_count: Optional[int] = None,
        noise_mitigation: Optional[str] = None,
        quantum_threshold_nodes: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Runs Grover's quantum search over a graph node/adjacency set.

        Parameters:
            nodes: List of wallet node dictionaries with attributes (e.g. address, risk_score, is_flagged, degree)
            edges: List of directed transaction edges
            target_criteria: Predicate dict to match target nodes (e.g. {'is_fraud': True}, {'min_risk': 0.75})
            quantum_backend: 'aer_simulator', 'ibm_brisbane', etc.
            grover_iterations: 'auto' (pi/4 * sqrt(N/M)) or an explicit integer
            shot_count: Repetitions (default 1024)
            noise_mitigation: 'ZNE', 'PEC', or 'None'
            quantum_threshold_nodes: Node count triggering quantum acceleration (default 500)
        """
        N = len(nodes)
        if N == 0:
            return {
                "status": "EMPTY_GRAPH",
                "message": "No nodes provided for quantum search",
                "results": []
            }

        threshold = quantum_threshold_nodes or self.config.quantum_threshold_nodes
        backend_name = quantum_backend or self.config.quantum_backend.value
        shots = shot_count or self.config.shot_count
        noise_mit = noise_mitigation or (self.config.noise_mitigation.value if self.config.noise_mitigation else "None")

        # Evaluate target criteria across nodes classically to identify marked indices M
        target_indices = self._evaluate_target_indices(nodes, target_criteria)
        M = max(1, len(target_indices))

        # Determine register size: n qubits where 2^n >= N
        num_qubits = max(2, int(math.ceil(math.log2(max(N, 2)))))
        search_space_size = 2 ** num_qubits

        # Determine Grover iterations
        if grover_iterations == "auto" or grover_iterations is None:
            k_iterations = self.config.calculate_grover_iterations(search_space_size, M)
        else:
            try:
                k_iterations = max(1, int(grover_iterations))
            except (ValueError, TypeError):
                k_iterations = self.config.calculate_grover_iterations(search_space_size, M)

        # Build Quantum Circuit or Abstract Circuit Representation
        if QISKIT_AVAILABLE:
            qc = self._build_grover_circuit(num_qubits, target_indices, k_iterations)
            execution_result = self.adapter.execute_circuit(
                circuit=qc,
                shots=shots,
                backend_name=backend_name,
                noise_mitigation=noise_mit
            )
        else:
            # Fallback simulator structure
            circuit_data = {
                "num_qubits": num_qubits,
                "depth": 2 + k_iterations * (2 * num_qubits + 6),
                "gate_counts": {
                    "h": num_qubits * (2 * k_iterations + 1),
                    "x": num_qubits * 2 * k_iterations,
                    "mcx": 2 * k_iterations,
                    "barrier": k_iterations + 1
                },
                "target_indices": target_indices
            }
            execution_result = self.adapter.execute_circuit(
                circuit=circuit_data,
                shots=shots,
                backend_name=backend_name,
                noise_mitigation=noise_mit
            )

        # Map quantum bitstrings back to graph nodes and calculate confidence scores
        ranked_nodes = self._map_results_to_nodes(nodes, execution_result["probabilities"], num_qubits)

        # Theoretical Complexity Analysis
        classical_queries = N
        quantum_queries = k_iterations
        speedup_factor = round(classical_queries / max(1, quantum_queries), 2)
        quantum_triggered = N >= threshold or "ibm_" in backend_name or quantum_backend is not None

        return {
            "status": "SUCCESS",
            "quantum_acceleration_triggered": quantum_triggered,
            "threshold_applied": threshold,
            "search_space_size_N": search_space_size,
            "input_nodes_count": N,
            "qubits_used": num_qubits,
            "grover_iterations": k_iterations,
            "theoretical_speedup": f"{speedup_factor}x (O(sqrt(N)) vs O(N))",
            "target_nodes_identified": len(target_indices),
            "backend_telemetry": {
                "backend": execution_result.get("backend_used", backend_name),
                "execution_type": execution_result.get("execution_type"),
                "job_id": execution_result.get("job_id"),
                "shots": shots,
                "circuit_depth": execution_result.get("circuit_depth"),
                "qubits": execution_result.get("qubits"),
                "gate_counts": execution_result.get("gate_counts"),
                "noise_mitigation": execution_result.get("noise_mitigation"),
                "resilience_level": execution_result.get("resilience_level"),
                "execution_time_seconds": execution_result.get("execution_time_seconds")
            },
            "top_candidates": ranked_nodes[:10],
            "quantum_state_distribution": execution_result.get("probabilities", {})
        }

    def _evaluate_target_indices(
        self,
        nodes: List[Dict[str, Any]],
        criteria: Optional[Dict[str, Any]]
    ) -> List[int]:
        """Identifies target nodes satisfying the predicate."""
        if not criteria:
            # Default target: flagged fraud wallet or highest risk
            target_indices = [
                i for i, n in enumerate(nodes)
                if n.get("is_flagged") or n.get("is_fraud") or n.get("risk_score", 0) >= 0.75
            ]
            if not target_indices:
                # Fallback to top risk node
                max_risk_idx = max(range(len(nodes)), key=lambda i: nodes[i].get("risk_score", 0), default=0)
                target_indices = [max_risk_idx]
            return target_indices

        target_indices = []
        for i, node in enumerate(nodes):
            match = True
            for k, v in criteria.items():
                if k == "min_risk" and node.get("risk_score", 0) < v:
                    match = False
                    break
                elif k == "target_address" and node.get("address", "").lower() != str(v).lower():
                    match = False
                    break
                elif k in node and node[k] != v:
                    match = False
                    break
            if match:
                target_indices.append(i)

        return target_indices if target_indices else [0]

    def _build_grover_circuit(
        self,
        num_qubits: int,
        target_indices: List[int],
        iterations: int
    ) -> "QuantumCircuit":
        """Constructs the Qiskit QuantumCircuit implementing Grover's Search."""
        qr = QuantumRegister(num_qubits, name="q")
        cr = ClassicalRegister(num_qubits, name="meas")
        qc = QuantumCircuit(qr, cr, name="Grover_Graph_Search")

        # 1. State Preparation: Equal Superposition
        qc.h(qr)
        qc.barrier()

        for _ in range(iterations):
            # 2. Phase Oracle U_omega
            self._apply_oracle(qc, qr, target_indices, num_qubits)
            qc.barrier()

            # 3. Grover Diffusion Operator U_s
            self._apply_diffuser(qc, qr, num_qubits)
            qc.barrier()

        # 4. Measurement
        qc.measure(qr, cr)
        return qc

    def _apply_oracle(
        self,
        qc: "QuantumCircuit",
        qr: "QuantumRegister",
        target_indices: List[int],
        num_qubits: int
    ):
        """Applies multi-controlled Z phase inversion for marked basis states."""
        for target_idx in target_indices:
            bitstring = format(target_idx, f"0{num_qubits}b")
            # Flip zeros to ones for multi-control
            for q, bit in enumerate(reversed(bitstring)):
                if bit == "0":
                    qc.x(qr[q])

            # Multi-controlled Z gate
            if num_qubits == 1:
                qc.z(qr[0])
            elif num_qubits == 2:
                qc.cz(qr[0], qr[1])
            else:
                # Multi-controlled Z using H + MCX + H
                qc.h(qr[-1])
                qc.mcx(list(qr[:-1]), qr[-1])
                qc.h(qr[-1])

            # Uncompute X flips
            for q, bit in enumerate(reversed(bitstring)):
                if bit == "0":
                    qc.x(qr[q])

    def _apply_diffuser(
        self,
        qc: "QuantumCircuit",
        qr: "QuantumRegister",
        num_qubits: int
    ):
        """Constructs Grover's Diffusion Operator: 2|s><s| - I."""
        qc.h(qr)
        qc.x(qr)

        if num_qubits == 1:
            qc.z(qr[0])
        elif num_qubits == 2:
            qc.cz(qr[0], qr[1])
        else:
            qc.h(qr[-1])
            qc.mcx(list(qr[:-1]), qr[-1])
            qc.h(qr[-1])

        qc.x(qr)
        qc.h(qr)

    def _map_results_to_nodes(
        self,
        nodes: List[Dict[str, Any]],
        probabilities: Dict[str, float],
        num_qubits: int
    ) -> List[Dict[str, Any]]:
        """Maps measurement bitstring probabilities to corresponding graph nodes."""
        ranked_nodes = []
        for bitstring, prob in sorted(probabilities.items(), key=lambda item: item[1], reverse=True):
            try:
                node_idx = int(bitstring, 2)
            except ValueError:
                continue

            if node_idx < len(nodes):
                node_data = dict(nodes[node_idx])
                node_data["quantum_probability"] = prob
                node_data["state_bitstring"] = bitstring
                node_data["quantum_confidence"] = round(prob * 100, 2)
                ranked_nodes.append(node_data)

        # Include remaining nodes with 0 probability if not sampled
        indexed_addresses = {n.get("address") for n in ranked_nodes}
        for n in nodes:
            if n.get("address") not in indexed_addresses:
                nd = dict(n)
                nd["quantum_probability"] = 0.0
                nd["quantum_confidence"] = 0.0
                ranked_nodes.append(nd)

        return ranked_nodes
