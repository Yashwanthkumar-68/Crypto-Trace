import httpx
import os
from datetime import datetime

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://obcxpsriultifppkskax.supabase.co")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iY3hwc3JpdWx0aWZwcGtza2F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2ODAyMjgsImV4cCI6MjEwNDI1NjIyOH0.bbzfjZybyx4Bt0Y5quu8K7AZY_URdWQIebn2pN8XcGw")

HEADERS = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

TABLE_URL = f"{SUPABASE_URL}/rest/v1/notifications"


def _insert_notification(recipient_user_id: int, case_id: str, message: str, event_type: str):
    """
    Inserts a notification row into Supabase `notifications` table.
    Supabase Realtime will instantly broadcast this to subscribed frontend clients.
    """
    payload = {
        "user_id": recipient_user_id,
        "case_id": case_id,
        "title": f"Case Alert: {event_type}",
        "message": message,
        "notification_type": event_type,
        "is_read": False,
        "created_at": datetime.utcnow().isoformat()
    }
    try:
        response = httpx.post(TABLE_URL, json=payload, headers=HEADERS, timeout=10.0)
        if response.status_code not in (200, 201):
            print(f"[SupabaseService] Failed to insert notification: {response.text}")
        else:
            print(f"[SupabaseService] Notification sent -> user_id={recipient_user_id}, event={event_type}")
    except Exception as e:
        print(f"[SupabaseService] Error sending notification: {e}")


def notify_investigator_assigned(investigator_id: int, case_id: str, victim_name: str, amount: float):
    """
    Triggered when a victim files a complaint and the case is assigned to an investigator.
    """
    msg = (
        f"🚨 New Case Assigned: [{case_id}]\n"
        f"Victim: {victim_name} has filed a complaint.\n"
        f"Amount Lost: ₹{amount:,.2f}\n"
        f"Please login to review and begin investigation immediately."
    )
    _insert_notification(investigator_id, case_id, msg, "CASE_ASSIGNED")


def notify_supervisor_review(supervisor_id: int, case_id: str, investigator_name: str):
    """
    Triggered when an investigator submits a case for supervisor review.
    """
    msg = (
        f"📋 Case Ready for Review: [{case_id}]\n"
        f"Investigator {investigator_name} has completed the forensic analysis.\n"
        f"Please review the case report and approve or reject closure."
    )
    _insert_notification(supervisor_id, case_id, msg, "SUPERVISOR_REVIEW")


def notify_victim_case_resolved(victim_id: int, case_id: str, investigator_name: str):
    """
    Triggered when a supervisor approves and marks a case as RESOLVED or CLOSED.
    """
    msg = (
        f"✅ Your Case [{case_id}] Has Been Resolved!\n"
        f"The forensic investigation by {investigator_name} has been approved by the supervisor.\n"
        f"Please login to CryptoTrace to download your case report and next steps for fund recovery."
    )
    _insert_notification(victim_id, case_id, msg, "CASE_RESOLVED")
