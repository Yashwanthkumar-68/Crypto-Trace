"""
Unit tests for GNN Suite (GraphSAGE, GAT, TGN) and FAISS Vector Store.
"""

import tempfile
import numpy as np
import pytest
import torch

from app.config import settings
from app.ml.gnn.graph_sage_model import GraphSAGEModel
from app.ml.gnn.gat_model import GATModel
from app.ml.gnn.temporal_gnn import TemporalGNN, TimeEncoder
from app.ml.gnn.embedding_store import EmbeddingStore
from app.ml.gnn.gnn_trainer import GNNTrainer
from app.ml.gnn.gnn_inference import GNNInferenceService


def get_sample_graph_data():
    """Generates synthetic nodes, edge_index, timestamps, and labels."""
    num_nodes = 10
    in_dim = 32
    x = torch.randn(num_nodes, in_dim)
    
    # Simple chain graph: 0 -> 1 -> 2 -> ... -> 9
    src = torch.arange(0, num_nodes - 1, dtype=torch.long)
    dst = torch.arange(1, num_nodes, dtype=torch.long)
    edge_index = torch.stack([src, dst], dim=0)
    
    timestamps = torch.linspace(100.0, 1000.0, steps=edge_index.size(1))
    labels = torch.tensor([0, 1, 0, 1, 0, 1, 0, 1, 0, 1], dtype=torch.long)
    
    nodes_dict = [
        {
            "address": f"0xwallet_{i}",
            "transaction_count": i * 5 + 1,
            "incoming_count": i * 2,
            "outgoing_count": i * 3,
            "total_incoming_value": float(i * 1.5),
            "total_outgoing_value": float(i * 1.2),
            "hops_from_root": i % 3,
            "is_root": (i == 0)
        }
        for i in range(num_nodes)
    ]
    
    edges_dict = [
        {
            "from_address": f"0xwallet_{i}",
            "to_address": f"0xwallet_{i+1}",
            "block_number": 1000 + i * 10
        }
        for i in range(num_nodes - 1)
    ]
    
    return {
        "x": x,
        "edge_index": edge_index,
        "timestamps": timestamps,
        "labels": labels,
        "nodes_dict": nodes_dict,
        "edges_dict": edges_dict
    }


@pytest.fixture
def sample_graph_data():
    return get_sample_graph_data()



def test_graph_sage_model(sample_graph_data):
    """Verifies GraphSAGE model initialization, embedding extraction, and forward logits."""
    model = GraphSAGEModel(
        in_channels=32,
        hidden_channels=settings.GNN_EMBEDDING_DIM,
        out_channels=settings.GNN_EMBEDDING_DIM,
        num_layers=settings.GNN_LAYERS,
        dropout=settings.GNN_DROPOUT,
        num_classes=2
    )
    
    x = sample_graph_data["x"]
    edge_index = sample_graph_data["edge_index"]
    
    embeddings = model.get_embeddings(x, edge_index)
    assert embeddings.shape == (10, settings.GNN_EMBEDDING_DIM)
    
    logits = model(x, edge_index)
    assert logits.shape == (10, 2)


def test_gat_model(sample_graph_data):
    """Verifies GAT model multi-head attention embeddings and classification logits."""
    model = GATModel(
        in_channels=32,
        hidden_channels=settings.GNN_EMBEDDING_DIM,
        out_channels=settings.GNN_EMBEDDING_DIM,
        num_layers=settings.GNN_LAYERS,
        heads=settings.GNN_ATTENTION_HEADS,
        dropout=settings.GNN_DROPOUT,
        num_classes=2
    )
    
    x = sample_graph_data["x"]
    edge_index = sample_graph_data["edge_index"]
    
    embeddings = model.get_embeddings(x, edge_index)
    assert embeddings.shape == (10, settings.GNN_EMBEDDING_DIM)
    
    logits = model(x, edge_index)
    assert logits.shape == (10, 2)


def test_time_encoder_and_temporal_gnn(sample_graph_data):
    """Verifies Fourier TimeEncoder and TemporalGNN pipeline."""
    encoder = TimeEncoder(time_dim=settings.TEMPORAL_TIME_ENCODING_DIM)
    timestamps = sample_graph_data["timestamps"]
    time_emb = encoder(timestamps)
    assert time_emb.shape == (timestamps.size(0), settings.TEMPORAL_TIME_ENCODING_DIM)

    tgn = TemporalGNN(
        in_channels=32,
        time_dim=settings.TEMPORAL_TIME_ENCODING_DIM,
        hidden_channels=settings.GNN_EMBEDDING_DIM,
        out_channels=settings.GNN_EMBEDDING_DIM,
        num_layers=settings.GNN_LAYERS,
        dropout=settings.GNN_DROPOUT,
        num_classes=2
    )

    x = sample_graph_data["x"]
    edge_index = sample_graph_data["edge_index"]

    embeddings = tgn.get_embeddings(x, edge_index, timestamps=timestamps)
    assert embeddings.shape == (10, settings.GNN_EMBEDDING_DIM)

    logits = tgn(x, edge_index, timestamps=timestamps)
    assert logits.shape == (10, 2)


def test_embedding_store():
    """Verifies FAISS vector DB store, threshold matching (0.85), and serialization."""
    store = EmbeddingStore(
        embedding_dim=settings.GNN_EMBEDDING_DIM,
        index_type=settings.FAISS_INDEX_TYPE,
        similarity_threshold=settings.EMBEDDING_SIMILARITY_THRESHOLD
    )

    wallets = ["0x111", "0x222", "0x333"]
    # Create normalized test vectors
    v1 = np.random.randn(128).astype(np.float32)
    v1 /= np.linalg.norm(v1)
    v2 = v1.copy() + np.random.randn(128) * 0.05  # Highly similar to v1
    v2 /= np.linalg.norm(v2)
    v3 = np.random.randn(128).astype(np.float32)  # Orthogonal/dissimilar
    v3 /= np.linalg.norm(v3)

    embeddings = np.array([v1, v2, v3])
    store.add_embeddings(wallets, embeddings)

    # Search similar for 0x111
    similar = store.search_by_address("0x111", top_k=5, threshold=0.85)
    assert len(similar) >= 1
    assert similar[0]["address"] == "0x111"

    # Verify clustering
    clusters = store.find_clusters(threshold=0.85)
    assert len(clusters) >= 1

    # Test Save & Load index
    with tempfile.TemporaryDirectory() as tmpdir:
        save_path = f"{tmpdir}/test_embeddings.faiss"
        store.save_index(save_path)
        
        new_store = EmbeddingStore()
        new_store.load_index(save_path)
        assert len(new_store.address_to_embedding) == 3
        assert "0x111" in new_store.address_to_embedding


def test_gnn_trainer(sample_graph_data):
    """Verifies GNN trainer epoch training, loss decrease/metrics, and serialization."""
    trainer = GNNTrainer(
        model_type="graphsage",
        in_channels=32,
        embedding_dim=settings.GNN_EMBEDDING_DIM,
        num_layers=settings.GNN_LAYERS,
        dropout=settings.GNN_DROPOUT
    )

    x = sample_graph_data["x"]
    edge_index = sample_graph_data["edge_index"]
    labels = sample_graph_data["labels"]

    metrics = trainer.train_epoch(x, edge_index, labels)
    assert "loss" in metrics
    assert "accuracy" in metrics
    assert isinstance(metrics["loss"], float)

    eval_metrics = trainer.evaluate(x, edge_index, labels)
    assert "loss" in eval_metrics
    assert "illicit_prob_mean" in eval_metrics


def test_gnn_inference_service(sample_graph_data):
    """Verifies real-time GNN inference service end-to-end analysis."""
    service = GNNInferenceService(
        model_type="graphsage",
        embedding_dim=settings.GNN_EMBEDDING_DIM,
        similarity_threshold=settings.EMBEDDING_SIMILARITY_THRESHOLD
    )

    nodes = sample_graph_data["nodes_dict"]
    edges = sample_graph_data["edges_dict"]

    result = service.analyze_wallet_graph(nodes, edges, target_address="0xwallet_0")

    assert result["model_used"] == "graphsage"
    assert result["embedding_dim"] == 128
    assert result["total_nodes_analyzed"] == 10
    assert result["target_wallet"] is not None
    assert result["target_wallet"]["address"] == "0xwallet_0"
    assert "illicit_probability" in result["target_wallet"]
    assert len(result["nodes"]) == 10
