import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, case as sql_case, cast, Date, Integer
from app.database.models import (
    Case, Transaction, Alert, Evidence, RiskAssessmentRecord,
    CaseStatus, CasePriority, Monitoring, PriorityItem
)


class AnalyticsService:
    """Provides aggregated analytics and trend data for the forensic dashboard."""

    @staticmethod
    def get_overview(db: Session) -> Dict[str, Any]:
        """Returns aggregate statistics for the analytics dashboard."""
        total_cases = db.query(Case).count()
        active_cases = db.query(Case).filter(Case.status.notin_([
            CaseStatus.CLOSED, CaseStatus.RESOLVED, CaseStatus.REJECTED
        ])).count()
        closed_cases = db.query(Case).filter(Case.status.in_([
            CaseStatus.CLOSED, CaseStatus.RESOLVED
        ])).count()
        total_alerts = db.query(Alert).count()
        unread_alerts = db.query(Alert).filter(Alert.is_read == False).count()
        total_evidence = db.query(Evidence).count()
        total_transactions = db.query(Transaction).count()
        monitored_wallets = db.query(Monitoring).filter(Monitoring.is_active == True).count()

        # Average risk score
        avg_risk = db.query(func.avg(RiskAssessmentRecord.risk_score)).scalar() or 0.0

        # Cases by status
        status_counts = {}
        for status in CaseStatus:
            count = db.query(Case).filter(Case.status == status).count()
            if count > 0:
                status_counts[status.value] = count

        # Cases by blockchain
        blockchain_rows = (
            db.query(Case.blockchain, func.count(Case.case_id))
            .group_by(Case.blockchain)
            .all()
        )
        cases_by_blockchain = {row[0]: row[1] for row in blockchain_rows}

        # Cases by priority
        priority_counts = {}
        for priority in CasePriority:
            count = db.query(Case).filter(Case.priority == priority).count()
            if count > 0:
                priority_counts[priority.value] = count

        # Total funds at risk (sum of amount_lost)
        total_funds_at_risk = db.query(func.sum(Case.amount_lost)).scalar() or 0.0

        return {
            "total_cases": total_cases,
            "active_cases": active_cases,
            "closed_cases": closed_cases,
            "total_alerts": total_alerts,
            "unread_alerts": unread_alerts,
            "total_evidence": total_evidence,
            "total_transactions": total_transactions,
            "monitored_wallets": monitored_wallets,
            "avg_risk_score": round(avg_risk, 2),
            "total_funds_at_risk": round(total_funds_at_risk, 2),
            "cases_by_status": status_counts,
            "cases_by_blockchain": cases_by_blockchain,
            "cases_by_priority": priority_counts
        }

    @staticmethod
    def get_trends(db: Session, days: int = 30) -> List[Dict[str, Any]]:
        """Returns daily time-series data for the last N days."""
        end_date = datetime.datetime.utcnow()
        start_date = end_date - datetime.timedelta(days=days)

        trends = []
        current = start_date
        while current <= end_date:
            day_start = current.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + datetime.timedelta(days=1)

            new_cases = db.query(Case).filter(
                Case.created_at >= day_start,
                Case.created_at < day_end
            ).count()

            new_alerts = db.query(Alert).filter(
                Alert.timestamp >= day_start,
                Alert.timestamp < day_end
            ).count()

            new_transactions = db.query(Transaction).filter(
                Transaction.created_at >= day_start,
                Transaction.created_at < day_end
            ).count()

            trends.append({
                "date": day_start.strftime("%Y-%m-%d"),
                "new_cases": new_cases,
                "alerts": new_alerts,
                "transactions": new_transactions
            })
            current += datetime.timedelta(days=1)

        return trends

    @staticmethod
    def get_risk_distribution(db: Session) -> List[Dict[str, Any]]:
        """Returns risk score histogram buckets."""
        buckets = [
            ("0-10", 0, 10), ("10-20", 10, 20), ("20-30", 20, 30),
            ("30-40", 30, 40), ("40-50", 40, 50), ("50-60", 50, 60),
            ("60-70", 60, 70), ("70-80", 70, 80), ("80-90", 80, 90),
            ("90-100", 90, 101)
        ]

        distribution = []
        for label, low, high in buckets:
            count = db.query(RiskAssessmentRecord).filter(
                RiskAssessmentRecord.risk_score >= low,
                RiskAssessmentRecord.risk_score < high
            ).count()
            distribution.append({"range": label, "count": count})

        return distribution

    @staticmethod
    def get_heatmap_data(db: Session) -> List[Dict[str, Any]]:
        """Returns transaction activity heatmap (day_of_week x hour)."""
        heatmap = []

        # Try to extract from actual transaction timestamps
        transactions = db.query(Transaction.block_timestamp).filter(
            Transaction.block_timestamp.isnot(None)
        ).limit(5000).all()

        # Build counts grid
        grid = {}
        for row in transactions:
            ts = row[0]
            if ts:
                dow = ts.weekday()  # 0=Monday, 6=Sunday
                hour = ts.hour
                key = (dow, hour)
                grid[key] = grid.get(key, 0) + 1

        for dow in range(7):
            for hour in range(24):
                heatmap.append({
                    "day_of_week": dow,
                    "hour": hour,
                    "count": grid.get((dow, hour), 0)
                })

        return heatmap

    @staticmethod
    def get_top_risk_cases(db: Session, limit: int = 10) -> List[Dict[str, Any]]:
        """Returns top N highest-risk cases."""
        cases = (
            db.query(Case)
            .filter(Case.status.notin_([CaseStatus.CLOSED, CaseStatus.REJECTED]))
            .order_by(Case.priority.desc(), Case.created_at.desc())
            .limit(limit)
            .all()
        )

        return [
            {
                "case_id": c.case_id,
                "title": c.title or c.complaint_reference,
                "priority": c.priority.value if c.priority else "MEDIUM",
                "status": c.status.value if c.status else "NEW",
                "blockchain": c.blockchain,
                "amount_lost": c.amount_lost,
                "created_at": c.created_at.isoformat() if c.created_at else None
            }
            for c in cases
        ]
