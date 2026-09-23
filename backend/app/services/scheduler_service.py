import uuid
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

class SchedulerService:
    _scheduled_jobs: Dict[str, Any] = {}

    @staticmethod
    def create_job(wallet_address: str, case_id: str, blockchain: str, interval_hours: int, created_by: int) -> dict:
        job_id = str(uuid.uuid4())
        now = datetime.utcnow()
        job = {
            "id": job_id,
            "wallet_address": wallet_address,
            "case_id": case_id,
            "blockchain": blockchain,
            "interval_hours": interval_hours,
            "last_run": None,
            "next_run": now + timedelta(hours=interval_hours),
            "status": "active",
            "created_by": created_by,
            "results_history": []
        }
        SchedulerService._scheduled_jobs[job_id] = job
        return SchedulerService._get_safe_job(job)

    @staticmethod
    def list_jobs(user_id: Optional[int] = None) -> list:
        jobs = list(SchedulerService._scheduled_jobs.values())
        if user_id is not None:
            jobs = [j for j in jobs if j["created_by"] == user_id]
        return [SchedulerService._get_safe_job(j) for j in jobs]

    @staticmethod
    def get_job(job_id: str) -> Optional[dict]:
        job = SchedulerService._scheduled_jobs.get(job_id)
        if job:
            return SchedulerService._get_safe_job(job)
        return None

    @staticmethod
    def delete_job(job_id: str) -> bool:
        if job_id in SchedulerService._scheduled_jobs:
            del SchedulerService._scheduled_jobs[job_id]
            return True
        return False

    @staticmethod
    def pause_job(job_id: str) -> Optional[dict]:
        job = SchedulerService._scheduled_jobs.get(job_id)
        if job:
            job["status"] = "paused"
            return SchedulerService._get_safe_job(job)
        return None

    @staticmethod
    def resume_job(job_id: str) -> Optional[dict]:
        job = SchedulerService._scheduled_jobs.get(job_id)
        if job:
            job["status"] = "active"
            job["next_run"] = datetime.utcnow() + timedelta(hours=job["interval_hours"])
            return SchedulerService._get_safe_job(job)
        return None

    @staticmethod
    def execute_job(job_id: str) -> Optional[dict]:
        job = SchedulerService._scheduled_jobs.get(job_id)
        if not job:
            return None
        
        now = datetime.utcnow()
        
        # Simulate re-trace with mock results
        result = {
            "run_at": now.isoformat(),
            "new_transactions": 3,
            "balance_change": 0.5,
            "risk_score_change": 10,
            "alert_generated": True,
            "summary": f"Detected 3 new transactions on {job['blockchain']}."
        }
        
        job["last_run"] = now
        job["next_run"] = now + timedelta(hours=job["interval_hours"])
        job["results_history"].append(result)
        
        return result

    @staticmethod
    def get_job_history(job_id: str) -> Optional[list]:
        job = SchedulerService._scheduled_jobs.get(job_id)
        if job:
            return job["results_history"]
        return None
        
    @staticmethod
    def _get_safe_job(job: dict) -> dict:
        safe_job = job.copy()
        safe_job.pop("results_history", None)
        if isinstance(safe_job.get("last_run"), datetime):
            safe_job["last_run"] = safe_job["last_run"].isoformat()
        if isinstance(safe_job.get("next_run"), datetime):
            safe_job["next_run"] = safe_job["next_run"].isoformat()
        return safe_job
