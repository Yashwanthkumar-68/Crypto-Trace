"""
Tests for Quantum Computing Engine:
- Grover's Search Algorithm
- QAOA Path Optimizer
- Quantum Walk Community Detection
- Qiskit Adapter & Hardware Switching
- Quantum API Endpoints
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.quantum.quantum_config import QuantumConfig, QuantumBackendType, NoiseMitigationStrategy
from app.quantum.qiskit_adapter import QiskitAdapter
from app.quantum.quantum_graph_search import QuantumGraphSearchEngine
from app.quantum.qaoa_path_optimizer import QAOAPathOptimizer
from app.quantum.quantum_walk_clustering import QuantumWalkClustering

client = TestClient(app)


def test_quantum_config():
    config = QuantumConfig(
        quantum_backend=QuantumBackendType.AER_SIMULATOR,
        shot_count=1024,
        qaoa_depth=4,
        quantum_threshold_nodes=500,
        noise_mitigation=NoiseMitigationStrategy.ZNE
    )
    assert config.quantum_backend == "aer_simulator"
    assert config.shot_count == 1024
    assert config.qaoa_depth == 4
    assert config.quantum_threshold_nodes == 500
    assert config.noise_mitigation == "ZNE"
    
    # Check auto Grover iterations formula pi/4 * sqrt(N/M)
    iters = QuantumConfig.calculate_grover_iterations(num_items=16, num_targets=1)
    assert iters == 3  # round(pi/4 * 4) = 3


def test_qiskit_adapter_backends():
    adapter = QiskitAdapter()
    backends = adapter.get_available_backends()
    backend_names = [b["name"] for b in backends]
    assert "aer_simulator" in backend_names
    assert "ibm_brisbane" in backend_names
    assert "statevector_simulator" in backend_names


def test_grover_graph_search_execution():
    engine = QuantumGraphSearchEngine()
    nodes = [
        {"address": "0x1111111111111111111111111111111111111111", "risk_score": 0.1, "is_flagged": False},
        {"address": "0x2222222222222222222222222222222222222222", "risk_score": 0.2, "is_flagged": False},
        {"address": "0x3333333333333333333333333333333333333333", "risk_score": 0.95, "is_flagged": True},
        {"address": "0x4444444444444444444444444444444444444444", "risk_score": 0.05, "is_flagged": False},
    ]
    
    result = engine.search_graph(
        nodes=nodes,
        quantum_backend="aer_simulator",
        grover_iterations="auto",
        shot_count=1024,
        noise_mitigation="ZNE",
        quantum_threshold_nodes=500
    )
    
    assert result["status"] == "SUCCESS"
    assert result["qubits_used"] >= 2
    assert len(result["top_candidates"]) == 4
    # The marked target node should have the highest quantum confidence
    top_node = result["top_candidates"][0]
    assert top_node["address"] == "0x3333333333333333333333333333333333333333"
    assert top_node["quantum_confidence"] > 0


def test_qaoa_path_optimizer():
    optimizer = QAOAPathOptimizer()
    nodes = [
        {"address": "0xaaa", "risk_score": 0.8},
        {"address": "0xbbb", "risk_score": 0.9},
        {"address": "0xccc", "risk_score": 0.85},
        {"address": "0xddd", "risk_score": 0.1}
    ]
    edges = [
        {"from_address": "0xaaa", "to_address": "0xbbb", "value": 10.0},
        {"from_address": "0xbbb", "to_address": "0xccc", "value": 8.5},
        {"from_address": "0xccc", "to_address": "0xddd", "value": 0.5}
    ]
    
    result = optimizer.optimize_laundering_path(
        nodes=nodes,
        edges=edges,
        qaoa_depth=3,
        quantum_backend="aer_simulator",
        shot_count=1024,
        noise_mitigation="ZNE"
    )
    
    assert result["status"] == "SUCCESS"
    assert result["qaoa_depth_layers"] == 3
    assert result["approximation_ratio"] >= 0.8
    assert len(result["optimal_laundering_path"]) > 0


def test_quantum_walk_clustering():
    engine = QuantumWalkClustering()
    nodes = [{"address": f"0x{i:040x}", "risk_score": 0.1 * i} for i in range(6)]
    edges = [{"from_address": f"0x{i:040x}", "to_address": f"0x{(i+1)%6:040x}", "value": 1.0} for i in range(6)]
    
    result = engine.detect_communities(nodes=nodes, edges=edges, evolution_time=1.5, num_clusters=2)
    assert result["status"] == "SUCCESS"
    assert result["cluster_count"] == 2
    assert len(result["clusters"]) == 2


def test_api_quantum_graph_search():
    payload = {
        "nodes": [
            {"address": "0x1111111111111111111111111111111111111111", "risk_score": 0.1},
            {"address": "0x2222222222222222222222222222222222222222", "risk_score": 0.99, "is_flagged": True}
        ],
        "quantum_backend": "aer_simulator",
        "grover_iterations": "auto",
        "qaoa_depth": 3,
        "quantum_threshold_nodes": 500,
        "shot_count": 1024,
        "noise_mitigation": "ZNE"
    }
    response = client.post("/api/quantum/graph-search", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "SUCCESS"
    assert data["search_space_size_N"] >= 2
    assert data["backend_telemetry"]["noise_mitigation"] == "ZNE"


def test_api_quantum_backends():
    response = client.get("/api/quantum/backends")
    assert response.status_code == 200
    data = response.json()
    assert "backends" in data
    assert any(b["name"] == "aer_simulator" for b in data["backends"])


def test_api_quantum_config():
    response = client.get("/api/quantum/config")
    assert response.status_code == 200
    data = response.json()
    assert data["quantum_backend"] == "aer_simulator"
    assert data["shot_count"] == 1024
    assert data["quantum_threshold_nodes"] == 500
