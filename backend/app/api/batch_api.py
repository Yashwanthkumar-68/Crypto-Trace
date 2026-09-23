from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from app.api.auth import get_current_user
from app.database.database import get_db
from app.database.models import User
from app.services.batch_service import BatchService, _batch_jobs

router = APIRouter(prefix="/batch", tags=["Bulk Wallet Batch Analysis"])

@router.post("/upload")
async def upload_batch(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")
        
    content = await file.read()
    
    try:
        content_str = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Invalid file encoding. Must be UTF-8")
        
    wallets = BatchService.parse_csv(content_str)
    
    if not wallets:
        raise HTTPException(status_code=400, detail="No valid wallets found in CSV")
        
    job_info = BatchService.create_batch_job(db, current_user.id, file.filename, wallets)
    
    background_tasks.add_task(BatchService.process_batch, db, job_info["batch_id"])
    
    return job_info

@router.get("/{batch_id}/status")
async def get_batch_status(
    batch_id: str,
    db = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    status = BatchService.get_batch_status(db, batch_id)
    if not status:
        raise HTTPException(status_code=404, detail="Batch job not found")
        
    job = _batch_jobs.get(batch_id)
    if job and job["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this batch")
        
    return status

@router.get("/{batch_id}/results")
async def get_batch_results(
    batch_id: str,
    db = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    status = BatchService.get_batch_status(db, batch_id)
    if not status:
        raise HTTPException(status_code=404, detail="Batch job not found")
        
    job = _batch_jobs.get(batch_id)
    if job and job["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this batch")
        
    if status["status"] != "completed":
        raise HTTPException(status_code=400, detail="Batch job is not completed yet")
        
    return {"results": status["results"]}

@router.get("")
async def list_batch_jobs(
    db = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user_jobs = []
    for batch_id, job in _batch_jobs.items():
        if job["user_id"] == current_user.id:
            user_jobs.append({
                "batch_id": batch_id,
                "filename": job["filename"],
                "total": job["total"],
                "processed": job["processed"],
                "status": job["status"],
                "created_at": job["created_at"]
            })
            
    user_jobs.sort(key=lambda x: x["created_at"], reverse=True)
    
    return {"jobs": user_jobs}
