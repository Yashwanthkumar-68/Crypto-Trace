"""
FAISS Vector Database Store for Wallet Embeddings.

Provides high-performance vector indexing, similarity search, and illicit cluster identification
for 128-dimensional GNN wallet embeddings.
"""

import json
import logging
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

import numpy as np

try:
    import faiss
    HAS_FAISS = True
except ImportError:
    HAS_FAISS = False
    faiss = None

logger = logging.getLogger(__name__)


class EmbeddingStore:
    """
    FAISS-backed vector store for GNN wallet embeddings.
    
    Parameters:
    - embedding_dim: Dimension of vector embeddings (default: 128, GNN_EMBEDDING_DIM)
    - index_type: FAISS index type ("IVFFlat", "Flat", or "IndexFlatIP")
    - similarity_threshold: Minimum cosine similarity score for matching (default: 0.85)
    - nlist: Number of Voronoi cells for IVFFlat index (default: 100)
    """

    def __init__(
        self,
        embedding_dim: int = 128,
        index_type: str = "IVFFlat",
        similarity_threshold: float = 0.85,
        nlist: int = 10,
    ):
        self.embedding_dim = embedding_dim
        self.index_type = index_type
        self.similarity_threshold = similarity_threshold
        self.nlist = nlist

        # Internal metadata mappings
        self.id_to_address: Dict[int, str] = {}
        self.address_to_id: Dict[str, int] = {}
        self.address_to_embedding: Dict[str, np.ndarray] = {}
        self.next_id: int = 0

        self.index = None
        self._init_index()

    def _init_index(self):
        """Initializes the FAISS index or fallback structure."""
        if HAS_FAISS:
            if self.index_type == "IVFFlat":
                quantizer = faiss.IndexFlatIP(self.embedding_dim)
                self.index = faiss.IndexIVFFlat(
                    quantizer, self.embedding_dim, self.nlist, faiss.METRIC_INNER_PRODUCT
                )
            else:
                self.index = faiss.IndexFlatIP(self.embedding_dim)
        else:
            logger.warning("FAISS not detected. Using fallback NumPy vector store.")
            self.index = None

    def _normalize(self, vectors: np.ndarray) -> np.ndarray:
        """L2 normalizes vectors for cosine similarity computation."""
        if vectors.ndim == 1:
            vectors = vectors.reshape(1, -1)
        vectors = vectors.astype(np.float32)
        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        return vectors / norms

    def add_embeddings(self, wallet_addresses: List[str], embeddings: np.ndarray):
        """
        Adds or updates wallet address embeddings.
        
        - wallet_addresses: List of wallet address strings
        - embeddings: 2D NumPy array of shape (N, 128)
        """
        if len(wallet_addresses) == 0 or len(embeddings) == 0:
            return

        norm_vectors = self._normalize(np.array(embeddings, dtype=np.float32))
        
        for idx, addr in enumerate(wallet_addresses):
            clean_addr = addr.lower()
            vec = norm_vectors[idx]
            
            # Store raw embedding mapping
            self.address_to_embedding[clean_addr] = vec
            
            if clean_addr not in self.address_to_id:
                int_id = self.next_id
                self.address_to_id[clean_addr] = int_id
                self.id_to_address[int_id] = clean_addr
                self.next_id += 1

        if HAS_FAISS and self.index is not None:
            # Train IVFFlat if required
            if isinstance(self.index, faiss.IndexIVFFlat) and not self.index.is_trained:
                all_vecs = np.array(list(self.address_to_embedding.values()), dtype=np.float32)
                if len(all_vecs) >= self.nlist:
                    self.index.train(all_vecs)
                else:
                    # Switch to IndexFlatIP if insufficient training samples
                    self.index = faiss.IndexFlatIP(self.embedding_dim)
            
            # Rebuild index for clean mapping
            all_vecs = np.array([self.address_to_embedding[self.id_to_address[i]] for i in range(self.next_id)], dtype=np.float32)
            if hasattr(self.index, 'is_trained') and not self.index.is_trained:
                self.index.train(all_vecs)
            self.index.reset()
            self.index.add(all_vecs)

    def search_similar(
        self,
        query_embedding: np.ndarray,
        top_k: int = 10,
        threshold: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """
        Searches for top-K similar wallet embeddings.
        
        Returns list of dicts: [{"address": str, "similarity": float, "id": int}]
        """
        if threshold is None:
            threshold = self.similarity_threshold

        if len(self.address_to_embedding) == 0:
            return []

        query_vec = self._normalize(np.array(query_embedding, dtype=np.float32))
        top_k = min(top_k, len(self.address_to_embedding))

        results = []
        if HAS_FAISS and self.index is not None and self.index.ntotal > 0:
            scores, indices = self.index.search(query_vec, top_k)
            for score, idx in zip(scores[0], indices[0]):
                if idx in self.id_to_address and score >= threshold:
                    results.append({
                        "address": self.id_to_address[idx],
                        "similarity": float(score),
                        "id": int(idx)
                    })
        else:
            # Fallback NumPy Cosine Similarity
            all_addrs = list(self.address_to_embedding.keys())
            all_matrix = np.array([self.address_to_embedding[a] for a in all_addrs], dtype=np.float32)
            similarities = np.dot(all_matrix, query_vec.T).squeeze(-1)
            
            top_indices = np.argsort(-similarities)[:top_k]
            for idx in top_indices:
                score = float(similarities[idx])
                if score >= threshold:
                    addr = all_addrs[idx]
                    results.append({
                        "address": addr,
                        "similarity": score,
                        "id": self.address_to_id[addr]
                    })

        return results

    def search_by_address(
        self,
        wallet_address: str,
        top_k: int = 10,
        threshold: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """Searches similar wallets using an existing stored wallet address."""
        clean_addr = wallet_address.lower()
        if clean_addr not in self.address_to_embedding:
            return []
        
        embedding = self.address_to_embedding[clean_addr]
        return self.search_similar(embedding, top_k=top_k, threshold=threshold)

    def get_embedding(self, wallet_address: str) -> Optional[np.ndarray]:
        """Retrieves embedding vector for a given wallet address."""
        return self.address_to_embedding.get(wallet_address.lower())

    def find_clusters(self, threshold: Optional[float] = None) -> List[List[str]]:
        """
        Groups wallets into similarity clusters based on EMBEDDING_SIMILARITY_THRESHOLD (0.85).
        Returns a list of wallet address clusters.
        """
        if threshold is None:
            threshold = self.similarity_threshold

        addrs = list(self.address_to_embedding.keys())
        if not addrs:
            return []

        visited = set()
        clusters = []

        for addr in addrs:
            if addr in visited:
                continue
            
            similar = self.search_by_address(addr, top_k=len(addrs), threshold=threshold)
            cluster = [item["address"] for item in similar]
            if not cluster:
                cluster = [addr]
            
            visited.update(cluster)
            clusters.append(cluster)

        return clusters

    def save_index(self, file_path: str):
        """Saves the index and metadata mappings to disk."""
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        meta_path = path.with_suffix('.json')
        meta_data = {
            "embedding_dim": self.embedding_dim,
            "index_type": self.index_type,
            "similarity_threshold": self.similarity_threshold,
            "id_to_address": {str(k): v for k, v in self.id_to_address.items()},
            "address_to_id": self.address_to_id,
            "embeddings": {k: v.tolist() for k, v in self.address_to_embedding.items()},
            "next_id": self.next_id
        }
        
        with open(meta_path, 'w') as f:
            json.dump(meta_data, f, indent=2)

        if HAS_FAISS and self.index is not None:
            faiss.write_index(self.index, str(path))

    def load_index(self, file_path: str):
        """Loads index and metadata mappings from disk."""
        path = Path(file_path)
        meta_path = path.with_suffix('.json')
        
        if not meta_path.exists():
            logger.error(f"Metadata file {meta_path} does not exist.")
            return

        with open(meta_path, 'r') as f:
            meta_data = json.load(f)

        self.embedding_dim = meta_data["embedding_dim"]
        self.index_type = meta_data["index_type"]
        self.similarity_threshold = meta_data["similarity_threshold"]
        self.id_to_address = {int(k): v for k, v in meta_data["id_to_address"].items()}
        self.address_to_id = meta_data["address_to_id"]
        self.address_to_embedding = {k: np.array(v, dtype=np.float32) for k, v in meta_data["embeddings"].items()}
        self.next_id = meta_data["next_id"]

        if HAS_FAISS and path.exists():
            self.index = faiss.read_index(str(path))
        else:
            self.add_embeddings(
                list(self.address_to_embedding.keys()),
                np.array(list(self.address_to_embedding.values()))
            )
