from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database.database import get_db
from app.database.models import User, Case, AuditLog
from app.database.schemas import CopilotQueryRequest, CopilotQueryResponse
from app.api.auth import get_current_user
from app.copilot.investigator_copilot import InvestigationCopilot
from app.copilot.llm_client import OllamaClient
from app.copilot.rag_pipeline import RAGPipeline
from app.copilot.narrative_generator import NarrativeGenerator
from app.copilot.chat_session import ChatSessionManager

router = APIRouter(prefix="/copilot", tags=["Investigation Copilot"])

# Global session manager instance
chat_manager = ChatSessionManager()

class CopilotChatRequest(BaseModel):
    message: str
    case_id: Optional[str] = None
    wallet_address: Optional[str] = None
    session_id: Optional[str] = None

class CopilotCaseAskRequest(BaseModel):
    question: str

class NarrativeRequest(BaseModel):
    case_id: str
    target_entity: Optional[str] = "Centralized Crypto Exchange (VASP)"
    investigator_name: Optional[str] = "Investigating Officer, Cyber Crime Unit"
    vasp_name: Optional[str] = "Binance / WazirX / CoinDCX"
    wallet_address: Optional[str] = None
    target_jurisdiction: Optional[str] = "United States / European Union / Singapore"

class RAGQueryRequest(BaseModel):
    query: str
    case_id: Optional[str] = None
    top_k: int = 10

@router.get("/status")
def get_copilot_status():
    """
    Check Ollama client, model configuration, and ChromaDB vector store health.
    """
    client = OllamaClient()
    health = client.check_health()
    rag = RAGPipeline(llm_client=client)
    return {
        "ollama": health,
        "parameters": {
            "llm_model": client.llm_model,
            "embedding_model": client.embedding_model,
            "context_window": "128K tokens (131,072)",
            "temperature": client.temperature,
            "top_k_retrieval": rag.top_k,
            "vector_store": "ChromaDB" if rag.is_native_chroma else "ChromaDB-Fallback"
        }
    }

@router.post("/query", response_model=CopilotQueryResponse)
def query_copilot(
    req: CopilotQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    copilot = InvestigationCopilot(db)
    result = copilot.query(case_id=req.case_id, question=req.question, user_id=current_user.id)

    # Audit log
    try:
        log = AuditLog(
            user_id=current_user.id,
            username=current_user.username,
            action="COPILOT_QUERY",
            case_id=req.case_id,
            metadata_json={"question": req.question, "category": result.get("category")}
        )
        db.add(log)
        db.commit()
    except Exception:
        db.rollback()

    return result

@router.post("/chat")
def copilot_chat(
    req: CopilotChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if req.session_id:
        session = chat_manager.get_or_create_session(
            session_id=req.session_id,
            case_id=req.case_id,
            user_id=current_user.id,
            db=db
        )
        return session.send_message(db=db, user_message=req.message)

    copilot = InvestigationCopilot(db)
    effective_q = req.message
    if req.wallet_address and req.wallet_address not in effective_q:
        effective_q = f"{effective_q} for wallet {req.wallet_address}"
    return copilot.query(case_id=req.case_id, question=effective_q, user_id=current_user.id)

@router.post("/case/{case_id}/ask")
def copilot_case_ask(
    case_id: str,
    req: CopilotCaseAskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(Case).filter(Case.case_id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")

    copilot = InvestigationCopilot(db)
    return copilot.query(case_id=case_id, question=req.question, user_id=current_user.id)

@router.get("/case/{case_id}/suggestions", response_model=List[str])
def get_copilot_suggestions(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(Case).filter(Case.case_id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")
    return InvestigationCopilot.get_suggestions(case)

# -------------------------------------------------------------------
# Structured Forensic Narrative & Legal Notice Endpoints
# -------------------------------------------------------------------

@router.post("/narrative/executive-summary")
def generate_executive_summary(
    req: NarrativeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    gen = NarrativeGenerator()
    return gen.generate_executive_summary(case_id=req.case_id, db=db)

@router.post("/narrative/court-narrative")
def generate_court_narrative(
    req: NarrativeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    gen = NarrativeGenerator()
    return gen.generate_court_narrative(case_id=req.case_id, db=db)

@router.post("/narrative/section-91-notice")
def generate_section_91_notice(
    req: NarrativeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    gen = NarrativeGenerator()
    return gen.generate_section_91_notice(
        case_id=req.case_id,
        db=db,
        target_entity=req.target_entity or "Centralized Crypto Exchange (VASP)",
        investigator_name=req.investigator_name or current_user.username
    )

@router.post("/narrative/vasp-subpoena")
def generate_vasp_subpoena(
    req: NarrativeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    gen = NarrativeGenerator()
    return gen.generate_vasp_subpoena(
        case_id=req.case_id,
        db=db,
        vasp_name=req.vasp_name or "Binance / WazirX / CoinDCX",
        wallet_address=req.wallet_address
    )

@router.post("/narrative/mlat-request")
def generate_mlat_request(
    req: NarrativeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    gen = NarrativeGenerator()
    return gen.generate_mlat_request(
        case_id=req.case_id,
        db=db,
        target_jurisdiction=req.target_jurisdiction or "United States / European Union / Singapore",
        vasp_name=req.vasp_name or "Offshore Crypto Exchange"
    )

# -------------------------------------------------------------------
# RAG Pipeline Endpoints
# -------------------------------------------------------------------

@router.post("/rag/index/{case_id}")
def index_case_in_rag(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    rag = RAGPipeline()
    return rag.index_case_graph(case_id=case_id, db=db)

@router.post("/rag/query")
def query_rag_vector_store(
    req: RAGQueryRequest,
    current_user: User = Depends(get_current_user)
):
    rag = RAGPipeline()
    chunks = rag.retrieve_relevant_chunks(query=req.query, case_id=req.case_id, top_k=req.top_k)
    return {
        "query": req.query,
        "case_id": req.case_id,
        "top_k": req.top_k,
        "retrieved_chunks_count": len(chunks),
        "chunks": chunks
    }
