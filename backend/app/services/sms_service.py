import os
import logging
import httpx
from datetime import datetime
from typing import Optional, Dict, Any, List
from app.config import settings

logger = logging.getLogger("sih26183.sms")

# In-memory record of dispatched SMS messages for monitoring & demo audit
DISPATCHED_SMS_LOGS: List[Dict[str, Any]] = []

def clean_phone_number(phone: str) -> str:
    """Normalize phone number to standard E.164 or 10-digit format."""
    digits = "".join(ch for ch in str(phone) if ch.isdigit())
    if len(digits) == 10:
        return f"+91{digits}"
    elif len(digits) == 12 and digits.startswith("91"):
        return f"+{digits}"
    elif phone.startswith("+"):
        return phone
    return f"+{digits}"

class SMSService:
    @staticmethod
    def get_active_provider() -> str:
        """Determines which SMS delivery engine is active."""
        if getattr(settings, "FAST2SMS_API_KEY", None) or os.getenv("FAST2SMS_API_KEY"):
            return "FAST2SMS"
        if (
            (getattr(settings, "TWILIO_ACCOUNT_SID", None) or os.getenv("TWILIO_ACCOUNT_SID"))
            and (getattr(settings, "TWILIO_AUTH_TOKEN", None) or os.getenv("TWILIO_AUTH_TOKEN"))
            and (getattr(settings, "TWILIO_PHONE_NUMBER", None) or os.getenv("TWILIO_PHONE_NUMBER"))
        ):
            return "TWILIO"
        if getattr(settings, "MSG91_AUTH_KEY", None) or os.getenv("MSG91_AUTH_KEY"):
            return "MSG91"
        return "SIMULATED_DEMO_GATEWAY"

    @classmethod
    def send_sms(cls, to_phone: str, message: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Dispatches an SMS to the recipient phone number using available providers.
        Falls back to Simulated Demo Gateway with clear logs if no paid API credentials are configured.
        """
        normalized_phone = clean_phone_number(to_phone)
        provider = cls.get_active_provider()
        now_str = datetime.utcnow().isoformat()
        
        log_entry: Dict[str, Any] = {
            "id": f"sms-{len(DISPATCHED_SMS_LOGS) + 1:04d}",
            "recipient": normalized_phone,
            "raw_recipient": to_phone,
            "provider": provider,
            "message": message,
            "timestamp": now_str,
            "status": "PENDING",
            "error": None,
            "context": context or {}
        }

        # 1. Fast2SMS Provider (Very common for Indian phone numbers)
        fast2sms_key = getattr(settings, "FAST2SMS_API_KEY", None) or os.getenv("FAST2SMS_API_KEY")
        if provider == "FAST2SMS" and fast2sms_key:
            try:
                # Fast2SMS expects 10 digit Indian number without +91
                ten_digit = normalized_phone.replace("+91", "").replace("+", "")
                url = "https://www.fast2sms.com/dev/bulkV2"
                headers = {"authorization": fast2sms_key}
                payload = {
                    "route": "q",
                    "message": message,
                    "language": "english",
                    "flash": 0,
                    "numbers": ten_digit
                }
                with httpx.Client(timeout=10.0) as client:
                    resp = client.post(url, headers=headers, json=payload)
                    if resp.status_code == 200 and resp.json().get("return"):
                        log_entry["status"] = "DELIVERED"
                        log_entry["provider_response"] = resp.json()
                        logger.info(f"[SMS Delivered via Fast2SMS] to {normalized_phone}")
                    else:
                        log_entry["status"] = "FAILED"
                        log_entry["error"] = resp.text
                        logger.error(f"[Fast2SMS Error] {resp.text}")
            except Exception as e:
                log_entry["status"] = "FAILED"
                log_entry["error"] = str(e)
                logger.error(f"[Fast2SMS Exception] {e}")

        # 2. Twilio Provider
        elif provider == "TWILIO":
            account_sid = getattr(settings, "TWILIO_ACCOUNT_SID", None) or os.getenv("TWILIO_ACCOUNT_SID")
            auth_token = getattr(settings, "TWILIO_AUTH_TOKEN", None) or os.getenv("TWILIO_AUTH_TOKEN")
            from_phone = getattr(settings, "TWILIO_PHONE_NUMBER", None) or os.getenv("TWILIO_PHONE_NUMBER")
            try:
                url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
                data = {
                    "To": normalized_phone,
                    "From": from_phone,
                    "Body": message
                }
                with httpx.Client(timeout=10.0) as client:
                    resp = client.post(url, auth=(account_sid, auth_token), data=data)
                    if resp.status_code in (200, 201):
                        log_entry["status"] = "DELIVERED"
                        log_entry["provider_response"] = resp.json()
                        logger.info(f"[SMS Delivered via Twilio] to {normalized_phone}")
                    else:
                        log_entry["status"] = "FAILED"
                        log_entry["error"] = resp.text
                        logger.error(f"[Twilio Error] {resp.text}")
            except Exception as e:
                log_entry["status"] = "FAILED"
                log_entry["error"] = str(e)
                logger.error(f"[Twilio Exception] {e}")

        # 3. Simulated Demo Gateway (Zero external cost / instant delivery)
        else:
            log_entry["status"] = "SENT_SIMULATED"
            clean_msg = message.encode("ascii", "replace").decode("ascii")
            banner = (
                "\n+------------------------------------------------------------------------------+\n"
                "|                     [CRYPTO-TRACE SMS NOTIFICATION]                          |\n"
                "+------------------------------------------------------------------------------+\n"
                f"| TO: {normalized_phone:<73}|\n"
                f"| TIME: {now_str:<71}|\n"
                f"| GATEWAY: {provider:<68}|\n"
                f"| STATUS: {log_entry['status']:<69}|\n"
                "+------------------------------------------------------------------------------+\n"
            )
            for line in clean_msg.split("\n"):
                banner += f"| {line:<76} |\n"
            banner += "+------------------------------------------------------------------------------+\n"
            try:
                print(banner)
            except Exception:
                pass
            logger.info(f"[SMS SIMULATED] Sent to {normalized_phone}: {message[:60]}...")

        DISPATCHED_SMS_LOGS.insert(0, log_entry)
        if len(DISPATCHED_SMS_LOGS) > 100:
            DISPATCHED_SMS_LOGS.pop()

        return log_entry

    @classmethod
    def send_new_case_sms(
        cls,
        recipient_phone: str,
        recipient_name: str,
        case_id: str,
        case_number: str,
        victim_name: str,
        amount: float,
        currency: str = "INR",
        blockchain: str = "Ethereum",
        suspect_wallet: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Sends an urgent SMS notification to an assigned investigator when a new complaint is filed.
        """
        short_wallet = (
            f"{suspect_wallet[:8]}...{suspect_wallet[-6:]}"
            if suspect_wallet and len(suspect_wallet) > 14
            else (suspect_wallet or "Pending analysis")
        )
        msg = (
            f"🚨 [CryptoTrace Urgent Alert]\n"
            f"Officer {recipient_name}, new fraud case assigned: {case_number} ({case_id})\n"
            f"Complainant: {victim_name}\n"
            f"Loss: {amount:,.2f} {currency} | Network: {blockchain}\n"
            f"Suspect: {short_wallet}\n"
            f"Login to begin forensics: http://localhost:5173"
        )
        return cls.send_sms(
            to_phone=recipient_phone,
            message=msg,
            context={
                "case_id": case_id,
                "case_number": case_number,
                "victim_name": victim_name,
                "amount": amount,
                "currency": currency,
                "blockchain": blockchain,
                "officer": recipient_name
            }
        )

    @staticmethod
    def get_logs(limit: int = 50) -> List[Dict[str, Any]]:
        return DISPATCHED_SMS_LOGS[:limit]
