"""
GraphSAGE Architecture Module for Wallet Fraud Detection.

Uses GraphSAGE (Sample and Aggregate) to compute localized structural embeddings
for nodes in blockchain transaction graphs.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F

try:
    from torch_geometric.nn import SAGEConv
    HAS_PYG = True
except ImportError:
    HAS_PYG = False
    SAGEConv = None


class FallbackSAGEConv(nn.Module):
    """Fallback GraphSAGE convolution layer using PyTorch when PyG is not available."""

    def __init__(self, in_channels: int, out_channels: int, aggr: str = "mean"):
        super().__init__()
        self.in_channels = in_channels
        self.out_channels = out_channels
        self.aggr = aggr
        self.lin_self = nn.Linear(in_channels, out_channels, bias=False)
        self.lin_neigh = nn.Linear(in_channels, out_channels, bias=True)

    def forward(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        num_nodes = x.size(0)
        out_neigh = torch.zeros(num_nodes, self.in_channels, device=x.device, dtype=x.dtype)
        
        if edge_index.numel() > 0:
            src, dst = edge_index[0], edge_index[1]
            deg = torch.zeros(num_nodes, device=x.device, dtype=x.dtype)
            deg.scatter_add_(0, dst, torch.ones_like(dst, dtype=x.dtype))
            deg = torch.clamp(deg, min=1.0)
            
            # Aggregate neighbors
            aggregated = torch.zeros(num_nodes, self.in_channels, device=x.device, dtype=x.dtype)
            aggregated.index_add_(0, dst, x[src])
            out_neigh = aggregated / deg.unsqueeze(-1)
        
        h_self = self.lin_self(x)
        h_neigh = self.lin_neigh(out_neigh)
        return h_self + h_neigh


class GraphSAGEModel(nn.Module):
    """
    GraphSAGE Neural Network for node embedding and classification.
    
    Parameters:
    - in_channels: Input node feature dimension
    - hidden_channels: Hidden layer embedding dimension (default: 128)
    - out_channels: Embedding output dimension (default: 128)
    - num_layers: Number of GraphSAGE layers (default: 3)
    - dropout: Dropout rate (default: 0.2)
    - num_classes: Classification output dimension (default: 2 for binary fraud classification)
    """

    def __init__(
        self,
        in_channels: int = 32,
        hidden_channels: int = 128,
        out_channels: int = 128,
        num_layers: int = 3,
        dropout: float = 0.2,
        num_classes: int = 2,
    ):
        super().__init__()
        self.in_channels = in_channels
        self.hidden_channels = hidden_channels
        self.out_channels = out_channels
        self.num_layers = max(1, num_layers)
        self.dropout = dropout
        self.num_classes = num_classes

        self.convs = nn.ModuleList()
        self.norms = nn.ModuleList()

        conv_cls = SAGEConv if (HAS_PYG and SAGEConv is not None) else FallbackSAGEConv

        # First layer
        self.convs.append(conv_cls(in_channels, hidden_channels))
        self.norms.append(nn.BatchNorm1d(hidden_channels))

        # Intermediate layers
        for _ in range(self.num_layers - 2):
            self.convs.append(conv_cls(hidden_channels, hidden_channels))
            self.norms.append(nn.BatchNorm1d(hidden_channels))

        # Final embedding layer if num_layers >= 2
        if self.num_layers >= 2:
            self.convs.append(conv_cls(hidden_channels, out_channels))
            self.norms.append(nn.BatchNorm1d(out_channels))

        # Classification head
        self.classifier = nn.Sequential(
            nn.Linear(out_channels, hidden_channels // 2),
            nn.ReLU(),
            nn.Dropout(p=dropout),
            nn.Linear(hidden_channels // 2, num_classes)
        )

    def forward(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        """
        Forward pass producing classification logits.
        """
        embeddings = self.get_embeddings(x, edge_index)
        logits = self.classifier(embeddings)
        return logits

    def get_embeddings(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        """
        Computes 128-dimensional node embeddings.
        """
        for i, conv in enumerate(self.convs):
            x = conv(x, edge_index)
            if i < len(self.norms):
                x = self.norms[i](x)
            x = F.relu(x)
            if i < len(self.convs) - 1:
                x = F.dropout(x, p=self.dropout, training=self.training)

        # L2 Normalize final embeddings for unit hypersphere projection
        embeddings = F.normalize(x, p=2, dim=-1)
        return embeddings
