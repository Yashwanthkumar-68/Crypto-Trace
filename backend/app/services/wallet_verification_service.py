import datetime
import logging
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.models import (
    Case, CaseLink, AddressLabel, AuditLog, User
)
from app.database.schemas import (
    WalletVerificationRequest, WalletVerificationResponse
)

logger = logging.getLogger("sih26183.wallet_verify")

class WalletVerificationService:
    @classmethod
    def verify_wallet_for_citizen(
        cls,
        db: Session,
        request: WalletVerificationRequest,
        current_user: User
    ) -> WalletVerificationResponse:
        """
        Public/Citizen Fraud Prevention Verification Service.
        Allows potential victims to verify whether a recipient wallet is flagged
        in existing cybercrime complaints or crime rings before transferring funds.
        
        Strict Law Enforcement OPSEC Safeguards:
        - NEVER exposes internal case IDs, FIR numbers, officer identities, or victim details.
        - NEVER presents an unflagged private wallet as 'Safe' (prevents false sense of security).
        - Records search queries into the threat intelligence audit log.
        """
        clean_wallet = request.wallet_address.strip()
        norm_wallet = clean_wallet.lower()
        blockchain = request.blockchain or "Ethereum"

        # 1. Search existing cyber complaints
        matching_cases = db.query(Case).filter(
            Case.suspect_wallet.isnot(None),
            func.lower(Case.suspect_wallet) == norm_wallet
        ).all()
        complaint_count = len(matching_cases)

        # 2. Check for Crime Syndicate / Ring linkages
        syndicate_link = db.query(CaseLink).filter(
            func.lower(CaseLink.shared_wallet) == norm_wallet,
            CaseLink.syndicate_tag.isnot(None)
        ).first()

        syndicate_detected = syndicate_link is not None
        syndicate_tag = syndicate_link.syndicate_tag if syndicate_link else None

        # 3. Check for known exchange or threat labels
        label_obj = db.query(AddressLabel).filter(
            func.lower(AddressLabel.address) == norm_wallet
        ).first()
        known_label = label_obj.label if label_obj else None

        # 4. Determine Risk Tier & Action Directives
        safety_checklist = [
            "Did someone on Telegram, WhatsApp, or Instagram promise guaranteed daily or weekly returns?",
            "Are you being asked to complete 'online review tasks' or 'rating jobs' requiring crypto deposits?",
            "Are you being told to pay a 'tax', 'channel fee', or 'verification deposit' to withdraw your profits?",
            "Did an online acquaintance or romance match unexpectedly pivot into teaching you crypto trading?",
            "Has someone impersonating Customs, Police, ED, or CBI demanded that you transfer funds into a 'safe wallet'?"
        ]

        if complaint_count > 0 or syndicate_detected:
            risk_tier = "CRITICAL"
            risk_score = min(95.0 + (complaint_count * 1.5), 99.9)
            action_directive = "DO_NOT_TRANSFER"
            warning_title = "CRITICAL DANGER: CONFIRMED SCAM INFRASTRUCTURE"
            
            ring_text = f" and is linked to Organized Crime Syndicate '{syndicate_tag}'" if syndicate_tag else ""
            warning_message = (
                f"STOP IMMEDIATELY! DO NOT TRANSFER ANY MONEY OR ASSETS. "
                f"This recipient wallet has been identified in {complaint_count} formal cybercrime complaint(s){ring_text}. "
                f"Depositing funds to this address will result in total financial loss. "
                f"If you were coerced or instructed to pay this address, report the incident immediately."
            )
        elif known_label and any(bad in known_label.lower() for bad in ["scam", "phish", "hack", "mixer", "tornado", "drainer", "exploit"]):
            risk_tier = "HIGH"
            risk_score = 85.0
            action_directive = "SUSPICIOUS_HIGH_RISK"
            warning_title = "HIGH RISK: SUSPICIOUS CYBER THREAT ACTOR"
            warning_message = (
                f"WARNING: This wallet is flagged with threat category: '{known_label}'. "
                f"Interacting with this address carries extreme risk of unauthorized asset drainage or money laundering association."
            )
        elif known_label and any(vasp in known_label.lower() for vasp in ["binance", "wazirx", "coinbase", "kraken", "kucoin", "coindcx"]):
            risk_tier = "CAUTION"
            risk_score = 30.0
            action_directive = "VERIFY_VASP_KYC"
            warning_title = "EXCHANGE DEPOSIT HUB (PROCEED WITH CAUTION)"
            warning_message = (
                f"This address belongs to identified exchange infrastructure ({known_label}). "
                f"Fraudsters routinely ask victims to send funds directly into their personal exchange deposit accounts. "
                f"Ensure you are transferring only to your own verified account."
            )
        else:
            # Unreported Address - MUST NOT BE LABELED 'SAFE'
            risk_tier = "CAUTION"
            risk_score = 25.0
            action_directive = "PROCEED_WITH_EXTREME_CAUTION"
            warning_title = "UNREPORTED ADDRESS (EXERCISE EXTREME CAUTION)"
            warning_message = (
                "No prior police complaints are on file for this specific address yet. "
                "CRITICAL WARNING: Zero complaints does NOT mean this wallet is safe or legitimate! "
                "Over 90% of cryptocurrency investment scams create fresh, single-use disposable wallets for every new target. "
                "Legitimate investment advisors, government officers, and employers NEVER solicit cryptocurrency transfers via social messaging apps."
            )

        # 5. Log Query into Audit Trail (Threat Telemetry for Police Intelligence)
        try:
            db.add(AuditLog(
                user_id=current_user.id if current_user else None,
                username=current_user.username if current_user else "CITIZEN_ANON",
                action="CITIZEN_WALLET_PRE_CHECK_QUERY",
                case_id=None,
                metadata_json={
                    "queried_wallet": clean_wallet,
                    "blockchain": blockchain,
                    "risk_tier": risk_tier,
                    "complaints_found": complaint_count,
                    "syndicate_tag": syndicate_tag,
                    "timestamp": datetime.datetime.utcnow().isoformat()
                }
            ))
            db.commit()
        except Exception as e:
            logger.error(f"[WalletVerify] Audit log error: {e}")
            db.rollback()

        return WalletVerificationResponse(
            wallet_address=clean_wallet,
            blockchain=blockchain,
            risk_tier=risk_tier,
            risk_score=risk_score,
            is_flagged_in_complaints=complaint_count > 0,
            complaint_count=complaint_count,
            syndicate_detected=syndicate_detected,
            syndicate_tag=syndicate_tag,
            known_entity_label=known_label,
            warning_title=warning_title,
            warning_message=warning_message,
            action_directive=action_directive,
            safety_checklist=safety_checklist,
            inquiry_timestamp=datetime.datetime.utcnow()
        )
