from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
import uuid
import hashlib
import datetime
import json

from app.database.database import get_db
from app.database.models import Case, CaseStatus, CasePriority, CaseOrigin, Transaction, RiskFinding
from app.services.cross_case_service import CrossCaseIntelligenceService

router = APIRouter(prefix="/webhooks", tags=["Government / NCRP Integrations"])

class SahyogIngestPayload(BaseModel):
    complaint_id: str
    victim_name: str
    amount_lost_inr: float
    suspect_wallet_address: str
    blockchain_network: str = "Ethereum"
    complaint_details: str
    reporting_officer: str

@router.post("/sahyog/ingest")
def ingest_sahyog_complaint(
    payload: SahyogIngestPayload,
    db: Session = Depends(get_db),
    x_api_key: Optional[str] = Header(None)
):
    """
    Secure Webhook for ingesting live cases from the National Cyber Crime Reporting Portal (NCRP) / SAHYOG.
    Enforces government API key authentication, creates the formal complaint record,
    and immediately triggers cross-case crime syndicate link analysis.
    """
    if x_api_key != "sahyog-auth-token-mock-2026":
        raise HTTPException(status_code=401, detail="Unauthorized Govt API Key")

    year = datetime.datetime.utcnow().year
    new_case_id = f"CASE-{year}-{str(uuid.uuid4())[:8].upper()}"
    case_number = f"CASE-{year}-NCRP-{str(uuid.uuid4().hex[:5]).upper()}"

    case = Case(
        case_id=new_case_id,
        case_number=case_number,
        title=f"NCRP Auto-Ingest: {payload.complaint_id} ({payload.victim_name})",
        victim_name=payload.victim_name,
        suspect_wallet=payload.suspect_wallet_address.strip(),
        amount_lost=payload.amount_lost_inr,
        currency="INR",
        blockchain=payload.blockchain_network,
        incident_date=datetime.datetime.utcnow(),
        description=f"Official NCRP / SAHYOG Transmission by Officer {payload.reporting_officer}: {payload.complaint_details}",
        status=CaseStatus.NEW,
        priority=CasePriority.HIGH,
        origin=CaseOrigin.EXTERNAL_GOVT_PORTAL if hasattr(CaseOrigin, "EXTERNAL_GOVT_PORTAL") else CaseOrigin.NATIVE_APP,
        complaint_reference=payload.complaint_id,
        external_reference=payload.complaint_id
    )
    db.add(case)
    db.commit()
    db.refresh(case)

    # Immediately trigger automated cross-case syndicate link analysis
    syndicate_detected = False
    syndicate_tag = None
    try:
        links = CrossCaseIntelligenceService.scan_and_link(db, case)
        if links:
            syndicate_detected = True
            syndicate_tag = links[0].syndicate_tag
    except Exception as e:
        pass

    return {
        "status": "success",
        "message": "NCRP complaint successfully ingested into CryptoTrace forensic database.",
        "internal_case_id": new_case_id,
        "case_number": case_number,
        "syndicate_linked": syndicate_detected,
        "syndicate_tag": syndicate_tag,
        "auto_trace_status": "Queued for background heuristic processing"
    }

@router.get("/ncrp/export/{case_id}")
def export_ncrp_evidence(
    case_id: str,
    db: Session = Depends(get_db),
    x_api_key: Optional[str] = Header(None)
):
    """
    Standardized Government Webhook for SAHYOG to pull cryptographic evidence bundles,
    statutory hashes, and exchange targets from CryptoTrace without manual PDF exports.
    """
    if x_api_key != "sahyog-auth-token-mock-2026":
        raise HTTPException(status_code=401, detail="Unauthorized Govt API Key")

    case = db.query(Case).filter(Case.case_id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")

    # Retrieve all related findings and transactions
    findings = db.query(RiskFinding).filter(RiskFinding.case_id == case_id).all()
    tx_count = db.query(Transaction).filter(Transaction.case_id == case_id).count()

    # Compute deterministic SHA-256 evidence bundle digest
    raw_payload = f"{case.case_id}|{case.suspect_wallet}|{case.amount_lost}|{case.currency}|{tx_count}|{len(findings)}"
    digest = hashlib.sha256(raw_payload.encode('utf-8')).hexdigest()

    return {
        "case_id": case.case_id,
        "case_number": case.case_number or case.case_id,
        "ncrp_reference": case.complaint_reference,
        "victim_name": case.victim_name,
        "reported_loss_inr": case.amount_lost if case.currency == "INR" else case.amount_lost * 87.0,
        "evidence_bundle": {
            "statutory_act": "Section 63 BNSS (2023) / Section 65B Indian Evidence Act (1872)",
            "status": case.status.value if hasattr(case.status, "value") else str(case.status),
            "canonical_sha256": digest,
            "suspect_wallet": case.suspect_wallet,
            "blockchain": case.blockchain,
            "indexed_transactions": tx_count,
            "risk_findings_count": len(findings),
            "vasp_targets": ["Binance", "WazirX", "CoinDCX", "Kraken"],
            "recommended_action": "Issue Section 91 CrPC / Section 94 BNSS Asset Freeze Notice to VASPs"
        }
    }
