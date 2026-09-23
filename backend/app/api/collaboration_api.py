from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid

# Mock current user for typing since we don't know the exact auth implementation
try:
    from app.api.auth import get_current_user
except ImportError:
    def get_current_user():
        return {"user_id": "system", "username": "system"}

router = APIRouter(prefix='/collaboration', tags=['Collaborative Investigation'])

# In-memory storage
_collaborators: Dict[str, List[Dict[str, Any]]] = {}  # case_id -> [{user_id, username, full_name, role, permissions, joined_at}]
_team_notes: Dict[str, List[Dict[str, Any]]] = {}     # case_id -> [{id, case_id, author, content, mentions, thread_id, created_at}]
_activity_feed: Dict[str, List[Dict[str, Any]]] = {}  # case_id -> [{id, case_id, actor, action, details, timestamp}]

class CollaboratorCreate(BaseModel):
    user_id: str
    username: str
    full_name: str
    role: Optional[str] = "investigator"
    permissions: Optional[List[str]] = []

class TeamNoteCreate(BaseModel):
    content: str
    mentions: Optional[List[str]] = []
    thread_id: Optional[str] = None

class ActivityCreate(BaseModel):
    action: str
    details: str

def log_activity(case_id: str, actor: str, action: str, details: str):
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
    _activity_feed[case_id].append(act)
    return act

@router.post('/cases/{case_id}/collaborators')
def add_collaborator(case_id: str, collab: CollaboratorCreate, current_user: dict = Depends(get_current_user)):
    if case_id not in _collaborators:
        _collaborators[case_id] = []
    
    for c in _collaborators[case_id]:
        if c['user_id'] == collab.user_id:
            raise HTTPException(status_code=400, detail="Collaborator already exists")
    
    new_collab = collab.model_dump()
    new_collab['joined_at'] = datetime.utcnow().isoformat()
    _collaborators[case_id].append(new_collab)
    
    username = getattr(current_user, "username", None) or (current_user.get("username") if isinstance(current_user, dict) else "System")
    log_activity(case_id, username, f"Added collaborator {collab.username}", "")
    
    return new_collab

@router.get('/cases/{case_id}/collaborators')
def list_collaborators(case_id: str, current_user = Depends(get_current_user)):
    return _collaborators.get(case_id, [])

@router.delete('/cases/{case_id}/collaborators/{user_id}')
def remove_collaborator(case_id: str, user_id: str, current_user = Depends(get_current_user)):
    if case_id not in _collaborators:
        raise HTTPException(status_code=404, detail="Case not found")
    
    initial_len = len(_collaborators[case_id])
    _collaborators[case_id] = [c for c in _collaborators[case_id] if c['user_id'] != user_id]
    
    if len(_collaborators[case_id]) < initial_len:
        username = getattr(current_user, "username", None) or (current_user.get("username") if isinstance(current_user, dict) else "System")
        log_activity(case_id, username, f"Removed collaborator {user_id}", "")
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Collaborator not found")

@router.post('/cases/{case_id}/team-notes')
def add_team_note(case_id: str, note: TeamNoteCreate, current_user = Depends(get_current_user)):
    if case_id not in _team_notes:
        _team_notes[case_id] = []
        
    username = getattr(current_user, "username", None) or (current_user.get("username") if isinstance(current_user, dict) else "Unknown")
    new_note = {
        "id": str(uuid.uuid4()),
        "case_id": case_id,
        "author": username,
        "content": note.content,
        "mentions": note.mentions,
        "thread_id": note.thread_id or str(uuid.uuid4()),
        "created_at": datetime.utcnow().isoformat()
    }
    _team_notes[case_id].append(new_note)
    return new_note

@router.get('/cases/{case_id}/team-notes')
def get_team_notes(case_id: str, current_user = Depends(get_current_user)):
    return _team_notes.get(case_id, [])

@router.post('/cases/{case_id}/activity')
def add_activity(case_id: str, activity: ActivityCreate, current_user = Depends(get_current_user)):
    username = getattr(current_user, "username", None) or (current_user.get("username") if isinstance(current_user, dict) else "System")
    return log_activity(case_id, username, activity.action, activity.details)

@router.get('/cases/{case_id}/activity-feed')
def get_activity_feed(case_id: str, current_user: dict = Depends(get_current_user)):
    return _activity_feed.get(case_id, [])
