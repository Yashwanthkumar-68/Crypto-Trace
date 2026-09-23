"""
Temporal Graph Network (TGN) Architecture Module for Continuous-Time Dynamic Graphs.

Incorporates harmonic time encodings and GRU node state update memories to capture
evolving transaction patterns and velocity of money across blockchain wallets.
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F

from app.ml.gnn.graph_sage_model import GraphSAGEModel


class TimeEncoder(nn.Module):
    """
    Fourier Harmonic Time Encoder.
    Encodes continuous time differences (timestamps) into a dense vector space of dimension 64.
    """

    def __init__(self, time_dim: int = 64):
        super().__init__()
        self.time_dim = time_dim
        # Learnable frequency parameters initialized logarithmically
        self.basis_freq = nn.Parameter(torch.exp(torch.linspace(0, math.log(10000), time_dim // 2)))

    def forward(self, timestamps: torch.Tensor) -> torch.Tensor:
        """
        timestamps: 1D tensor of timestamp floats or elapsed seconds [num_edges]
        Returns: [num_edges, time_dim]
        """
        if timestamps.dim() == 1:
            timestamps = timestamps.unsqueeze(-1)  # [num_edges, 1]

        # Calculate phase frequencies
        freq = timestamps * self.basis_freq.unsqueeze(0)  # [num_edges, time_dim // 2]
        sin_enc = torch.sin(freq)
        cos_enc = torch.cos(freq)

        # Concatenate sin and cos components
        time_embedding = torch.cat([sin_enc, cos_enc], dim=-1)  # [num_edges, time_dim]
        return time_embedding


class TemporalGNN(nn.Module):
    """
    Temporal Graph Neural Network (TGN) for continuous-time transaction analysis.
    
    Parameters:
    - in_channels: Node input feature dimension (default: 32)
    - time_dim: Time encoding dimension (default: 64, TEMPORAL_TIME_ENCODING_DIM)
    - hidden_channels: GNN embedding hidden dimension (default: 128, GNN_EMBEDDING_DIM)
    - out_channels: Output embedding dimension (default: 128)
    - num_layers: Layers in structural GNN backbone (default: 3, GNN_LAYERS)
    - dropout: Feature dropout (default: 0.2)
    - num_classes: Output classes (default: 2)
    """

    def __init__(
        self,
        in_channels: int = 32,
        time_dim: int = 64,
        hidden_channels: int = 128,
        out_channels: int = 128,
        num_layers: int = 3,
        dropout: float = 0.2,
        num_classes: int = 2,
    ):
        super().__init__()
        self.in_channels = in_channels
        self.time_dim = time_dim
        self.hidden_channels = hidden_channels
        self.out_channels = out_channels
        self.num_layers = num_layers
        self.dropout = dropout
        self.num_classes = num_classes

        # Time encoder
        self.time_encoder = TimeEncoder(time_dim=time_dim)

        # Spatial GNN Backbone (GraphSAGE)
        self.spatial_gnn = GraphSAGEModel(
            in_channels=in_channels,
            hidden_channels=hidden_channels,
            out_channels=hidden_channels,
            num_layers=num_layers,
            dropout=dropout,
            num_classes=num_classes
        )

        # Temporal Memory Module (GRU node state updater)
        self.memory_cell = nn.GRUCell(
            input_size=hidden_channels + time_dim,
            hidden_size=hidden_channels
        )

        # Output projection head
        self.out_proj = nn.Sequential(
            nn.Linear(hidden_channels, out_channels),
            nn.BatchNorm1d(out_channels),
            nn.ReLU()
        )

        # Classifier
        self.classifier = nn.Sequential(
            nn.Linear(out_channels, hidden_channels // 2),
            nn.ReLU(),
            nn.Dropout(p=dropout),
            nn.Linear(hidden_channels // 2, num_classes)
        )

    def forward(
        self,
        x: torch.Tensor,
        edge_index: torch.Tensor,
        timestamps: torch.Tensor = None,
        edge_attr: torch.Tensor = None,
    ) -> torch.Tensor:
        """
        Forward pass producing classification logits.
        """
        embeddings = self.get_embeddings(x, edge_index, timestamps, edge_attr)
        return self.classifier(embeddings)

    def get_embeddings(
        self,
        x: torch.Tensor,
        edge_index: torch.Tensor,
        timestamps: torch.Tensor = None,
        edge_attr: torch.Tensor = None,
    ) -> torch.Tensor:
        """
        Computes temporal-spatial 128-d wallet embeddings.
        """
        num_nodes = x.size(0)

        # Step 1: Spatial GNN representation
        spatial_emb = self.spatial_gnn.get_embeddings(x, edge_index)

        # Step 2: Temporal edge aggregation
        if timestamps is None or timestamps.numel() == 0:
            timestamps = torch.zeros(edge_index.size(1) if edge_index.dim() > 1 else 0, device=x.device)

        time_emb = self.time_encoder(timestamps)

        # Aggregate temporal messages per destination node
        node_time_msg = torch.zeros(num_nodes, self.time_dim, device=x.device, dtype=x.dtype)
        if edge_index.numel() > 0 and timestamps.numel() > 0:
            dst = edge_index[1]
            node_time_msg.index_add_(0, dst, time_emb)

        # Step 3: Combine spatial embedding with temporal message & GRU state update
        gru_input = torch.cat([spatial_emb, node_time_msg], dim=-1)
        h_prev = torch.zeros(num_nodes, self.hidden_channels, device=x.device, dtype=x.dtype)
        updated_memory = self.memory_cell(gru_input, h_prev)

        # Final projection and L2 normalization
        final_embeddings = self.out_proj(updated_memory)
        return F.normalize(final_embeddings, p=2, dim=-1)
