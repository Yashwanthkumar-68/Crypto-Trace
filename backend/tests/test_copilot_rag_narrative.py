import pytest
import datetime
from fastapi.testclient import TestClient
from app.main import app
from app.database.database import SessionLocal
from app.database.models import Case, Transaction, CopilotMessage
from app.copilot.llm_client import OllamaClient
from app.copilot.rag_pipeline import RAGPipeline
from app.copilot.narrative_generator import NarrativeGenerator
from app.copilot.chat_session import ChatSessionManager

client = TestClient(app)

def get_auth_token(role="investigator"):
    creds = {
        "investigator": ("investigator", "password123"),
        "supervisor": ("supervisor", "password123"),
        "admin": ("admin", "password123")
    }
    username, password = creds.get(role, creds["investigator"])
    res = client.post("/api/auth/login", json={"username": username, "password": password})
    return res.json().get("access_token")

def test_ollama_client_parameters():
    llm = OllamaClient(
        llm_model="llama3.1:8b",
        embedding_model="nomic-embed-text",
        context_window=131072,
        temperature=0.1
    )
    assert llm.llm_model == "llama3.1:8b"
    assert llm.embedding_model == "nomic-embed-text"
    assert llm.context_window == 131072
    assert llm.temperature == 0.1

    emb = llm.embed("Test forensic sentence for vector embedding")
    assert len(emb) > 0

def test_copilot_status_endpoint():
    token = get_auth_token("investigator")
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/copilot/status", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "parameters" in data
    assert data["parameters"]["llm_model"] == "llama3.1:8b"
    assert data["parameters"]["embedding_model"] == "nomic-embed-text"
    assert data["parameters"]["top_k_retrieval"] == 10

def test_rag_pipeline_and_narratives():
    db = SessionLocal()
    token = get_auth_token("investigator")
    headers = {"Authorization": f"Bearer {token}"}

    case_id = f"CASE-RAG-{int(datetime.datetime.utcnow().timestamp())}"
    wallet = "0x7777777777777777777777777777777777777777"

    case = Case(
        case_id=case_id,
        victim_name="RAG Test Victim",
        complaint_reference=f"REF-RAG-{int(datetime.datetime.utcnow().timestamp())}",
        amount_lost=12.5,
        currency="ETH",
        incident_date=datetime.datetime.utcnow(),
        suspect_wallet=wallet,
        blockchain="Ethereum"
    )
    tx = Transaction(
        tx_hash=f"0xhash{int(datetime.datetime.utcnow().timestamp())}",
        case_id=case_id,
        from_address=wallet,
        to_address="0x8888888888888888888888888888888888888888",
        value_eth=12.5,
        block_timestamp=datetime.datetime.utcnow()
    )
    db.add(case)
    db.add(tx)
    db.commit()

    try:
        # 1. Test RAG indexing
        idx_res = client.post(f"/api/copilot/rag/index/{case_id}", headers=headers)
        assert idx_res.status_code == 200
        assert idx_res.json()["chunks_indexed"] >= 1

        # 2. Test RAG query
        q_res = client.post("/api/copilot/rag/query", headers=headers, json={"query": "wallet displacement", "case_id": case_id, "top_k": 10})
        assert q_res.status_code == 200
        assert q_res.json()["top_k"] == 10

        # 3. Test Executive Summary Generation
        ex_res = client.post("/api/copilot/narrative/executive-summary", headers=headers, json={"case_id": case_id})
        assert ex_res.status_code == 200
        assert ex_res.json()["document_type"] == "EXECUTIVE_SUMMARY"
        assert len(ex_res.json()["content"]) > 20

        # 4. Test Court Narrative Generation
        cn_res = client.post("/api/copilot/narrative/court-narrative", headers=headers, json={"case_id": case_id})
        assert cn_res.status_code == 200
        assert cn_res.json()["document_type"] == "COURT_NARRATIVE"

        # 5. Test Section 91 CrPC Notice Generation
        s91_res = client.post("/api/copilot/narrative/section-91-notice", headers=headers, json={"case_id": case_id, "target_entity": "Binance India"})
        assert s91_res.status_code == 200
        assert s91_res.json()["document_type"] == "SECTION_91_CRPC_NOTICE"
        assert "SECTION 91" in s91_res.json()["content"].upper()

        # 6. Test VASP Subpoena Draft Generation
        vasp_res = client.post("/api/copilot/narrative/vasp-subpoena", headers=headers, json={"case_id": case_id, "vasp_name": "Coinbase"})
        assert vasp_res.status_code == 200
        assert vasp_res.json()["document_type"] == "VASP_SUBPOENA"

        # 7. Test MLAT Request Template Generation
        mlat_res = client.post("/api/copilot/narrative/mlat-request", headers=headers, json={"case_id": case_id, "target_jurisdiction": "United States"})
        assert mlat_res.status_code == 200
        assert mlat_res.json()["document_type"] == "MLAT_REQUEST"

    finally:
        db.query(Transaction).filter(Transaction.case_id == case_id).delete()
        db.query(CopilotMessage).filter(CopilotMessage.case_id == case_id).delete()
        db.query(Case).filter(Case.case_id == case_id).delete()
        db.commit()
        db.close()
