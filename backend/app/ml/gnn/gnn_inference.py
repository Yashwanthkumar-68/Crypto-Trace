"""
Real-Time GNN Inference Service for Blockchain Wallet Analysis.

Converts transaction network subgraphs into PyTorch representations, generates 128-d wallet
embeddings via GraphSAGE/GAT/TGN, indexes them in FAISS EmbeddingStore, and identifies illicit clusters.
"""

import logging
from typing import Dict, List, Optional, Tuple, Any

import numpy as np
import torch
import torch.nn.functional as F

from app.config import settings
from app.ml.gnn.graph_sage_model import GraphSAGEModel
from app.ml.gnn.gat_model import GATModel
from app.ml.gnn.temporal_gnn import TemporalGNN
from app.ml.gnn.embedding_store import EmbeddingStore

logger = logging.getLogger(__name__)


class GNNInferenceService:
    """
    Inference service for real-time GNN analysis.
    
    Parameters:
    - model_type: Default architecture ("graphsage", "gat", or "tgn")
    - embedding_dim: Output dimension (default: 128, GNN_EMBEDDING_DIM)
    - similarity_threshold: Threshold for clustering (default: 0.85, EMBEDDING_SIMILARITY_THRESHOLD)
    - store: Pre-instantiated or custom EmbeddingStore instance
    """

    def __init__(
        self,
        model_type: str = "graphsage",
        embedding_dim: int = getattr(settings, "GNN_EMBEDDING_DIM", 128),
        similarity_threshold: float = getattr(settings, "EMBEDDING_SIMILARITY_THRESHOLD", 0.85),
        store: Optional[EmbeddingStore] = None,
        device: Optional[str] = None
    ):
        self.model_type = model_type.lower()
        self.embedding_dim = embedding_dim
        self.similarity_threshold = similarity_threshold
        self.device = torch.device(device if device else ("cuda" if torch.cuda.is_available() else "cpu"))

        # Models dict for supporting multi-model inference
        self.models: Dict[str, torch.nn.Module] = {}
        self._init_models()

        # Vector embedding store
        self.store = store if store is not None else EmbeddingStore(
            embedding_dim=self.embedding_dim,
            index_type=getattr(settings, "FAISS_INDEX_TYPE", "IVFFlat"),
            similarity_threshold=self.similarity_threshold
        )

    def _init_models(self):
        """Initializes model instances."""
        in_dim = 32
        h_dim = self.embedding_dim
        layers = getattr(settings, "GNN_LAYERS", 3)
        heads = getattr(settings, "GNN_ATTENTION_HEADS", 8)
        dropout = getattr(settings, "GNN_DROPOUT", 0.2)
        time_dim = getattr(settings, "TEMPORAL_TIME_ENCODING_DIM", 64)

        self.models["graphsage"] = GraphSAGEModel(
            in_channels=in_dim, hidden_channels=h_dim, out_channels=h_dim,
            num_layers=layers, dropout=dropout
        ).to(self.device)

        self.models["gat"] = GATModel(
            in_channels=in_dim, hidden_channels=h_dim, out_channels=h_dim,
            num_layers=layers, heads=heads, dropout=dropout
        ).to(self.device)

        self.models["tgn"] = TemporalGNN(
            in_channels=in_dim, time_dim=time_dim, hidden_channels=h_dim,
            out_channels=h_dim, num_layers=layers, dropout=dropout
        ).to(self.device)

        for m in self.models.values():
            m.eval()

    def build_tensor_graph(self, nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor, List[str]]:
        """
        Converts list of node and edge dictionaries into PyTorch tensors.
        
        Returns:
        - x: [num_nodes, 32] node feature tensor
        - edge_index: [2, num_edges] edge index tensor
        - timestamps: [num_edges] edge timestamp tensor
        - address_list: List of wallet address strings aligned with tensor indices
        """
        address_list = []
        addr_to_idx = {}

        for idx, node in enumerate(nodes):
            addr = node.get("address", node.get("id", f"node_{idx}")).lower()
            address_list.append(addr)
            addr_to_idx[addr] = idx

        # Extract features (32-d)
        features = []
        for node in nodes:
            tx_count = float(node.get("transaction_count", 0))
            in_count = float(node.get("incoming_count", 0))
            out_count = float(node.get("outgoing_count", 0))
            in_val = float(node.get("total_incoming_value", 0.0))
            out_val = float(node.get("total_outgoing_value", 0.0))
            hops = float(node.get("hops_from_root", 0))
            is_root = 1.0 if node.get("is_root", False) else 0.0

            raw = [
                tx_count, in_count, out_count, in_val, out_val, hops, is_root,
                in_val / (out_val + 1e-5),
                in_count / (tx_count + 1e-5),
                out_count / (tx_count + 1e-5),
            ]
            raw += [0.0] * (32 - len(raw))
            features.append(raw[:32])

        if features:
            x = torch.tensor(features, dtype=torch.float32)
            mean = x.mean(dim=0, keepdim=True)
            std = x.std(dim=0, keepdim=True) + 1e-6
            x = (x - mean) / std
        else:
            x = torch.zeros((0, 32), dtype=torch.float32)

        # Build edge index & timestamps
        src_indices = []
        dst_indices = []
        t_list = []

        for edge in edges:
            src = edge.get("from_address", edge.get("source", "")).lower()
            dst = edge.get("to_address", edge.get("target", "")).lower()
            ts = float(edge.get("block_number", edge.get("timestamp", 0.0)))

            if src in addr_to_idx and dst in addr_to_idx:
                src_indices.append(addr_to_idx[src])
                dst_indices.append(addr_to_idx[dst])
                t_list.append(ts)

        if src_indices:
            edge_index = torch.tensor([src_indices, dst_indices], dtype=torch.long)
            timestamps = torch.tensor(t_list, dtype=torch.float32)
        else:
            edge_index = torch.zeros((2, 0), dtype=torch.long)
            timestamps = torch.zeros((0,), dtype=torch.float32)

        return x, edge_index, timestamps, address_list

    def analyze_wallet_graph(
        self,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
        target_address: Optional[str] = None,
        model_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executes real-time GNN inference over a transaction graph.
        
        1. Builds tensor representations.
        2. Obtains node embeddings and illicit probability scores.
        3. Indexes node embeddings in FAISS EmbeddingStore.
        4. Identifies similar wallet clusters above threshold (0.85).
        """
        arch = (model_type or self.model_type).lower()
        model = self.models.get(arch, self.models["graphsage"])

        x, edge_index, timestamps, address_list = self.build_tensor_graph(nodes, edges)

        x = x.to(self.device)
        edge_index = edge_index.to(self.device)
        timestamps = timestamps.to(self.device)

        with torch.no_grad():
            if arch == "tgn":
                embeddings = model.get_embeddings(x, edge_index, timestamps=timestamps)
                logits = model(x, edge_index, timestamps=timestamps)
            else:
                embeddings = model.get_embeddings(x, edge_index)
                logits = model(x, edge_index)

            probs = F.softmax(logits, dim=-1)[:, 1].cpu().numpy()
            emb_np = embeddings.cpu().numpy()

        # Update FAISS Store with computed node embeddings
        if address_list:
            self.store.add_embeddings(address_list, emb_np)

        # Build results for nodes
        node_results = []
        for idx, addr in enumerate(address_list):
            prob = float(probs[idx]) if idx < len(probs) else 0.0
            vec = emb_np[idx]
            
            # Find similar wallets in vector store
            similar = self.store.search_similar(vec, top_k=5, threshold=self.similarity_threshold)
            
            node_results.append({
                "address": addr,
                "illicit_probability": prob,
                "risk_level": "HIGH" if prob > 0.7 else ("MEDIUM" if prob > 0.3 else "LOW"),
                "embedding": vec.tolist(),
                "similar_wallets": [s for s in similar if s["address"] != addr]
            })

        target_info = None
        if target_address:
            clean_target = target_address.lower()
            target_info = next((n for n in node_results if n["address"] == clean_target), None)

        clusters = self.store.find_clusters(threshold=self.similarity_threshold)

        return {
            "model_used": arch,
            "embedding_dim": self.embedding_dim,
            "total_nodes_analyzed": len(address_list),
            "target_wallet": target_info,
            "nodes": node_results,
            "illicit_clusters": [c for c in clusters if len(c) > 1]
        }

    def find_similar_wallets(self, wallet_address: str, top_k: int = 10, threshold: Optional[float] = None) -> List[Dict[str, Any]]:
        """Queries FAISS store for wallets similar to specified address."""
        return self.store.search_by_address(wallet_address, top_k=top_k, threshold=threshold)

    def detect_illicit_clusters(self, threshold: Optional[float] = None) -> List[List[str]]:
        """Extracts similarity clusters above specified threshold (default: 0.85)."""
        return self.store.find_clusters(threshold=threshold)
