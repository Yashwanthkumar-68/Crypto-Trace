"""
RAG Pipeline over case graph using ChromaDB and nomic-embed-text.

Parameters:
- vector_store: ChromaDB
- embedding_model: nomic-embed-text
- top_k_retrieval: 10 chunks
"""

import os
import json
import logging
import math
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.database.models import Case, Transaction, AddressLabel, Evidence, RiskAssessmentRecord, AnalysisPattern
from app.copilot.llm_client import OllamaClient

logger = logging.getLogger(__name__)

# Try importing chromadb safely
try:
    import chromadb
    from chromadb.config import Settings as ChromaSettings
    HAS_CHROMADB = True
except ImportError:
    HAS_CHROMADB = False

class FallbackVectorCollection:
    """
    In-memory fallback vector collection mimicking ChromaDB interface
    when chromadb native library is not available.
    """
    def __init__(self, name: str):
        self.name = name
        self.documents: List[str] = []
        self.metadatas: List[Dict[str, Any]] = []
        self.ids: List[str] = []
        self.embeddings: List[List[float]] = []

    def add(
        self,
        documents: List[str],
        metadatas: List[Dict[str, Any]],
        ids: List[str],
        embeddings: List[List[float]]
    ):
        for doc, meta, doc_id, emb in zip(documents, metadatas, ids, embeddings):
            if doc_id in self.ids:
                idx = self.ids.index(doc_id)
                self.documents[idx] = doc
                self.metadatas[idx] = meta
                self.embeddings[idx] = emb
            else:
                self.documents.append(doc)
                self.metadatas.append(meta)
                self.ids.append(doc_id)
                self.embeddings.append(emb)

    def query(
        self,
        query_embeddings: List[List[float]],
        n_results: int = 10,
        where: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        if not self.embeddings:
            return {"documents": [[]], "metadatas": [[]], "distances": [[]], "ids": [[]]}

        q_emb = query_embeddings[0]
        scored_items = []

        for idx, (doc, meta, doc_id, emb) in enumerate(zip(self.documents, self.metadatas, self.ids, self.embeddings)):
            # Filter by metadata if specified
            if where:
                match = True
                for k, v in where.items():
                    if meta.get(k) != v:
                        match = False
                        break
                if not match:
                    continue

            # Calculate cosine distance (1 - cosine similarity)
            dot = sum(a * b for a, b in zip(q_emb, emb))
            norm_a = math.sqrt(sum(a * a for a in q_emb)) or 1.0
            norm_b = math.sqrt(sum(b * b for b in emb)) or 1.0
            sim = dot / (norm_a * norm_b)
            dist = 1.0 - sim
            scored_items.append((dist, doc, meta, doc_id))

        scored_items.sort(key=lambda x: x[0])
        top_items = scored_items[:n_results]

        return {
            "documents": [[item[1] for item in top_items]],
            "metadatas": [[item[2] for item in top_items]],
            "distances": [[item[0] for item in top_items]],
            "ids": [[item[3] for item in top_items]]
        }


class RAGPipeline:
    """
    RAG Pipeline over Case Graph evidence using ChromaDB vector store and nomic-embed-text.
    """

    def __init__(
        self,
        llm_client: Optional[OllamaClient] = None,
        embedding_model: str = "nomic-embed-text",
        top_k: int = 10,
        persist_dir: Optional[str] = None
    ):
        self.llm_client = llm_client or OllamaClient(embedding_model=embedding_model)
        self.embedding_model = embedding_model
        self.top_k = top_k
        self.collection_name = "crypto_trace_case_graph"

        if HAS_CHROMADB:
            try:
                db_dir = persist_dir or os.getenv("CHROMADB_DIR", "./data/chromadb")
                os.makedirs(db_dir, exist_ok=True)
                self.chroma_client = chromadb.PersistentClient(path=db_dir)
                self.collection = self.chroma_client.get_or_create_collection(name=self.collection_name)
                self.is_native_chroma = True
            except Exception as e:
                logger.warning(f"Could not initialize ChromaDB PersistentClient: {e}. Using fallback collection.")
                self.collection = FallbackVectorCollection(self.collection_name)
                self.is_native_chroma = False
        else:
            self.collection = FallbackVectorCollection(self.collection_name)
            self.is_native_chroma = False

    def index_case_graph(self, case_id: str, db: Session) -> Dict[str, Any]:
        """
        Extract case graph elements (case details, transactions, labels, risk findings, evidence items)
        and index them into ChromaDB vector store with rich metadata.
        """
        documents: List[str] = []
        metadatas: List[Dict[str, Any]] = []
        ids: List[str] = []
        embeddings: List[List[float]] = []

        # 1. Fetch Case record
        case = db.query(Case).filter(Case.case_id == case_id).first()
        if case:
            doc_text = (
                f"Case Details for {case.case_id}: Victim {case.victim_name}, Reported Loss: {case.amount_lost} {case.currency}. "
                f"Suspect Wallet Address: {case.suspect_wallet}. Complaint Reference: {case.complaint_reference}. Blockchain: {case.blockchain}."
            )
            doc_id = f"case_{case.case_id}"
            documents.append(doc_text)
            metadatas.append({"case_id": case_id, "type": "case_summary", "wallet": case.suspect_wallet or ""})
            ids.append(doc_id)
            embeddings.append(self.llm_client.embed(doc_text))

        # 2. Fetch Transactions associated with case
        txs = db.query(Transaction).filter(Transaction.case_id == case_id).all()
        if case and case.suspect_wallet and not txs:
            txs = db.query(Transaction).filter(
                (Transaction.from_address.ilike(case.suspect_wallet)) |
                (Transaction.to_address.ilike(case.suspect_wallet))
            ).all()

        for tx in txs[:100]:  # Index top relevant transactions
            tx_hash = getattr(tx, "transaction_hash", getattr(tx, "tx_hash", "0x0"))
            from_addr = getattr(tx, "from_address", "")
            to_addr = getattr(tx, "to_address", "")
            amt = getattr(tx, "value_eth", getattr(tx, "amount_native", 0.0))
            symbol = getattr(tx, "token_symbol", getattr(tx, "blockchain", "ETH")) or "ETH"
            amt_usd = getattr(tx, "amount_usd", getattr(tx, "amount_usd_if_available", 0.0)) or 0.0
            ts = getattr(tx, "block_timestamp", getattr(tx, "timestamp", getattr(tx, "created_at", None)))
            hop = getattr(tx, "hop_count", 1) or 1
            cat = getattr(tx, "risk_category", getattr(tx, "transaction_type", "TRANSACTION")) or "TRANSACTION"

            doc_text = (
                f"Transaction Hash {tx_hash} (Case {case_id}): "
                f"From {from_addr} To {to_addr}, Amount: {amt} {symbol} "
                f"({amt_usd} USD) at {ts}. Hop Count: {hop}. Category: {cat}."
            )
            doc_id = f"tx_{str(tx_hash)[:16]}"
            documents.append(doc_text)
            metadatas.append({
                "case_id": case_id,
                "type": "transaction",
                "tx_hash": tx_hash,
                "from": from_addr,
                "to": to_addr,
                "amount": float(amt or 0)
            })
            ids.append(doc_id)
            embeddings.append(self.llm_client.embed(doc_text))

        # 3. Fetch Address Labels
        labels = db.query(AddressLabel).all()
        for lbl in labels:
            addr = getattr(lbl, "address", "")
            lbl_name = getattr(lbl, "label", getattr(lbl, "entity_name", "Unknown"))
            ent_type = getattr(lbl, "entity_type", "Entity") or "Entity"
            cat = getattr(lbl, "category", getattr(lbl, "label_type", "General")) or "General"
            doc_text = f"Address Label: Wallet {addr} is categorized as '{lbl_name}' ({ent_type}). Category: {cat}."
            doc_id = f"label_{str(addr)[:16]}"
            if doc_id not in ids:
                documents.append(doc_text)
                metadatas.append({"case_id": case_id, "type": "address_label", "address": addr, "label": lbl_name})
                ids.append(doc_id)
                embeddings.append(self.llm_client.embed(doc_text))

        # 4. Fetch Risk Records & Patterns
        if case and case.suspect_wallet:
            risk_records = db.query(RiskAssessmentRecord).filter(
                RiskAssessmentRecord.wallet_address.ilike(case.suspect_wallet)
            ).all()
            for r in risk_records:
                r_addr = getattr(r, "wallet_address", "")
                r_score = getattr(r, "risk_score", getattr(r, "score", 0))
                r_level = getattr(r, "risk_level", getattr(r, "level", "UNKNOWN"))
                r_factors = getattr(r, "risk_factors", {})
                doc_text = f"Risk Assessment for {r_addr}: Score {r_score}/100 ({r_level}). Risk Factors: {json.dumps(r_factors or {})}"
                doc_id = f"risk_{getattr(r, 'id', 0)}"
                documents.append(doc_text)
                metadatas.append({"case_id": case_id, "type": "risk_assessment", "wallet": r_addr})
                ids.append(doc_id)
                embeddings.append(self.llm_client.embed(doc_text))

        # Add to collection
        if documents:
            if self.is_native_chroma:
                self.collection.upsert(
                    documents=documents,
                    metadatas=metadatas,
                    ids=ids,
                    embeddings=embeddings
                )
            else:
                self.collection.add(
                    documents=documents,
                    metadatas=metadatas,
                    ids=ids,
                    embeddings=embeddings
                )

        return {
            "case_id": case_id,
            "chunks_indexed": len(documents),
            "vector_store": "ChromaDB" if self.is_native_chroma else "ChromaDB-Fallback",
            "embedding_model": self.embedding_model
        }

    def retrieve_relevant_chunks(
        self,
        query: str,
        case_id: Optional[str] = None,
        top_k: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Query ChromaDB vector store for top_k (default 10) most relevant chunks.
        """
        k = top_k or self.top_k
        query_embedding = self.llm_client.embed(query)

        where_filter = {"case_id": case_id} if case_id else None

        try:
            if self.is_native_chroma:
                kwargs = {
                    "query_embeddings": [query_embedding],
                    "n_results": k
                }
                if where_filter:
                    kwargs["where"] = where_filter
                results = self.collection.query(**kwargs)
            else:
                results = self.collection.query(
                    query_embeddings=[query_embedding],
                    n_results=k,
                    where=where_filter
                )

            docs = results.get("documents", [[]])[0]
            metas = results.get("metadatas", [[]])[0]
            dists = results.get("distances", [[]])[0]
            item_ids = results.get("ids", [[]])[0]

            retrieved_chunks = []
            for doc, meta, dist, chunk_id in zip(docs, metas, dists, item_ids):
                retrieved_chunks.append({
                    "id": chunk_id,
                    "content": doc,
                    "metadata": meta,
                    "distance": float(dist) if dist is not None else 0.0
                })
            return retrieved_chunks
        except Exception as e:
            logger.error(f"Error retrieving chunks from vector store: {e}")
            return []

    def get_grounded_context_str(self, query: str, case_id: Optional[str] = None, top_k: int = 10) -> str:
        """
        Build a clean formatted context string from top-k retrieved chunks.
        """
        chunks = self.retrieve_relevant_chunks(query=query, case_id=case_id, top_k=top_k)
        if not chunks:
            return "No matching grounded evidence chunks were retrieved from ChromaDB case graph."

        formatted_lines = []
        for idx, chunk in enumerate(chunks, 1):
            formatted_lines.append(f"[{idx}] (Source Type: {chunk['metadata'].get('type', 'Evidence')}): {chunk['content']}")

        return "\n".join(formatted_lines)
