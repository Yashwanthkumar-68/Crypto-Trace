from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List

from app.database.database import get_db
from app.database.models import User, Case
from app.database.schemas import CaseSyndicateIntelResponse, GlobalSyndicateCluster
from app.api.auth import get_current_user
from app.services.cross_case_service import CrossCaseIntelligenceService

router = APIRouter(tags=["Cross-Case Intelligence & Link Analysis"])

@router.get("/cases/{case_id}/links", response_model=CaseSyndicateIntelResponse)
def get_case_links(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns all other cases linked to this case via shared suspect wallets,
    along with cumulative crime ring loss amounts and victim metrics.
    """
    return CrossCaseIntelligenceService.get_case_syndicate_intel(db, case_id)

@router.post("/cases/{case_id}/scan-links", response_model=CaseSyndicateIntelResponse)
def scan_case_links(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Manually triggers a fresh cross-case link scan against all cases in the database.
    """
    case = db.query(Case).filter(Case.case_id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    CrossCaseIntelligenceService.scan_and_link(db, case)
    return CrossCaseIntelligenceService.get_case_syndicate_intel(db, case_id)

@router.get("/intelligence/syndicates", response_model=List[GlobalSyndicateCluster])
def get_all_syndicates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns all detected crypto crime rings and syndicates across the entire platform.
    """
    return CrossCaseIntelligenceService.get_all_syndicates(db)
