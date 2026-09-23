import csv
import io
import uuid
import hashlib
from datetime import datetime

_batch_jobs = {}

class BatchService:
    @staticmethod
    def parse_csv(file_content: str) -> list[dict]:
        wallets = []
        reader = csv.DictReader(io.StringIO(file_content))
        
        if reader.fieldnames:
            reader.fieldnames = [name.strip().lower() for name in reader.fieldnames]
            
        for row in reader:
            address = row.get("wallet_address", "").strip()
            blockchain = row.get("blockchain", "ETH").strip()
            label = row.get("label", "").strip()
            
            if address and len(address) == 42 and address.startswith("0x"):
                wallets.append({
                    "wallet_address": address,
                    "blockchain": blockchain,
                    "label": label
                })
                
            if len(wallets) >= 100:
                break
                
        return wallets

    @staticmethod
    def create_batch_job(db, user_id, filename, wallets) -> dict:
        batch_id = str(uuid.uuid4())
        
        job = {
            "id": batch_id,
            "user_id": user_id,
            "filename": filename,
            "total": len(wallets),
            "processed": 0,
            "status": "pending",
            "wallets": wallets,
            "results": [],
            "created_at": datetime.utcnow().isoformat()
        }
        
        _batch_jobs[batch_id] = job
        
        return {
            "batch_id": batch_id,
            "total_wallets": job["total"],
            "status": job["status"]
        }

    @staticmethod
    def process_batch(db, batch_id) -> dict:
        job = _batch_jobs.get(batch_id)
        if not job:
            return None
            
        job["status"] = "processing"
        
        results = []
        known_vasps = ["Binance", "Coinbase", "Kraken", "Huobi", "KuCoin"]
        
        for wallet in job["wallets"]:
            address = wallet["wallet_address"]
            
            # Deterministic risk score using hashlib
            hash_val = int(hashlib.sha256(address.encode('utf-8')).hexdigest(), 16)
            risk_score = hash_val % 100
            
            # Risk level
            if risk_score >= 75:
                risk_level = "High"
            elif risk_score >= 40:
                risk_level = "Medium"
            else:
                risk_level = "Low"
                
            label = wallet["label"]
            is_vasp = any(vasp.lower() in label.lower() for vasp in known_vasps) if label else False
            
            results.append({
                "wallet_address": address,
                "blockchain": wallet["blockchain"],
                "input_label": label,
                "risk_score": risk_score,
                "risk_level": risk_level,
                "is_vasp": is_vasp,
                "processed_at": datetime.utcnow().isoformat()
            })
            
            job["processed"] += 1
            
        job["results"] = results
        job["status"] = "completed"
        
        return {
            "batch_id": batch_id,
            "total": job["total"],
            "processed": job["processed"],
            "status": job["status"]
        }

    @staticmethod
    def get_batch_status(db, batch_id) -> dict:
        job = _batch_jobs.get(batch_id)
        if not job:
            return None
            
        return {
            "batch_id": batch_id,
            "status": job["status"],
            "total": job["total"],
            "processed": job["processed"],
            "results": job["results"] if job["status"] == "completed" else []
        }
