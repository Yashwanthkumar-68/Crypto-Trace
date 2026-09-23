from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.database.models import User
from app.api.auth import get_current_user
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["Analytics Dashboard"])


@router.get("")
@router.get("/overview")
def get_analytics_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns aggregate statistics for the forensic analytics dashboard."""
    return AnalyticsService.get_overview(db)


@router.get("/trends")
def get_analytics_trends(
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns daily time-series data for the last N days."""
    return AnalyticsService.get_trends(db, days)


@router.get("/risk-distribution")
def get_risk_distribution(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns risk score histogram distribution."""
    return AnalyticsService.get_risk_distribution(db)


@router.get("/heatmap")
def get_activity_heatmap(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns hourly transaction activity heatmap data."""
    return AnalyticsService.get_heatmap_data(db)


@router.get("/top-risk-cases")
def get_top_risk_cases(
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns top N highest-risk active cases."""
    return AnalyticsService.get_top_risk_cases(db, limit)
