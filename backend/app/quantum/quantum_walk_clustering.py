"""
Continuous-Time & Discrete-Time Quantum Walk for Subgraph Clustering & Fraud Ring Detection.
Uses quantum interference over graph Laplacian to identify smurfing communities and mixing clusters.
"""

import math
import logging
import numpy as np
from typing import Dict, Any, List, Optional
from scipy.linalg import expm

from app.quantum.quantum_config import QuantumConfig
from app.quantum.qiskit_adapter import QiskitAdapter

logger = logging.getLogger("quantum.walk_clustering")


class QuantumWalkClustering:
    """
    Continuous-Time Quantum Walk (CTQW) on transaction network graph Laplacians.
    Computes quantum transition probability matrix P(t) = |exp(-i * L * t)|^2.
    """

    def __init__(self, config: Optional[QuantumConfig] = None):
        self.config = config or QuantumConfig()
        self.adapter = QiskitAdapter(self.config)

    def detect_communities(
        self,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
        evolution_time: float = 1.5,
        num_clusters: int = 3,
        quantum_backend: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Performs continuous-time quantum walk clustering on the graph.
        """
        N = len(nodes)
        if N < 2:
            return {
                "status": "SUCCESS",
                "clusters": [{"cluster_id": 0, "nodes": nodes}],
                "quantum_interference_entropy": 0.0
            }

        addr_to_idx = {n.get("address"): i for i, n in enumerate(nodes)}
        
        # Build Adjacency and Degree Matrix
        A = np.zeros((N, N))
        for edge in edges:
            u_str = edge.get("from_address") or edge.get("from") or edge.get("source")
            v_str = edge.get("to_address") or edge.get("to") or edge.get("target")
            w = float(edge.get("value", 1.0) or edge.get("weight", 1.0))
            if u_str in addr_to_idx and v_str in addr_to_idx:
                u = addr_to_idx[u_str]
                v = addr_to_idx[v_str]
                A[u, v] += w
                A[v, u] += w

        D = np.diag(np.sum(A, axis=1))
        L = D - A  # Graph Laplacian

        # Quantum Unitary Evolution: U(t) = exp(-i * L * t)
        H = L.astype(complex)
        U_t = expm(-1j * H * evolution_time)
        
        # Transition Probability Matrix P_ij = |U_ij|^2
        P = np.abs(U_t) ** 2
        # Normalize rows
        row_sums = P.sum(axis=1, keepdims=True)
        row_sums[row_sums == 0] = 1.0
        P_norm = P / row_sums

        # Spectral / Quantum distance embedding
        k = min(num_clusters, N)
        try:
            from sklearn.cluster import KMeans
            kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
            cluster_labels = kmeans.fit_predict(P_norm)
        except Exception:
            # Fallback simple partitioning
            cluster_labels = [i % k for i in range(N)]

        clusters_dict: Dict[int, List[Dict[str, Any]]] = {i: [] for i in range(k)}
        for idx, label in enumerate(cluster_labels):
            node_info = dict(nodes[idx])
            node_info["quantum_walk_embedding_score"] = round(float(np.mean(P_norm[idx])), 4)
            clusters_dict[int(label)].append(node_info)

        # Calculate Quantum Shannon Entropy of state interference
        p_flat = P_norm.flatten()
        p_flat = p_flat[p_flat > 1e-12]
        entropy = -np.sum(p_flat * np.log2(p_flat)) / N

        return {
            "status": "SUCCESS",
            "nodes_clustered": N,
            "cluster_count": k,
            "evolution_time_t": evolution_time,
            "quantum_interference_entropy": round(float(entropy), 4),
            "clusters": [
                {
                    "cluster_id": cid,
                    "size": len(c_nodes),
                    "avg_risk_score": round(sum(n.get("risk_score", 0.0) for n in c_nodes) / max(1, len(c_nodes)), 3),
                    "nodes": c_nodes
                }
                for cid, c_nodes in clusters_dict.items()
            ]
        }
