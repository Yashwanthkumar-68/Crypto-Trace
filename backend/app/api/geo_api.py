from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.database.models import User
from app.api.auth import get_current_user
from app.services.geolocation_service import GeolocationService

router = APIRouter(prefix="/geo", tags=["Geo-Tagging & IP Correlation"])


class IPLookupRequest(BaseModel):
    ip_address: str


@router.get("/vasp-locations")
def get_vasp_locations(
    current_user: User = Depends(get_current_user)
):
    """Returns all known VASP headquarters and office locations with coordinates."""
    return GeolocationService.get_vasp_locations()


@router.get("/case/{case_id}/map")
def get_case_geo_data(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns geo data for all entities associated with a case."""
    result = GeolocationService.get_case_geo_data(db, case_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.post("/ip-lookup")
def ip_lookup(
    req: IPLookupRequest,
    current_user: User = Depends(get_current_user)
):
    """Resolves an IP address to geographic coordinates."""
    return GeolocationService.ip_lookup(req.ip_address)


@router.get("/jurisdictions")
def get_jurisdiction_summary(
    current_user: User = Depends(get_current_user)
):
    """Returns VASP jurisdiction summary for cross-border analysis."""
    return GeolocationService.get_jurisdiction_summary()
