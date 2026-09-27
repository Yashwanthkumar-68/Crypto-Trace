from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.database.database import get_db
from app.database.models import (
    User, UserRole, InvestigatorProfile, Case, CaseAssignment,
    CaseAssignmentStatus, Notification, AuditLog
)
from app.api.auth import get_current_user

router = APIRouter(prefix='/collaboration', tags=['Collaborative Investigation'])

# Fallback in-memory stores for instant real-time note threads and activities
_team_notes: Dict[str, List[Dict[str, Any]]] = {}     # case_id -> [{id, case_id, author, author_name, content, mentions, thread_id, created_at}]
_activity_feed: Dict[str, List[Dict[str, Any]]] = {}  # case_id -> [{id, case_id, actor, action, details, timestamp}]
_in_memory_collaborators: Dict[str, List[Dict[str, Any]]] = {}

class CollaboratorCreate(BaseModel):
    user_id: str
    username: str
    full_name: str
    role: Optional[str] = "investigator"
    permissions: Optional[List[str]] = []

class CollaborationInviteCreate(BaseModel):
    investigator_id: int
    message: str = Field(default="Requesting collaboration on tracing suspect wallet flows and peeling trails.")

class CollaborationResponse(BaseModel):
    action: str  # "ACCEPT" or "DECLINE"

class TeamNoteCreate(BaseModel):
    content: str
    mentions: Optional[List[str]] = []
    thread_id: Optional[str] = None

class ActivityCreate(BaseModel):
    action: str
    details: Optional[str] = ""

def log_activity(case_id: str, actor: str, action: str, details: str = ""):
    if case_id not in _activity_feed:
        _activity_feed[case_id] = []
    act = {
        "id": str(uuid.uuid4()),
        "case_id": case_id,
        "actor": actor,
        "action": action,
        "details": details,
        "timestamp": datetime.utcnow().isoformat()
    }
    _activity_feed[case_id].insert(0, act)
    return act

@router.get('/available-investigators')
def list_available_investigators(
    case_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns all registered investigators available for collaboration.
    If case_id is provided, includes collaboration status (ACCEPTED, PENDING, or NONE)
    for each investigator relative to that case.
    """
    investigators = (
        db.query(User, InvestigatorProfile)
        .outerjoin(InvestigatorProfile, User.id == InvestigatorProfile.user_id)
        .filter(
            or_(
                User.role == UserRole.INVESTIGATOR,
                User.role == UserRole.SUPERVISOR
            ),
            User.is_active == True
        )
        .all()
    )

    # Check existing assignments if case_id provided
    case_assignments_map = {}
    lead_investigator_id = None
    if case_id:
        target_case = db.query(Case).filter(or_(Case.case_id == case_id, Case.case_number == case_id)).first()
        if target_case:
            lead_investigator_id = target_case.assigned_investigator_id
            c_id = target_case.case_id
            assignments = db.query(CaseAssignment).filter(CaseAssignment.case_id == c_id).all()
            for a in assignments:
                case_assignments_map[a.investigator_id] = a

    results = []
    for user, prof in investigators:
        # Count active assigned cases
        active_cases = (
            db.query(func.count(Case.case_id))
            .filter(
                Case.assigned_investigator_id == user.id,
                ~Case.status.in_(["CLOSED", "RESOLVED", "REJECTED"])
            )
            .scalar() or 0
        )

        collab_status = "NONE"
        assignment_id = None
        invitation_notes = None
        
        if lead_investigator_id == user.id:
            collab_status = "LEAD"
        elif user.id in case_assignments_map:
            assign = case_assignments_map[user.id]
            collab_status = assign.status.value
            assignment_id = assign.id
            invitation_notes = assign.notes

        results.append({
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role.value,
            "organization": prof.organization if prof and prof.organization else "Cyber Crime Cell",
            "department": prof.department if prof and prof.department else "Financial Fraud Forensics",
            "experience_years": prof.experience_years if prof and prof.experience_years else 4,
            "specialization": prof.specialization if prof and prof.specialization else "Blockchain Asset Tracing",
            "badge_id": prof.badge_id if prof and prof.badge_id else f"POL-{user.id:04d}",
            "availability_status": prof.availability_status.value if prof and prof.availability_status else "AVAILABLE",
            "active_cases_count": active_cases,
            "is_current_user": user.id == current_user.id,
            "collaboration_status": collab_status,
            "assignment_id": assignment_id,
            "invitation_notes": invitation_notes
        })

    return results

@router.get('/cases/{case_id}/collaborators')
def list_case_collaborators(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns all active collaborators, primary assigned investigator,
    and pending collaboration invitations for the specified case.
    """
    target_case = db.query(Case).filter(or_(Case.case_id == case_id, Case.case_number == case_id)).first()
    if not target_case:
        raise HTTPException(status_code=404, detail="Case not found")

    c_id = target_case.case_id
    collaborator_items = []

    # 1. Lead / Primary Assigned Investigator
    if target_case.assigned_investigator_id:
        lead_user = db.query(User).filter(User.id == target_case.assigned_investigator_id).first()
        if lead_user:
            lead_prof = db.query(InvestigatorProfile).filter(InvestigatorProfile.user_id == lead_user.id).first()
            collaborator_items.append({
                "assignment_id": 0,
                "user_id": str(lead_user.id),
                "numeric_id": lead_user.id,
                "username": lead_user.username,
                "full_name": lead_user.full_name,
                "role": "Lead Investigator",
                "department": lead_prof.department if lead_prof and lead_prof.department else "Cyber Crime Wing",
                "specialization": lead_prof.specialization if lead_prof and lead_prof.specialization else "Senior Case Officer",
                "badge_id": lead_prof.badge_id if lead_prof and lead_prof.badge_id else f"POL-{lead_user.id:04d}",
                "status": "ACCEPTED",
                "is_lead": True,
                "joined_at": target_case.created_at.isoformat() if target_case.created_at else datetime.utcnow().isoformat(),
                "message": "Assigned Case Officer"
            })

    # 2. Database Case Assignments (Accepted & Pending)
    assignments = db.query(CaseAssignment).filter(CaseAssignment.case_id == c_id).all()
    for a in assignments:
        if a.investigator_id == target_case.assigned_investigator_id:
            continue
        inv_user = db.query(User).filter(User.id == a.investigator_id).first()
        if not inv_user:
            continue
        prof = db.query(InvestigatorProfile).filter(InvestigatorProfile.user_id == inv_user.id).first()
        sender_user = db.query(User).filter(User.id == a.assigned_by_id).first() if a.assigned_by_id else None

        collaborator_items.append({
            "assignment_id": a.id,
            "user_id": str(inv_user.id),
            "numeric_id": inv_user.id,
            "username": inv_user.username,
            "full_name": inv_user.full_name,
            "role": "Co-Investigator" if a.status == CaseAssignmentStatus.ACCEPTED else "Invited Officer",
            "department": prof.department if prof and prof.department else "Cyber Forensics",
            "specialization": prof.specialization if prof and prof.specialization else "Asset Recovery",
            "badge_id": prof.badge_id if prof and prof.badge_id else f"POL-{inv_user.id:04d}",
            "status": a.status.value,
            "is_lead": False,
            "joined_at": a.accepted_at.isoformat() if a.accepted_at else a.assigned_at.isoformat(),
            "invited_by": sender_user.full_name if sender_user else "Lead Investigator",
            "invited_by_username": sender_user.username if sender_user else None,
            "message": a.notes or "Collaboration requested",
            "can_respond": current_user.id == inv_user.id and a.status == CaseAssignmentStatus.PENDING
        })

    # 3. Include any legacy in-memory collaborators
    if c_id in _in_memory_collaborators:
        existing_ids = {c["user_id"] for c in collaborator_items}
        for mem in _in_memory_collaborators[c_id]:
            if mem["user_id"] not in existing_ids:
                collaborator_items.append(mem)

    return collaborator_items

@router.post('/cases/{case_id}/invite')
def send_collaboration_invite(
    case_id: str,
    payload: CollaborationInviteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Sends a collaboration invitation with a personalized message to another investigator.
    Creates a pending case assignment and generates an in-app notification.
    """
    target_case = db.query(Case).filter(or_(Case.case_id == case_id, Case.case_number == case_id)).first()
    if not target_case:
        raise HTTPException(status_code=404, detail="Case not found")

    target_inv = db.query(User).filter(User.id == payload.investigator_id).first()
    if not target_inv:
        raise HTTPException(status_code=404, detail="Target investigator not found")

    if target_inv.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot invite yourself to collaborate")

    c_id = target_case.case_id

    # Check if assignment already exists
    existing = db.query(CaseAssignment).filter(
        CaseAssignment.case_id == c_id,
        CaseAssignment.investigator_id == target_inv.id
    ).first()

    if existing:
        if existing.status == CaseAssignmentStatus.ACCEPTED:
            raise HTTPException(status_code=400, detail=f"{target_inv.full_name} is already an active collaborator on this case")
        elif existing.status == CaseAssignmentStatus.PENDING:
            # Re-update the invitation message
            existing.notes = payload.message
            existing.assigned_at = datetime.utcnow()
            db.commit()
            return {"status": "success", "message": "Invitation message updated", "assignment_id": existing.id}

    # Create new pending assignment
    assignment = CaseAssignment(
        case_id=c_id,
        victim_id=target_case.victim_id,
        investigator_id=target_inv.id,
        assigned_by_id=current_user.id,
        status=CaseAssignmentStatus.PENDING,
        notes=payload.message,
        assigned_at=datetime.utcnow()
    )
    db.add(assignment)

    # Create In-App Notification for the target investigator
    notif = Notification(
        user_id=target_inv.id,
        case_id=c_id,
        notification_type="COLLABORATION_INVITE",
        title=f"Collaboration Request: Case #{target_case.case_number or c_id}",
        message=f"{current_user.full_name} invited you to co-investigate: \"{payload.message}\"",
        is_read=False,
        created_at=datetime.utcnow()
    )
    db.add(notif)
    db.commit()
    db.refresh(assignment)

    # Log in activity feed
    actor_name = current_user.full_name or current_user.username
    log_activity(c_id, actor_name, f"Sent collaboration invite to {target_inv.full_name}", payload.message)

    # Post automated team note in case discussion
    if c_id not in _team_notes:
        _team_notes[c_id] = []
    _team_notes[c_id].append({
        "id": str(uuid.uuid4()),
        "case_id": c_id,
        "author": actor_name,
        "content": f"🤝 Collaboration invitation sent to @{target_inv.username}: \"{payload.message}\"",
        "mentions": [f"@{target_inv.username}"],
        "thread_id": str(uuid.uuid4()),
        "created_at": datetime.utcnow().isoformat()
    })

    return {
        "status": "success",
        "assignment_id": assignment.id,
        "case_id": c_id,
        "investigator_name": target_inv.full_name,
        "message": "Collaboration invitation sent successfully"
    }

@router.post('/cases/{case_id}/invitations/{assignment_id}/respond')
def respond_collaboration_invite(
    case_id: str,
    assignment_id: int,
    payload: CollaborationResponse,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Accepts or declines a collaboration request.
    When accepted, both investigators are authorized to co-investigate the case.
    """
    target_case = db.query(Case).filter(or_(Case.case_id == case_id, Case.case_number == case_id)).first()
    if not target_case:
        raise HTTPException(status_code=404, detail="Case not found")

    c_id = target_case.case_id
    assignment = db.query(CaseAssignment).filter(
        CaseAssignment.id == assignment_id,
        CaseAssignment.case_id == c_id
    ).first()

    if not assignment:
        raise HTTPException(status_code=404, detail="Collaboration invitation not found")

    # Authorize: Must be the invited investigator, or supervisor/admin
    if assignment.investigator_id != current_user.id and current_user.role not in [UserRole.SUPERVISOR, UserRole.ADMINISTRATOR]:
        raise HTTPException(status_code=403, detail="You can only respond to invitations sent to your profile")

    action_upper = payload.action.upper()
    inviter = db.query(User).filter(User.id == assignment.assigned_by_id).first() if assignment.assigned_by_id else None
    user_name = current_user.full_name or current_user.username

    if action_upper == "ACCEPT":
        assignment.status = CaseAssignmentStatus.ACCEPTED
        assignment.accepted_at = datetime.utcnow()

        # Notify inviter of acceptance
        if inviter:
            notif = Notification(
                user_id=inviter.id,
                case_id=c_id,
                notification_type="COLLABORATION_ACCEPTED",
                title=f"Collaboration Accepted: Case #{target_case.case_number or c_id}",
                message=f"{user_name} accepted your collaboration invitation. Both of you can now co-investigate this case!",
                is_read=False,
                created_at=datetime.utcnow()
            )
            db.add(notif)

        # Log activity
        log_activity(c_id, user_name, "Accepted collaboration invitation", "Joined as active co-investigator")

        # Post team note
        if c_id not in _team_notes:
            _team_notes[c_id] = []
        _team_notes[c_id].append({
            "id": str(uuid.uuid4()),
            "case_id": c_id,
            "author": "System",
            "content": f"🎉 @{current_user.username} ({user_name}) accepted the collaboration invite and is now an active co-investigator on this case.",
            "mentions": [f"@{current_user.username}"],
            "thread_id": str(uuid.uuid4()),
            "created_at": datetime.utcnow().isoformat()
        })

    elif action_upper == "DECLINE":
        assignment.status = CaseAssignmentStatus.REJECTED
        log_activity(c_id, user_name, "Declined collaboration invitation", "")

    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'ACCEPT' or 'DECLINE'.")

    db.commit()

    return {
        "status": "success",
        "action": action_upper,
        "assignment_id": assignment.id,
        "case_id": c_id,
        "is_active_collaborator": action_upper == "ACCEPT"
    }

@router.delete('/cases/{case_id}/collaborators/{collaborator_id}')
def remove_collaborator(
    case_id: str,
    collaborator_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Removes a collaborator or cancels an invitation."""
    target_case = db.query(Case).filter(or_(Case.case_id == case_id, Case.case_number == case_id)).first()
    if not target_case:
        raise HTTPException(status_code=404, detail="Case not found")

    c_id = target_case.case_id

    # Check database assignments by ID or user ID
    assignment = None
    if collaborator_id.isdigit():
        assignment = db.query(CaseAssignment).filter(
            or_(
                CaseAssignment.id == int(collaborator_id),
                CaseAssignment.investigator_id == int(collaborator_id)
            ),
            CaseAssignment.case_id == c_id
        ).first()

    if assignment:
        removed_user = db.query(User).filter(User.id == assignment.investigator_id).first()
        user_label = removed_user.full_name if removed_user else f"Officer #{collaborator_id}"
        db.delete(assignment)
        db.commit()
        actor_name = current_user.full_name or current_user.username
        log_activity(c_id, actor_name, f"Removed collaborator {user_label}", "")
        return {"status": "success", "message": f"Collaborator {user_label} removed"}

    # Fallback to memory
    if c_id in _in_memory_collaborators:
        initial = len(_in_memory_collaborators[c_id])
        _in_memory_collaborators[c_id] = [c for c in _in_memory_collaborators[c_id] if c["user_id"] != collaborator_id]
        if len(_in_memory_collaborators[c_id]) < initial:
            return {"status": "success"}

    raise HTTPException(status_code=404, detail="Collaborator not found")

@router.get('/my-invitations')
def get_my_collaboration_invitations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns all pending collaboration requests sent to the current investigator."""
    pending = db.query(CaseAssignment).filter(
        CaseAssignment.investigator_id == current_user.id,
        CaseAssignment.status == CaseAssignmentStatus.PENDING
    ).all()

    invitations = []
    for a in pending:
        c = db.query(Case).filter(Case.case_id == a.case_id).first()
        inviter = db.query(User).filter(User.id == a.assigned_by_id).first() if a.assigned_by_id else None
        invitations.append({
            "assignment_id": a.id,
            "case_id": a.case_id,
            "case_number": c.case_number if c else a.case_id,
            "case_title": c.title if c else "Crypto Investigation",
            "invited_by": inviter.full_name if inviter else "Case Investigator",
            "invited_by_username": inviter.username if inviter else None,
            "message": a.notes or "Collaboration requested",
            "assigned_at": a.assigned_at.isoformat() if a.assigned_at else None
        })

    return invitations

@router.get('/cases/{case_id}/team-notes')
def get_team_notes(case_id: str, current_user: User = Depends(get_current_user)):
    notes_list = _team_notes.get(case_id, [])
    return notes_list

@router.post('/cases/{case_id}/team-notes')
def add_team_note(
    case_id: str,
    note: TeamNoteCreate,
    current_user: User = Depends(get_current_user)
):
    if case_id not in _team_notes:
        _team_notes[case_id] = []

    author_name = current_user.full_name or current_user.username
    new_note = {
        "id": str(uuid.uuid4()),
        "case_id": case_id,
        "author": author_name,
        "author_username": current_user.username,
        "content": note.content,
        "mentions": note.mentions or [],
        "thread_id": note.thread_id or str(uuid.uuid4()),
        "created_at": datetime.utcnow().isoformat()
    }
    _team_notes[case_id].append(new_note)
    log_activity(case_id, author_name, "Added a team discussion note", note.content[:60] + "..." if len(note.content) > 60 else note.content)
    return new_note

@router.get('/cases/{case_id}/activity-feed')
def get_activity_feed(case_id: str, current_user: User = Depends(get_current_user)):
    return _activity_feed.get(case_id, [])

@router.post('/cases/{case_id}/activity')
def add_activity(case_id: str, activity: ActivityCreate, current_user: User = Depends(get_current_user)):
    author_name = current_user.full_name or current_user.username
    return log_activity(case_id, author_name, activity.action, activity.details or "")
