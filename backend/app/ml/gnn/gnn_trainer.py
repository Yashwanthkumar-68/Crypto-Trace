"""
GNN Training Pipeline for GraphSAGE, GAT, and Temporal GNN Models.

Handles network graph feature extraction, PyTorch tensor construction, supervised
node classification loss, contrastive similarity loss, and model checkpointing.
"""

import logging
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Union

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim

from app.config import settings
from app.ml.gnn.graph_sage_model import GraphSAGEModel
from app.ml.gnn.gat_model import GATModel
from app.ml.gnn.temporal_gnn import TemporalGNN

logger = logging.getLogger(__name__)


class GNNTrainer:
    """
    Trainer for GNN architectures (GraphSAGE, GAT, TGN).
    
    Parameters:
    - model_type: "graphsage", "gat", or "tgn"
    - in_channels: Node feature vector dimension (default: 32)
    - embedding_dim: Target GNN embedding dimension (default: 128)
    - num_layers: Number of GNN layers (default: 3)
    - attention_heads: Attention heads for GAT (default: 8)
    - dropout: Dropout rate (default: 0.2)
    - time_dim: Time encoding dimension for TGN (default: 64)
    - lr: Learning rate (default: 0.001)
    - weight_decay: L2 penalty (default: 1e-4)
    """

    def __init__(
        self,
        model_type: str = "graphsage",
        in_channels: int = 32,
        embedding_dim: int = getattr(settings, "GNN_EMBEDDING_DIM", 128),
        num_layers: int = getattr(settings, "GNN_LAYERS", 3),
        attention_heads: int = getattr(settings, "GNN_ATTENTION_HEADS", 8),
        dropout: float = getattr(settings, "GNN_DROPOUT", 0.2),
        time_dim: int = getattr(settings, "TEMPORAL_TIME_ENCODING_DIM", 64),
        lr: float = 0.001,
        weight_decay: float = 1e-4,
        device: Optional[str] = None
    ):
        self.model_type = model_type.lower()
        self.in_channels = in_channels
        self.embedding_dim = embedding_dim
        self.num_layers = num_layers
        self.attention_heads = attention_heads
        self.dropout = dropout
        self.time_dim = time_dim
        self.lr = lr
        self.weight_decay = weight_decay

        self.device = torch.device(device if device else ("cuda" if torch.cuda.is_available() else "cpu"))
        self.model = self._build_model().to(self.device)
        self.optimizer = optim.AdamW(self.model.parameters(), lr=self.lr, weight_decay=self.weight_decay)
        self.criterion = nn.CrossEntropyLoss()

    def _build_model(self) -> nn.Module:
        """Instantiates specified GNN model architecture."""
        if self.model_type == "gat":
            return GATModel(
                in_channels=self.in_channels,
                hidden_channels=self.embedding_dim,
                out_channels=self.embedding_dim,
                num_layers=self.num_layers,
                heads=self.attention_heads,
                dropout=self.dropout,
                num_classes=2
            )
        elif self.model_type == "tgn":
            return TemporalGNN(
                in_channels=self.in_channels,
                time_dim=self.time_dim,
                hidden_channels=self.embedding_dim,
                out_channels=self.embedding_dim,
                num_layers=self.num_layers,
                dropout=self.dropout,
                num_classes=2
            )
        else:
            return GraphSAGEModel(
                in_channels=self.in_channels,
                hidden_channels=self.embedding_dim,
                out_channels=self.embedding_dim,
                num_layers=self.num_layers,
                dropout=self.dropout,
                num_classes=2
            )

    def extract_node_features(self, nodes_data: List[Dict[str, Any]]) -> torch.Tensor:
        """
        Converts list of node metadata dicts into a normalized 32-d feature tensor.
        """
        features = []
        for n in nodes_data:
            tx_count = float(n.get("transaction_count", 0))
            in_count = float(n.get("incoming_count", 0))
            out_count = float(n.get("outgoing_count", 0))
            in_val = float(n.get("total_incoming_value", 0.0))
            out_val = float(n.get("total_outgoing_value", 0.0))
            hops = float(n.get("hops_from_root", 0))
            is_root = 1.0 if n.get("is_root", False) else 0.0
            
            # Simple feature representation vector padded to in_channels (32)
            raw_feat = [
                tx_count, in_count, out_count,
                in_val, out_val, hops, is_root,
                in_val / (out_val + 1e-5),
                in_count / (tx_count + 1e-5),
                out_count / (tx_count + 1e-5),
            ]
            # Pad or truncate to in_channels
            raw_feat += [0.0] * (self.in_channels - len(raw_feat))
            features.append(raw_feat[:self.in_channels])

        feat_tensor = torch.tensor(features, dtype=torch.float32)
        # Normalize features
        mean = feat_tensor.mean(dim=0, keepdim=True)
        std = feat_tensor.std(dim=0, keepdim=True) + 1e-6
        return (feat_tensor - mean) / std

    def train_epoch(
        self,
        x: torch.Tensor,
        edge_index: torch.Tensor,
        labels: torch.Tensor,
        timestamps: Optional[torch.Tensor] = None,
        train_mask: Optional[torch.Tensor] = None
    ) -> Dict[str, float]:
        """
        Executes a single training epoch.
        """
        self.model.train()
        self.optimizer.zero_grad()

        x = x.to(self.device)
        edge_index = edge_index.to(self.device)
        labels = labels.to(self.device)
        if timestamps is not None:
            timestamps = timestamps.to(self.device)

        if self.model_type == "tgn":
            logits = self.model(x, edge_index, timestamps=timestamps)
        else:
            logits = self.model(x, edge_index)

        if train_mask is not None:
            loss = self.criterion(logits[train_mask], labels[train_mask])
            pred = logits[train_mask].argmax(dim=-1)
            target = labels[train_mask]
        else:
            loss = self.criterion(logits, labels)
            pred = logits.argmax(dim=-1)
            target = labels

        loss.backward()
        self.optimizer.step()

        acc = (pred == target).float().mean().item()
        return {"loss": float(loss.item()), "accuracy": float(acc)}

    def evaluate(
        self,
        x: torch.Tensor,
        edge_index: torch.Tensor,
        labels: torch.Tensor,
        timestamps: Optional[torch.Tensor] = None,
        eval_mask: Optional[torch.Tensor] = None
    ) -> Dict[str, float]:
        """
        Evaluates current model performance.
        """
        self.model.eval()
        with torch.no_grad():
            x = x.to(self.device)
            edge_index = edge_index.to(self.device)
            labels = labels.to(self.device)
            if timestamps is not None:
                timestamps = timestamps.to(self.device)

            if self.model_type == "tgn":
                logits = self.model(x, edge_index, timestamps=timestamps)
            else:
                logits = self.model(x, edge_index)

            probs = torch.softmax(logits, dim=-1)[:, 1]

            if eval_mask is not None:
                logits = logits[eval_mask]
                labels = labels[eval_mask]
                probs = probs[eval_mask]

            loss = self.criterion(logits, labels).item()
            pred = logits.argmax(dim=-1)
            acc = (pred == labels).float().mean().item()

            return {
                "loss": float(loss),
                "accuracy": float(acc),
                "illicit_prob_mean": float(probs.mean().item())
            }

    def save_checkpoint(self, path: str):
        """Saves model weights and optimizer state."""
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        torch.save({
            "model_type": self.model_type,
            "model_state_dict": self.model.state_dict(),
            "optimizer_state_dict": self.optimizer.state_dict(),
            "in_channels": self.in_channels,
            "embedding_dim": self.embedding_dim,
            "num_layers": self.num_layers,
            "attention_heads": self.attention_heads,
            "dropout": self.dropout,
            "time_dim": self.time_dim,
        }, path)

    def load_checkpoint(self, path: str):
        """Loads model weights and state."""
        if not os.path.exists(path):
            logger.error(f"Checkpoint {path} not found.")
            return
        checkpoint = torch.load(path, map_location=self.device)
        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.optimizer.load_state_dict(checkpoint["optimizer_state_dict"])
