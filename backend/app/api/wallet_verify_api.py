from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.database.models import User
from app.database.schemas import WalletVerificationRequest, WalletVerificationResponse
from app.api.auth import get_optional_current_user
from app.services.wallet_verification_service import WalletVerificationService

router = APIRouter(prefix="/wallets", tags=["Wallet Verification & Citizen Defense"])

@router.post("/verify", response_model=WalletVerificationResponse)
def verify_recipient_wallet(
    request: WalletVerificationRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Citizen Pre-Transfer Wallet Scam Check.
    Allows authenticated users / potential victims to verify whether a recipient wallet
    is under active investigation or flagged in cyber complaints before transferring funds.
    """
    if not request.wallet_address or not request.wallet_address.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wallet address cannot be empty"
        )
    return WalletVerificationService.verify_wallet_for_citizen(db, request, current_user)
