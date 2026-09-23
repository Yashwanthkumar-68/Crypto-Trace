"""
Graph Attention Network (GAT) Architecture Module for Wallet Fraud Detection.

Uses multi-head graph attention mechanisms to weigh edge relationships dynamically
based on transaction attributes and structural similarity.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F

try:
    from torch_geometric.nn import GATv2Conv, GATConv
    HAS_PYG = True
except ImportError:
    HAS_PYG = False
    GATv2Conv = None
    GATConv = None


class FallbackGATConv(nn.Module):
    """Fallback Graph Attention Layer using PyTorch when PyG is unavailable."""

    def __init__(self, in_channels: int, out_channels: int, heads: int = 8, concat: bool = True, dropout: float = 0.2):
        super().__init__()
        self.in_channels = in_channels
        self.out_channels = out_channels
        self.heads = heads
        self.concat = concat
        self.dropout = dropout

        self.lin = nn.Linear(in_channels, heads * out_channels, bias=False)
        self.att_src = nn.Parameter(torch.Tensor(1, heads, out_channels))
        self.att_dst = nn.Parameter(torch.Tensor(1, heads, out_channels))
        nn.init.xavier_uniform_(self.att_src)
        nn.init.xavier_uniform_(self.att_dst)

    def forward(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        num_nodes = x.size(0)
        h = self.lin(x).view(num_nodes, self.heads, self.out_channels)

        if edge_index.numel() == 0:
            if self.concat:
                return h.view(num_nodes, self.heads * self.out_channels)
            return h.mean(dim=1)

        src, dst = edge_index[0], edge_index[1]
        alpha_src = (h * self.att_src).sum(dim=-1)  # [num_nodes, heads]
        alpha_dst = (h * self.att_dst).sum(dim=-1)

        alpha = alpha_src[src] + alpha_dst[dst]
        alpha = F.leaky_relu(alpha, negative_slope=0.2)
        alpha = F.softmax(alpha, dim=0)
        alpha = F.dropout(alpha, p=self.dropout, training=self.training)

        out = torch.zeros(num_nodes, self.heads, self.out_channels, device=x.device, dtype=x.dtype)
        for head in range(self.heads):
            msg = h[src, head, :] * alpha[:, head].unsqueeze(-1)
            out[:, head, :].index_add_(0, dst, msg)

        if self.concat:
            return out.view(num_nodes, self.heads * self.out_channels)
        return out.mean(dim=1)


class GATModel(nn.Module):
    """
    Graph Attention Network (GAT) for node embedding and anomaly classification.
    
    Parameters:
    - in_channels: Input node feature dimension
    - hidden_channels: Hidden layer embedding dimension per head (default: 128)
    - out_channels: Final embedding dimension (default: 128)
    - num_layers: Number of GAT layers (default: 3)
    - heads: Number of attention heads (default: 8)
    - dropout: Attention and feature dropout rate (default: 0.2)
    - num_classes: Classification output dimension (default: 2)
    """

    def __init__(
        self,
        in_channels: int = 32,
        hidden_channels: int = 128,
        out_channels: int = 128,
        num_layers: int = 3,
        heads: int = 8,
        dropout: float = 0.2,
        num_classes: int = 2,
    ):
        super().__init__()
        self.in_channels = in_channels
        self.hidden_channels = hidden_channels
        self.out_channels = out_channels
        self.num_layers = max(1, num_layers)
        self.heads = heads
        self.dropout = dropout
        self.num_classes = num_classes

        self.convs = nn.ModuleList()
        self.norms = nn.ModuleList()
        self.residuals = nn.ModuleList()

        if HAS_PYG and GATv2Conv is not None:
            conv_layer = lambda in_dim, out_dim, h_count, cat: GATv2Conv(
                in_dim, out_dim, heads=h_count, concat=cat, dropout=dropout
            )
        else:
            conv_layer = lambda in_dim, out_dim, h_count, cat: FallbackGATConv(
                in_dim, out_dim, heads=h_count, concat=cat, dropout=dropout
            )

        # Layer 1
        self.convs.append(conv_layer(in_channels, hidden_channels // heads, heads, True))
        self.norms.append(nn.BatchNorm1d(hidden_channels))
        self.residuals.append(nn.Linear(in_channels, hidden_channels) if in_channels != hidden_channels else nn.Identity())

        # Intermediate layers
        for _ in range(self.num_layers - 2):
            self.convs.append(conv_layer(hidden_channels, hidden_channels // heads, heads, True))
            self.norms.append(nn.BatchNorm1d(hidden_channels))
            self.residuals.append(nn.Identity())

        # Final Layer (aggregates heads via average to out_channels)
        if self.num_layers >= 2:
            self.convs.append(conv_layer(hidden_channels, out_channels, heads, False))
            self.norms.append(nn.BatchNorm1d(out_channels))
            self.residuals.append(nn.Linear(hidden_channels, out_channels) if hidden_channels != out_channels else nn.Identity())

        # Classification Head
        self.classifier = nn.Sequential(
            nn.Linear(out_channels, hidden_channels // 2),
            nn.ELU(),
            nn.Dropout(p=dropout),
            nn.Linear(hidden_channels // 2, num_classes)
        )

    def forward(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        """
        Forward pass returning classification logits.
        """
        embeddings = self.get_embeddings(x, edge_index)
        return self.classifier(embeddings)

    def get_embeddings(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        """
        Computes 128-dimensional node embeddings with multi-head attention.
        """
        h = x
        for i, conv in enumerate(self.convs):
            residual = self.residuals[i](h)
            h = conv(h, edge_index)
            if i < len(self.norms):
                h = self.norms[i](h)
            h = F.elu(h + residual)
            if i < len(self.convs) - 1:
                h = F.dropout(h, p=self.dropout, training=self.training)

        return F.normalize(h, p=2, dim=-1)
