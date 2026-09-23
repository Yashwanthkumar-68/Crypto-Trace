from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.api.auth import get_current_user
from app.services.scheduler_service import SchedulerService

router = APIRouter(prefix='/scheduler', tags=['Automated Scheduled Monitoring'])

class CreateJobRequest(BaseModel):
    wallet_address: str
    case_id: str
    blockchain: str
    interval_hours: int

@router.post('/jobs')
def create_job(request: CreateJobRequest, current_user: dict = Depends(get_current_user)):
    # Fallback to user ID 1 if not present in mock dict
    user_id = current_user.get("id", 1) if isinstance(current_user, dict) else getattr(current_user, "id", 1)
    job = SchedulerService.create_job(
        wallet_address=request.wallet_address,
        case_id=request.case_id,
        blockchain=request.blockchain,
        interval_hours=request.interval_hours,
        created_by=user_id
    )
    return job

@router.get('/jobs')
def list_jobs(current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("id", 1) if isinstance(current_user, dict) else getattr(current_user, "id", 1)
    return SchedulerService.list_jobs(user_id=user_id)

@router.get('/jobs/{job_id}')
def get_job(job_id: str, current_user: dict = Depends(get_current_user)):
    job = SchedulerService.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.delete('/jobs/{job_id}')
def delete_job(job_id: str, current_user: dict = Depends(get_current_user)):
    success = SchedulerService.delete_job(job_id)
    if not success:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"status": "success"}

@router.post('/jobs/{job_id}/pause')
def pause_job(job_id: str, current_user: dict = Depends(get_current_user)):
    job = SchedulerService.pause_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.post('/jobs/{job_id}/resume')
def resume_job(job_id: str, current_user: dict = Depends(get_current_user)):
    job = SchedulerService.resume_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.post('/jobs/{job_id}/execute')
def execute_job(job_id: str, current_user: dict = Depends(get_current_user)):
    result = SchedulerService.execute_job(job_id)
    if not result:
        raise HTTPException(status_code=404, detail="Job not found")
    return result

@router.get('/jobs/{job_id}/history')
def get_job_history(job_id: str, current_user: dict = Depends(get_current_user)):
    history = SchedulerService.get_job_history(job_id)
    if history is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return history
