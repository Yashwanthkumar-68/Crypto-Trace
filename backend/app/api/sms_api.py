from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from app.services.sms_service import SMSService
from app.api.auth import get_current_user
from app.database.models import User

router = APIRouter(prefix="/sms", tags=["SMS Notifications"])

class SMSTestRequest(BaseModel):
    phone_number: str
    message: Optional[str] = "🚨 [CryptoTrace Test SMS] Testing real-time investigator alert dispatch."

@router.post("/test")
def test_sms_dispatch(
    req: SMSTestRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Test sending an SMS to any designated phone number.
    Returns status and provider response.
    """
    res = SMSService.send_sms(
        to_phone=req.phone_number,
        message=req.message,
        context={"triggered_by": current_user.username}
    )
    return res

@router.get("/logs")
def get_sms_logs(
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user)
):
    """
    Returns recent SMS dispatch logs.
    """
    return {
        "active_provider": SMSService.get_active_provider(),
        "total_dispatched": len(SMSService.get_logs(100)),
        "logs": SMSService.get_logs(limit)
    }

@router.get("/config")
def get_sms_config():
    """
    Returns public SMS provider status without leaking secrets.
    """
    provider = SMSService.get_active_provider()
    return {
        "active_provider": provider,
        "is_simulated": provider == "SIMULATED_DEMO_GATEWAY",
        "supported_providers": ["FAST2SMS", "TWILIO", "MSG91", "SIMULATED_DEMO_GATEWAY"]
    }
