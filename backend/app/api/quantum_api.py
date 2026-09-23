"""
Quantum Computing API Endpoints.
Provides Grover's Graph Search, QAOA Laundering Path Optimization,
Quantum Walk Community Detection, and IBM Quantum Backend Management.
"""

import logging
from typing import List, Dict, Any, Optional, Union
from fastapi import APIRouter, Depends, Query, Body, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.quantum.quantum_config import QuantumConfig, QuantumBackendType, NoiseMitigationStrategy
from app.quantum.qiskit_adapter import QiskitAdapter
from app.quantum.quantum_graph_search import QuantumGraphSearchEngine
from app.quantum.qaoa_path_optimizer import QAOAPathOptimizer
from app.quantum.quantum_walk_clustering import QuantumWalkClustering
from app.graph.graph_service import GraphService

logger = logging.getLogger("api.quantum")
router = APIRouter(prefix="/quantum", tags=["Quantum Computing"])


class QuantumGraphSearchRequest(BaseModel):
    wallet_address: Optional[str] = Field(
        None,
        description="Optional focal wallet address to extract graph subgraph from database"
    )
    nodes: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="List of graph nodes with address, risk_score, is_flagged, etc."
    )
    edges: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="List of transaction edges"
    )
    target_criteria: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Criteria for Grover oracle marking (e.g. {'is_fraud': True}, {'min_risk': 0.8})"
    )
    quantum_backend: Optional[str] = Field(
        "aer_simulator",
        description="Quantum execution backend: 'aer_simulator', 'ibm_brisbane', 'ibm_kyiv', etc."
    )
    grover_iterations: Optional[Union[str, int]] = Field(
        "auto",
        description="Iteration count: 'auto' (pi/4 * sqrt(N)) or explicit integer"
    )
    qaoa_depth: Optional[int] = Field(
        3,
        ge=1,
        le=6,
        description="QAOA layer depth (3 to 6 layers)"
    )
    quantum_threshold_nodes: Optional[int] = Field(
        500,
        ge=1,
        description="Node count threshold (500+) triggering quantum acceleration"
    )
    shot_count: Optional[int] = Field(
        1024,
        ge=1,
        le=100000,
        description="Number of quantum shots (repetitions)"
    )
    noise_mitigation: Optional[str] = Field(
        "ZNE",
        description="Noise mitigation strategy: 'ZNE' (Zero-Noise Extrapolation) or 'PEC' (Probabilistic Error Cancellation)"
    )


class QAOAPathRequest(BaseModel):
    nodes: Optional[List[Dict[str, Any]]] = None
    edges: Optional[List[Dict[str, Any]]] = None
    wallet_address: Optional[str] = None
    qaoa_depth: int = Field(3, ge=1, le=6, description="QAOA depth layers (3-6)")
    quantum_backend: Optional[str] = "aer_simulator"
    shot_count: int = Field(1024, ge=1, le=100000)
    noise_mitigation: Optional[str] = "ZNE"


class QuantumWalkRequest(BaseModel):
    nodes: Optional[List[Dict[str, Any]]] = None
    edges: Optional[List[Dict[str, Any]]] = None
    wallet_address: Optional[str] = None
    evolution_time: float = Field(1.5, ge=0.1, le=10.0)
    num_clusters: int = Field(3, ge=2, le=10)


@router.post("/graph-search")
def quantum_graph_search(
    request: QuantumGraphSearchRequest = Body(...),
    db: Session = Depends(get_db)
):
    """
    POST /api/quantum/graph-search
    Executes Grover's quantum search over graph adjacency matrices with automatic
    node threshold trigger (500+ nodes) and quadratic speedup O(sqrt(N)).
    """
    nodes = request.nodes
    edges = request.edges

    # If wallet_address provided and nodes not explicitly supplied, extract from database graph
    if not nodes and request.wallet_address:
        try:
            graph_data = GraphService.build_wallet_graph(
                db=db,
                wallet_address=request.wallet_address,
                max_hops=3
            )
            nodes = [n.dict() if hasattr(n, 'dict') else n for n in graph_data.nodes]
            edges = [e.dict() if hasattr(e, 'dict') else e for e in graph_data.edges]
        except Exception as e:
            logger.warning(f"Could not build DB graph for {request.wallet_address}: {e}")

    # Fallback to default mock nodes if empty
    if not nodes:
        nodes = [
            {"address": f"0x{i:040x}", "risk_score": 0.1 * (i % 10), "is_flagged": (i == 7)}
            for i in range(16)
        ]

    config = QuantumConfig(
        quantum_backend=QuantumBackendType(request.quantum_backend) if request.quantum_backend in QuantumBackendType.__members__.values() else QuantumBackendType.AER_SIMULATOR,
        shot_count=request.shot_count or 1024,
        qaoa_depth=request.qaoa_depth or 3,
        quantum_threshold_nodes=request.quantum_threshold_nodes or 500,
        noise_mitigation=NoiseMitigationStrategy(request.noise_mitigation) if request.noise_mitigation in ["ZNE", "PEC", "None"] else NoiseMitigationStrategy.ZNE
    )

    search_engine = QuantumGraphSearchEngine(config)
    result = search_engine.search_graph(
        nodes=nodes,
        edges=edges,
        target_criteria=request.target_criteria,
        quantum_backend=request.quantum_backend,
        grover_iterations=request.grover_iterations,
        shot_count=request.shot_count,
        noise_mitigation=request.noise_mitigation,
        quantum_threshold_nodes=request.quantum_threshold_nodes
    )
    return result


@router.post("/qaoa-path")
def qaoa_laundering_path(
    request: QAOAPathRequest = Body(...),
    db: Session = Depends(get_db)
):
    """
    POST /api/quantum/qaoa-path
    Solves Hamiltonian QUBO using QAOA (3-6 layers) for optimal money laundering path discovery.
    """
    nodes = request.nodes
    edges = request.edges

    if not nodes and request.wallet_address:
        try:
            graph_data = GraphService.build_wallet_graph(db=db, wallet_address=request.wallet_address, max_hops=3)
            nodes = [n.dict() if hasattr(n, 'dict') else n for n in graph_data.nodes]
            edges = [e.dict() if hasattr(e, 'dict') else e for e in graph_data.edges]
        except Exception:
            pass

    if not nodes:
        nodes = [{"address": f"0x{i:040x}", "risk_score": 0.2 * i} for i in range(6)]
        edges = [{"from_address": f"0x{i:040x}", "to_address": f"0x{(i+1)%6:040x}", "value": 2.5} for i in range(6)]

    config = QuantumConfig(
        shot_count=request.shot_count,
        qaoa_depth=request.qaoa_depth
    )
    optimizer = QAOAPathOptimizer(config)
    return optimizer.optimize_laundering_path(
        nodes=nodes,
        edges=edges,
        qaoa_depth=request.qaoa_depth,
        quantum_backend=request.quantum_backend,
        shot_count=request.shot_count,
        noise_mitigation=request.noise_mitigation
    )


@router.post("/quantum-walk-clustering")
def quantum_walk_clustering(
    request: QuantumWalkRequest = Body(...),
    db: Session = Depends(get_db)
):
    """
    POST /api/quantum/quantum-walk-clustering
    Continuous-Time Quantum Walk graph Laplacian community clustering.
    """
    nodes = request.nodes
    edges = request.edges

    if not nodes and request.wallet_address:
        try:
            graph_data = GraphService.build_wallet_graph(db=db, wallet_address=request.wallet_address, max_hops=3)
            nodes = [n.dict() if hasattr(n, 'dict') else n for n in graph_data.nodes]
            edges = [e.dict() if hasattr(e, 'dict') else e for e in graph_data.edges]
        except Exception:
            pass

    if not nodes:
        nodes = [{"address": f"0x{i:040x}", "risk_score": 0.15 * i} for i in range(8)]
        edges = [{"from_address": f"0x{i:040x}", "to_address": f"0x{(i+1)%8:040x}", "value": 1.0} for i in range(8)]

    clustering_engine = QuantumWalkClustering()
    return clustering_engine.detect_communities(
        nodes=nodes,
        edges=edges,
        evolution_time=request.evolution_time,
        num_clusters=request.num_clusters
    )


@router.get("/backends")
def list_quantum_backends():
    """
    GET /api/quantum/backends
    Returns available quantum simulators and IBM Quantum QPUs (ibm_brisbane, etc.).
    """
    adapter = QiskitAdapter()
    return {
        "status": "online",
        "backends": adapter.get_available_backends(),
        "supported_noise_mitigation": ["ZNE", "PEC"],
        "default_backend": QuantumBackendType.AER_SIMULATOR.value
    }


@router.get("/config")
def get_quantum_configuration():
    """
    GET /api/quantum/config
    Returns current quantum system configuration and parameters.
    """
    config = QuantumConfig()
    return {
        "quantum_backend": config.quantum_backend.value,
        "shot_count": config.shot_count,
        "qaoa_depth_default": config.qaoa_depth,
        "quantum_threshold_nodes": config.quantum_threshold_nodes,
        "noise_mitigation_default": config.noise_mitigation.value if config.noise_mitigation else "None",
        "optimization_level": config.optimization_level,
        "resilience_level": config.resilience_level
    }
