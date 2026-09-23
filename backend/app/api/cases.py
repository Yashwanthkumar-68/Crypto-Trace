import datetime
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks, Response
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.database.models import (
    User, UserRole, Case, CaseStatus, InvestigatorNote, Transaction,
    RiskAssessmentRecord, AnalysisPattern, PriorityItem, CaseAssignment
)
from app.database.schemas import (
    CaseCreate, CaseUpdate, CaseResponse, ExternalCaseImportRequest, NoteCreate, NoteResponse,
    EvidenceCreate, EvidenceResponse, CaseAssignmentResponse,
    CaseRecommendationsResponse, ScamCampaignTimelineResponse, RealWorldEventCreate
)
from app.api.auth import get_current_user, require_roles
from app.config import settings
from app.services.case_service import CaseService
import logging
from app.services import supabase_service
from app.services.sms_service import SMSService
from app.services.cross_case_service import CrossCaseIntelligenceService

logger = logging.getLogger("sih26183.cases")

router = APIRouter(prefix="/cases", tags=["Case Management"])

@router.post("/import", response_model=CaseResponse)
def import_external_case(
    import_in: ExternalCaseImportRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.INVESTIGATOR, UserRole.SUPERVISOR, UserRole.ADMINISTRATOR]))
):
    """
    Law Enforcement endpoint for registering physical cyber crime complaints
    filed directly at the police station / cyber cell without requiring an app account.
    """
    case = CaseService.import_external_case(db, import_in, current_user)
    try:
        CrossCaseIntelligenceService.scan_and_link(db, case)
    except Exception as e:
        logger.error(f"[CrossCase] Error scanning links on case import: {e}")

    if case.assigned_investigator_id:
        inv_user = db.query(User).filter(User.id == case.assigned_investigator_id).first()
        target_phone = (inv_user.phone_number if inv_user and inv_user.phone_number else None) or settings.DEFAULT_ALERT_PHONE_NUMBER
        inv_name = inv_user.full_name if inv_user else "Forensic Officer"
        if target_phone:
            background_tasks.add_task(
                SMSService.send_new_case_sms,
                recipient_phone=target_phone,
                recipient_name=inv_name,
                case_id=case.case_id,
                case_number=case.case_number or case.case_id,
                victim_name=case.unregistered_victim_name or case.victim_name,
                amount=case.amount_lost,
                currency=case.currency,
                blockchain=case.blockchain,
                suspect_wallet=case.suspect_wallet
            )
    return case

@router.post("", response_model=CaseResponse)
def create_case(
    case_in: CaseCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = CaseService.create_case(db, case_in, current_user)
    try:
        CrossCaseIntelligenceService.scan_and_link(db, case)
    except Exception as e:
        logger.error(f"[CrossCase] Error scanning links on case create: {e}")

    # Fire Supabase real-time notification to assigned investigator
    if case.assigned_investigator_id:
        background_tasks.add_task(
            supabase_service.notify_investigator_assigned,
            investigator_id=case.assigned_investigator_id,
            case_id=case.case_id,
            victim_name=case.victim_name,
            amount=case.amount_lost
        )

        # Fire SMS alert to assigned investigator's mobile number
        inv_user = db.query(User).filter(User.id == case.assigned_investigator_id).first()
        target_phone = (inv_user.phone_number if inv_user and inv_user.phone_number else None) or settings.DEFAULT_ALERT_PHONE_NUMBER
        inv_name = inv_user.full_name if inv_user else "Forensic Officer"
        if target_phone:
            background_tasks.add_task(
                SMSService.send_new_case_sms,
                recipient_phone=target_phone,
                recipient_name=inv_name,
                case_id=case.case_id,
                case_number=case.case_number or case.case_id,
                victim_name=case.victim_name,
                amount=case.amount_lost,
                currency=case.currency,
                blockchain=case.blockchain,
                suspect_wallet=case.suspect_wallet
            )
    return case

@router.get("", response_model=List[CaseResponse])
def get_cases(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return CaseService.get_cases(db, current_user)

@router.get("/{case_id}", response_model=CaseResponse)
def get_case(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = CaseService.get_case_by_id(db, case_id, current_user)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found or access denied")
    return case

@router.post("/{case_id}/accept", response_model=CaseResponse)
def accept_case(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.INVESTIGATOR, UserRole.SUPERVISOR, UserRole.ADMINISTRATOR]))
):
    try:
        return CaseService.accept_case(db, case_id, current_user)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/{case_id}/start-investigation", response_model=CaseResponse)
def start_investigation(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.INVESTIGATOR, UserRole.SUPERVISOR, UserRole.ADMINISTRATOR]))
):
    try:
        return CaseService.start_investigation(db, case_id, current_user)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/{case_id}/assignments", response_model=List[CaseAssignmentResponse])
def get_case_assignments(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = CaseService.get_case_by_id(db, case_id, current_user)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found or access denied")
    assignments = db.query(CaseAssignment).filter(CaseAssignment.case_id == case.case_id).all()
    result = []
    for a in assignments:
        inv_name = None
        if a.investigator:
            inv_name = a.investigator.full_name
        result.append(CaseAssignmentResponse(
            id=a.id,
            case_id=a.case_id,
            case_number=case.case_number,
            victim_id=a.victim_id,
            investigator_id=a.investigator_id,
            investigator_name=inv_name,
            status=a.status.value,
            assigned_at=a.assigned_at,
            accepted_at=a.accepted_at,
            notes=a.notes
        ))
    return result

@router.patch("/{case_id}", response_model=CaseResponse)
def update_case(
    case_id: str,
    updates: CaseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.INVESTIGATOR, UserRole.SUPERVISOR, UserRole.ADMINISTRATOR]))
):
    case = CaseService.update_case(db, case_id, updates, current_user)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case

@router.post("/seed-demo", response_model=CaseResponse)
def seed_demo_case(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Initializes official SIH 2026 Hackathon Demo Case"""
    return DemoService.seed_demo_case(db)

@router.post("/{case_id}/notes", response_model=NoteResponse)
def add_case_note(
    case_id: str,
    note_in: NoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.INVESTIGATOR, UserRole.SUPERVISOR]))
):
    case = CaseService.get_case_by_id(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    note = InvestigatorNote(
        case_id=case_id,
        author_id=current_user.id,
        content=note_in.content
    )
    db.add(note)
    db.commit()
    db.refresh(note)

    from app.services.timeline_service import TimelineService
    TimelineService.record_event(
        db=db,
        case_id=case_id,
        event_type="NOTE_ADDED",
        title="Investigator Note Added",
        description=f"Note added by {current_user.full_name}: {note.content[:60]}...",
        actor=current_user.username
    )

    return {
        "id": note.id,
        "case_id": note.case_id,
        "author_id": note.author_id,
        "author_name": current_user.full_name,
        "content": note.content,
        "created_at": note.created_at
    }

@router.get("/{case_id}/notes", response_model=List[NoteResponse])
def get_case_notes(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notes = db.query(InvestigatorNote).filter(InvestigatorNote.case_id == case_id).order_by(InvestigatorNote.created_at.desc()).all()
    return [
        {
            "id": n.id,
            "case_id": n.case_id,
            "author_id": n.author_id,
            "author_name": n.author.full_name if n.author else "Investigator",
            "content": n.content,
            "created_at": n.created_at
        }
        for n in notes
    ]

@router.get("/{case_id}/workspace")
def get_case_workspace(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns the comprehensive unified Investigation Workspace for a case (Phase 9).
    """
    case = CaseService.get_case_by_id(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")

    from app.services.timeline_service import TimelineService
    from app.evidence.evidence_service import EvidenceService
    from app.priority.service import PriorityService
    from app.analysis.pattern_service import PatternService
    from app.risk.risk_service import RiskService

    # Gather data components
    transactions = db.query(Transaction).filter(
        (Transaction.case_id == case_id) |
        (Transaction.from_address.ilike(case.suspect_wallet)) |
        (Transaction.to_address.ilike(case.suspect_wallet))
    ).all()

    evidence_items = EvidenceService.get_case_evidence(db, case_id)
    notes = db.query(InvestigatorNote).filter(InvestigatorNote.case_id == case_id).order_by(InvestigatorNote.created_at.desc()).all()
    timeline = TimelineService.get_timeline(db, case_id)

    # Risk & patterns
    risk = db.query(RiskAssessmentRecord).filter(
        RiskAssessmentRecord.wallet_address.ilike(case.suspect_wallet)
    ).order_by(RiskAssessmentRecord.created_at.desc()).first()

    patterns = db.query(AnalysisPattern).filter(
        AnalysisPattern.wallet_address.ilike(case.suspect_wallet)
    ).all()

    # Priority leads
    priority_leads = db.query(PriorityItem).filter(
        PriorityItem.case_id == case_id
    ).order_by(PriorityItem.priority_score.desc()).all()

    current_status = case.status.value if hasattr(case.status, 'value') else str(case.status)
    if current_user.role in [UserRole.SUPERVISOR, UserRole.ADMINISTRATOR]:
        all_options = [
            "UNDER_INVESTIGATION", "EVIDENCE_REVIEW", "SUPERVISOR_REVIEW", 
            "ON_HOLD", "ESCALATED", "RESOLVED", "CLOSED"
        ]
        allowed_transitions = [st for st in all_options if st != current_status]
    else:
        transition_map = {
            "NEW": ["UNDER_INVESTIGATION", "ON_HOLD"],
            "OPEN": ["UNDER_INVESTIGATION", "ON_HOLD"],
            "ASSIGNED": ["UNDER_INVESTIGATION", "ON_HOLD"],
            "ACCEPTED": ["UNDER_INVESTIGATION", "ON_HOLD"],
            "UNDER_INVESTIGATION": ["EVIDENCE_REVIEW", "SUPERVISOR_REVIEW", "ON_HOLD"],
            "ANALYSIS_RUNNING": ["UNDER_INVESTIGATION", "EVIDENCE_REVIEW"],
            "EVIDENCE_REVIEW": ["SUPERVISOR_REVIEW", "UNDER_INVESTIGATION"],
            "REPORT_PENDING": ["SUPERVISOR_REVIEW", "UNDER_INVESTIGATION"],
            "SUPERVISOR_REVIEW": ["UNDER_INVESTIGATION"],
            "ON_HOLD": ["UNDER_INVESTIGATION"],
            "ESCALATED": ["UNDER_INVESTIGATION"],
            "RESOLVED": ["UNDER_INVESTIGATION"],
            "CLOSED": []
        }
        allowed_transitions = transition_map.get(current_status, ["UNDER_INVESTIGATION", "SUPERVISOR_REVIEW"])

    return {
        "case_id": case.case_id,
        "title": case.title or f"Investigation: {case.complaint_reference}",
        "description": case.description,
        "status": case.status.value,
        "priority": case.priority.value,
        "allowed_transitions": allowed_transitions,
        "victim_name": case.victim_name,
        "amount_lost": case.amount_lost,
        "currency": case.currency,
        "incident_date": case.incident_date,
        "suspect_wallet": case.suspect_wallet,
        "blockchain": case.blockchain,
        "created_at": case.created_at,
        "updated_at": case.updated_at,
        "assigned_investigator": {
            "id": case.assigned_investigator.id,
            "name": case.assigned_investigator.full_name,
            "username": case.assigned_investigator.username,
            "badge": case.assigned_investigator.badge_number
        } if case.assigned_investigator else None,
        "transactions_count": len(transactions),
        "evidence_count": len(evidence_items),
        "notes_count": len(notes),
        "risk_summary": {
            "risk_score": risk.risk_score if risk else 0.0,
            "risk_category": risk.risk_category if risk else "LOW",
            "rule_based_score": risk.rule_based_score if risk else 0.0
        },
        "patterns_count": len(patterns),
        "priority_leads": [
            {
                "id": p.id,
                "object_type": p.object_type,
                "object_id": p.object_id,
                "wallet_address": p.wallet_address,
                "priority_score": p.priority_score,
                "priority_category": p.priority_category,
                "status": p.status,
                "reasons": p.reasons
            }
            for p in priority_leads[:10]
        ],
        "timeline": [
            {
                "id": t.id,
                "event_type": t.event_type,
                "title": t.title,
                "description": t.description,
                "actor": t.actor,
                "timestamp": t.timestamp
            }
            for t in timeline
        ]
    }

@router.get("/{case_id}/timeline")
def get_case_timeline(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = CaseService.get_case_by_id(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")
    from app.services.timeline_service import TimelineService
    return TimelineService.get_timeline(db, case_id)

@router.get("/{case_id}/campaign-timeline", response_model=ScamCampaignTimelineResponse)
def get_case_campaign_timeline(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Reconstructs the complete chronology of a crypto fraud by combining:
    1. Real-World human events (Victim approached, money sent, phishing inducement)
    2. Blockchain ledger events (Wallet A received, Wallet A -> B, Wallet B -> C)
    3. Multi-victim syndicate correlation events (Other victims reporting, campaign identified)
    4. Official police / cyber cell milestones (Section 91 CrPC notice, case registration)
    """
    case = CaseService.get_case_by_id(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")
    from app.services.timeline_service import TimelineService
    return TimelineService.get_scam_campaign_timeline(db, case_id)

@router.post("/{case_id}/events")
def add_case_real_world_event(
    case_id: str,
    event_in: RealWorldEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Allows investigators or victims to record real-world timeline events
    (e.g., contacted on Telegram, received spoofed bank call, clicked airdrop URL).
    """
    case = CaseService.get_case_by_id(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")
    from app.services.timeline_service import TimelineService
    return TimelineService.add_real_world_event(
        db, case_id, event_in, actor=current_user.full_name or current_user.username
    )

@router.get("/{case_id}/evidence", response_model=List[EvidenceResponse])
def get_case_evidence_items(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = CaseService.get_case_by_id(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")
    from app.evidence.evidence_service import EvidenceService
    return EvidenceService.get_case_evidence(db, case_id)

@router.post("/{case_id}/evidence", response_model=EvidenceResponse)
def associate_case_evidence(
    case_id: str,
    evidence_in: EvidenceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.INVESTIGATOR, UserRole.SUPERVISOR]))
):
    case = CaseService.get_case_by_id(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")

    evidence_in.case_id = case_id
    from app.evidence.evidence_service import EvidenceService
    from app.services.timeline_service import TimelineService
    saved = EvidenceService.save_evidence(db, evidence_in, current_user.username)

    TimelineService.record_event(
        db=db,
        case_id=case_id,
        event_type="EVIDENCE_ATTACHED",
        title=f"Evidence Attached: {saved.tag}",
        description=f"Transaction {saved.transaction_hash[:12]}... attached to evidence locker by {current_user.full_name}.",
        actor=current_user.username,
        metadata={"evidence_id": saved.evidence_id, "tx_hash": saved.transaction_hash}
    )
    return saved

class CaseStatusUpdateRequest(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None

@router.post("/{case_id}/status", response_model=CaseResponse)
@router.patch("/{case_id}/status", response_model=CaseResponse)
def update_case_status(
    case_id: str,
    payload: Optional[CaseStatusUpdateRequest] = None,
    new_status: Optional[str] = Query(None, description="Target status name"),
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.INVESTIGATOR, UserRole.SUPERVISOR, UserRole.ADMINISTRATOR]))
):
    case = CaseService.get_case_by_id(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")

    target_status = None
    if payload and payload.status:
        target_status = payload.status
    elif new_status:
        target_status = new_status

    if not target_status:
        raise HTTPException(status_code=400, detail="Missing target status")

    status_clean = target_status.upper().strip()
    try:
        case.status = CaseStatus(status_clean)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{target_status}'. Allowed: {[s.value for s in CaseStatus]}."
        )

    case.updated_at = datetime.datetime.utcnow()

    # Save note if provided
    note_text = payload.notes if payload and payload.notes else None
    if note_text:
        note = InvestigatorNote(
            case_id=case_id,
            author_id=current_user.id,
            content=f"[Status -> {status_clean}] {note_text}"
        )
        db.add(note)

    db.commit()
    db.refresh(case)

    from app.services.timeline_service import TimelineService
    TimelineService.record_event(
        db=db,
        case_id=case_id,
        event_type="STATUS_CHANGED",
        title=f"Status Changed to {status_clean}",
        description=f"Case status updated to {status_clean} by {current_user.full_name} ({current_user.role.value})." + (f" Note: {note_text}" if note_text else ""),
        actor=current_user.username
    )

    # --- Supabase Real-Time Notifications ---
    if background_tasks:
        # Investigator sends to Supervisor Review → notify supervisor
        if status_clean == "SUPERVISOR_REVIEW":
            supervisor = db.query(User).filter(User.role == UserRole.SUPERVISOR).first()
            if supervisor:
                background_tasks.add_task(
                    supabase_service.notify_supervisor_review,
                    supervisor_id=supervisor.id,
                    case_id=case_id,
                    investigator_name=current_user.full_name
                )

        # Supervisor approves → notify victim
        if status_clean in ("RESOLVED", "CLOSED"):
            if case.victim_id:
                background_tasks.add_task(
                    supabase_service.notify_victim_case_resolved,
                    victim_id=case.victim_id,
                    case_id=case_id,
                    investigator_name=case.assigned_investigator.full_name if case.assigned_investigator else "Investigator"
                )

    return case


@router.post("/{case_id}/transactions/sync")
def sync_case_transactions(
    case_id: str,
    db: Session = Depends(get_db)
):
    """
    Synchronizes on-chain Ethereum Sepolia transactions for the suspect wallet of a case.
    Normalizes data, avoids duplicates, associates records with the case, and returns sync metrics.
    """
    from fastapi.responses import JSONResponse
    from app.services.transaction_service import TransactionService
    from app.services.timeline_service import TimelineService

    try:
        res = TransactionService.sync_case_transactions(db, case_id)
        TimelineService.record_event(
            db=db,
            case_id=case_id,
            event_type="TRANSACTIONS_SYNCED",
            title="On-Chain Transactions Synchronized",
            description=f"Synchronized {res.get('inserted', 0)} new transactions from Sepolia blockchain.",
            actor="SYSTEM",
            metadata=res
        )
        return res
    except ValueError as e:
        status_code = 404 if "not found" in str(e).lower() else 400
        return JSONResponse(
            status_code=status_code,
            content={"error": str(e)}
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to sync case transactions: {str(e)}"}
        )

@router.get("/{case_id}/recommendations", response_model=CaseRecommendationsResponse)
def get_case_recommendations(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = CaseService.get_case_by_id(db, case_id, current_user)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found or access denied")
    from app.services.recommendations_service import RecommendationsService
    return RecommendationsService.generate_recommendations(db, case_id)

@router.get("/{case_id}/export/ncrp")
def export_ncrp_format(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = CaseService.get_case_by_id(db, case_id, current_user)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found or access denied")
    from app.integrations.ncrp_adapter import NCRPAdapter
    return NCRPAdapter.export_ncrp_format(case, db)

@router.get("/{case_id}/export/sahyog")
def export_sahyog_format(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = CaseService.get_case_by_id(db, case_id, current_user)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found or access denied")
    from app.integrations.ncrp_adapter import NCRPAdapter
    return NCRPAdapter.export_sahyog_format(case, db)


@router.get("/{case_id}/subpoena/{wallet_address}")
def generate_wallet_subpoena(
    case_id: str,
    wallet_address: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generates and downloads an official Statutory Subpoena Notice under Section 94 BNSS, 2023 /
    Section 91 CrPC, 1973 directing VASPs / Exchanges to freeze the target wallet and furnish KYC/IP ledgers.
    """
    case = CaseService.get_case_by_id(db, case_id, current_user)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found or access denied")

    from app.services.subpoena_service import SubpoenaService

    # Resolve investigating officer details
    inv_name = current_user.full_name or "Investigating Officer"
    inv_designation = "Lead Cyber Crime Forensics Investigator"
    if case.assigned_investigator:
        inv_name = case.assigned_investigator.full_name or inv_name
        inv_designation = getattr(case.assigned_investigator, 'specialization', None) or inv_designation

    victim_name = case.unregistered_victim_name or case.victim_name or "Complainant Complainant"
    amount_lost = float(case.amount_lost) if case.amount_lost else 0.0
    currency = case.currency or "INR"
    blockchain = case.blockchain or "Ethereum"
    incident_date = str(case.incident_date or case.created_at or "")
    external_fir = case.external_reference or case.case_number or f"FIR-NCRP-{case.case_id}"

    pdf_bytes = SubpoenaService.generate_subpoena_pdf(
        case_id=case.case_id,
        case_number=case.case_number or case.case_id,
        wallet_address=wallet_address,
        blockchain=blockchain,
        investigator_name=inv_name,
        investigator_designation=inv_designation,
        victim_name=victim_name,
        amount_lost=amount_lost,
        currency=currency,
        incident_date=incident_date,
        external_fir=external_fir
    )

    clean_short_wallet = wallet_address[:10] if len(wallet_address) >= 10 else wallet_address
    filename = f"Subpoena_Sec94_BNSS_{case.case_id}_{clean_short_wallet}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )




