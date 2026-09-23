"""
Multi-turn session state management for Crypto-Trace AI Copilot.

Parameters:
- context_window: 131072 tokens (128K)
- temperature: 0.1 (forensic precision mode)
- Persists chat messages to CopilotMessage DB table.
"""

import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.database.models import CopilotMessage, Case
from app.copilot.llm_client import OllamaClient
from app.copilot.rag_pipeline import RAGPipeline
from app.copilot import prompt_templates as prompts

logger = logging.getLogger(__name__)

class ChatSession:
    """
    Stateful multi-turn conversation session bound to a case and user.
    """

    def __init__(
        self,
        session_id: str,
        case_id: Optional[str] = None,
        user_id: Optional[int] = None,
        llm_client: Optional[OllamaClient] = None,
        rag_pipeline: Optional[RAGPipeline] = None
    ):
        self.session_id = session_id
        self.case_id = case_id
        self.user_id = user_id
        self.llm_client = llm_client or OllamaClient()
        self.rag_pipeline = rag_pipeline or RAGPipeline(llm_client=self.llm_client)
        self.messages: List[Dict[str, str]] = [
            {"role": "system", "content": prompts.FORENSIC_SYSTEM_PROMPT}
        ]

    def load_history_from_db(self, db: Session, limit: int = 20):
        """
        Populate chat session history from database table copilot_messages.
        """
        if not self.case_id:
            return

        db_msgs = db.query(CopilotMessage).filter(
            CopilotMessage.case_id == self.case_id
        ).order_by(CopilotMessage.created_at.desc()).limit(limit).all()

        # Reverse to chronological order
        db_msgs.reverse()

        self.messages = [{"role": "system", "content": prompts.FORENSIC_SYSTEM_PROMPT}]
        for m in db_msgs:
            self.messages.append({"role": m.role, "content": m.content})

    def send_message(self, db: Session, user_message: str) -> Dict[str, Any]:
        """
        Process a user message, perform RAG retrieval, query Ollama LLM, and persist turn.
        """
        # 1. Retrieve grounded context from RAG pipeline
        grounded_chunks = self.rag_pipeline.retrieve_relevant_chunks(
            query=user_message,
            case_id=self.case_id,
            top_k=10
        )
        context_str = self.rag_pipeline.get_grounded_context_str(
            query=user_message,
            case_id=self.case_id,
            top_k=10
        )

        # 2. Format query with grounded context
        prompt_content = f"GROUNDED CASE CONTEXT:\n{context_str}\n\nUSER QUESTION:\n{user_message}"
        self.messages.append({"role": "user", "content": prompt_content})

        # Save user message to DB
        self._save_db_message(db, role="user", content=user_message, grounded_evidence=[])

        # 3. Call Ollama Chat LLM
        res = self.llm_client.chat(
            messages=self.messages,
            temperature=0.1,
            context_window=131072
        )

        assistant_reply = res.get("content", "")
        if not assistant_reply or "[LOCAL LLM OFFLINE" in assistant_reply:
            assistant_reply = f"Based on retrieved evidence chunks:\n{context_str}"

        self.messages.append({"role": "assistant", "content": assistant_reply})

        # Save assistant message to DB
        grounded_ev = [c["metadata"] for c in grounded_chunks]
        self._save_db_message(db, role="assistant", content=assistant_reply, grounded_evidence=grounded_ev)

        return {
            "session_id": self.session_id,
            "case_id": self.case_id,
            "user_message": user_message,
            "assistant_response": assistant_reply,
            "grounded_evidence": grounded_chunks,
            "context_window_tokens": 131072,
            "model_used": res.get("model", self.llm_client.llm_model)
        }

    def _save_db_message(self, db: Session, role: str, content: str, grounded_evidence: list):
        try:
            msg = CopilotMessage(
                case_id=self.case_id,
                user_id=self.user_id,
                role=role,
                content=content,
                grounded_evidence=grounded_evidence
            )
            db.add(msg)
            db.commit()
        except Exception as e:
            logger.error(f"Error persisting copilot message to DB: {e}")
            db.rollback()


class ChatSessionManager:
    """
    Manager for maintaining active in-memory multi-turn chat sessions across users and cases.
    """

    def __init__(self, llm_client: Optional[OllamaClient] = None, rag_pipeline: Optional[RAGPipeline] = None):
        self.llm_client = llm_client or OllamaClient()
        self.rag_pipeline = rag_pipeline or RAGPipeline(llm_client=self.llm_client)
        self.sessions: Dict[str, ChatSession] = {}

    def get_or_create_session(
        self,
        session_id: str,
        case_id: Optional[str] = None,
        user_id: Optional[int] = None,
        db: Optional[Session] = None
    ) -> ChatSession:
        if session_id not in self.sessions:
            session = ChatSession(
                session_id=session_id,
                case_id=case_id,
                user_id=user_id,
                llm_client=self.llm_client,
                rag_pipeline=self.rag_pipeline
            )
            if db and case_id:
                session.load_history_from_db(db)
            self.sessions[session_id] = session
        return self.sessions[session_id]
