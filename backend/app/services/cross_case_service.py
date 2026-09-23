import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from datetime import datetime

from app.database.models import (
    Case, CaseLink, CaseLinkType, User, AuditLog
)
from app.database.schemas import (
    LinkedCaseSummary, CaseLinkItem, CaseSyndicateIntelResponse, GlobalSyndicateCluster
)
from app.services.timeline_service import TimelineService

logger = logging.getLogger("sih26183.cross_case")

class CrossCaseIntelligenceService:
    @classmethod
    def scan_and_link(cls, db: Session, case: Case) -> List[CaseLink]:
        """
        Scans all existing cases in the database to detect shared wallets.
        Links cases into a crime syndicate cluster and records forensic evidence.
        """
        if not case.suspect_wallet or not case.suspect_wallet.strip():
            return []

        clean_wallet = case.suspect_wallet.strip()
        norm_wallet = clean_wallet.lower()

        # Find existing cases with the same suspect wallet (case-insensitive)
        matching_cases = (
            db.query(Case)
            .filter(
                Case.case_id != case.case_id,
                Case.suspect_wallet.isnot(None),
                func.lower(Case.suspect_wallet) == norm_wallet
            )
            .all()
        )

        if not matching_cases:
            return []

        logger.info(f"[LinkAnalysis] Case {case.case_id} matches {len(matching_cases)} existing cases with suspect wallet {clean_wallet}")

        # Check if an existing syndicate tag already exists for this wallet
        existing_link = (
            db.query(CaseLink)
            .filter(func.lower(CaseLink.shared_wallet) == norm_wallet, CaseLink.syndicate_tag.isnot(None))
            .first()
        )
        if existing_link and existing_link.syndicate_tag:
            syndicate_tag = existing_link.syndicate_tag
        else:
            short_hash = clean_wallet[2:8].upper() if clean_wallet.startswith("0x") else clean_wallet[:6].upper()
            chain_prefix = (case.blockchain[:3] if case.blockchain else "ETH").upper()
            syndicate_tag = f"RING-{chain_prefix}-{short_hash}"

        created_links: List[CaseLink] = []

        for other_case in matching_cases:
            # Check bidirectional link existence
            fwd_exists = (
                db.query(CaseLink)
                .filter(
                    CaseLink.source_case_id == case.case_id,
                    CaseLink.target_case_id == other_case.case_id,
                    func.lower(CaseLink.shared_wallet) == norm_wallet
                )
                .first()
            )
            if not fwd_exists:
                fwd_link = CaseLink(
                    source_case_id=case.case_id,
                    target_case_id=other_case.case_id,
                    shared_wallet=clean_wallet,
                    link_type=CaseLinkType.DIRECT_SUSPECT_WALLET,
                    confidence_score=1.0,
                    syndicate_tag=syndicate_tag,
                    created_at=datetime.utcnow()
                )
                db.add(fwd_link)
                created_links.append(fwd_link)

            rev_exists = (
                db.query(CaseLink)
                .filter(
                    CaseLink.source_case_id == other_case.case_id,
                    CaseLink.target_case_id == case.case_id,
                    func.lower(CaseLink.shared_wallet) == norm_wallet
                )
                .first()
            )
            if not rev_exists:
                rev_link = CaseLink(
                    source_case_id=other_case.case_id,
                    target_case_id=case.case_id,
                    shared_wallet=clean_wallet,
                    link_type=CaseLinkType.DIRECT_SUSPECT_WALLET,
                    confidence_score=1.0,
                    syndicate_tag=syndicate_tag,
                    created_at=datetime.utcnow()
                )
                db.add(rev_link)

            # Record timeline event on newly filed case
            TimelineService.record_event(
                db=db,
                case_id=case.case_id,
                event_type="CRIME_RING_DETECTED",
                title=f"Syndicate Match: {other_case.case_number or other_case.case_id}",
                description=(
                    f"Cross-case link discovered! Shared suspect wallet {clean_wallet} "
                    f"also identified in prior case reported by {other_case.victim_name} "
                    f"(Reported Loss: ₹{other_case.amount_lost:,.2f} {other_case.currency})."
                ),
                actor="INTELLIGENCE_ENGINE",
                metadata={
                    "syndicate_tag": syndicate_tag,
                    "linked_case_id": other_case.case_id,
                    "linked_case_number": other_case.case_number,
                    "shared_wallet": clean_wallet,
                    "other_victim": other_case.victim_name
                }
            )

            # Record timeline event on the prior linked case
            TimelineService.record_event(
                db=db,
                case_id=other_case.case_id,
                event_type="CRIME_RING_DETECTED",
                title=f"New Syndicate Victim Linked: {case.case_number or case.case_id}",
                description=(
                    f"New victim {case.victim_name} filed a complaint sharing suspect wallet {clean_wallet} "
                    f"(Reported Loss: ₹{case.amount_lost:,.2f} {case.currency})."
                ),
                actor="INTELLIGENCE_ENGINE",
                metadata={
                    "syndicate_tag": syndicate_tag,
                    "linked_case_id": case.case_id,
                    "linked_case_number": case.case_number,
                    "shared_wallet": clean_wallet,
                    "new_victim": case.victim_name
                }
            )

        # Audit log
        db.add(AuditLog(
            user_id=None,
            username="INTELLIGENCE_ENGINE",
            action="CROSS_CASE_SYNDICATE_LINKED",
            case_id=case.case_id,
            metadata_json={
                "syndicate_tag": syndicate_tag,
                "shared_wallet": clean_wallet,
                "linked_cases_count": len(matching_cases),
                "linked_case_ids": [c.case_id for c in matching_cases]
            }
        ))

        try:
            db.commit()
        except Exception as e:
            logger.error(f"[LinkAnalysis] Commit error: {e}")
            db.rollback()

        return created_links

    @classmethod
    def get_case_syndicate_intel(cls, db: Session, case_id: str) -> CaseSyndicateIntelResponse:
        """
        Retrieves all linked cases, syndicate metrics, and connections for a given case.
        """
        main_case = db.query(Case).filter(Case.case_id == case_id).first()
        if not main_case:
            return CaseSyndicateIntelResponse(
                case_id=case_id,
                is_part_of_syndicate=False,
                syndicate_tag=None,
                total_linked_cases=0,
                total_victims=0,
                cumulative_loss_amount=0.0,
                currency="INR",
                shared_wallets=[],
                links=[]
            )

        # Query links where case is source
        links = db.query(CaseLink).filter(CaseLink.source_case_id == case_id).all()
        if not links:
            # Fallback: scan now in case it wasn't scanned before
            cls.scan_and_link(db, main_case)
            links = db.query(CaseLink).filter(CaseLink.source_case_id == case_id).all()

        if not links:
            return CaseSyndicateIntelResponse(
                case_id=case_id,
                is_part_of_syndicate=False,
                syndicate_tag=None,
                total_linked_cases=0,
                total_victims=1,
                cumulative_loss_amount=main_case.amount_lost,
                currency=main_case.currency,
                shared_wallets=[main_case.suspect_wallet] if main_case.suspect_wallet else [],
                links=[]
            )

        link_items: List[CaseLinkItem] = []
        linked_case_objects: List[Case] = [main_case]
        shared_wallets_set = set()
        syndicate_tag = links[0].syndicate_tag

        for l in links:
            shared_wallets_set.add(l.shared_wallet)
            if not syndicate_tag and l.syndicate_tag:
                syndicate_tag = l.syndicate_tag

            target_case = db.query(Case).filter(Case.case_id == l.target_case_id).first()
            if target_case:
                linked_case_objects.append(target_case)
                inv_name = None
                if target_case.assigned_investigator_id:
                    inv = db.query(User).filter(User.id == target_case.assigned_investigator_id).first()
                    inv_name = inv.full_name if inv else None

                summary = LinkedCaseSummary(
                    case_id=target_case.case_id,
                    case_number=target_case.case_number,
                    title=target_case.title,
                    victim_name=target_case.unregistered_victim_name or target_case.victim_name,
                    amount_lost=target_case.amount_lost,
                    currency=target_case.currency,
                    blockchain=target_case.blockchain,
                    status=target_case.status.value if hasattr(target_case.status, "value") else str(target_case.status),
                    priority=target_case.priority.value if hasattr(target_case.priority, "value") else str(target_case.priority),
                    incident_date=target_case.incident_date,
                    suspect_wallet=target_case.suspect_wallet,
                    assigned_investigator_name=inv_name
                )
                link_items.append(CaseLinkItem(
                    id=l.id,
                    source_case_id=l.source_case_id,
                    target_case_id=l.target_case_id,
                    shared_wallet=l.shared_wallet,
                    link_type=l.link_type.value if hasattr(l.link_type, "value") else str(l.link_type),
                    confidence_score=l.confidence_score or 1.0,
                    syndicate_tag=l.syndicate_tag,
                    created_at=l.created_at,
                    linked_case=summary
                ))

        # Calculate unique victims and cumulative financial loss
        unique_victims = set(
            c.unregistered_victim_name or c.victim_name for c in linked_case_objects if c.victim_name or c.unregistered_victim_name
        )
        cumulative_loss = sum(c.amount_lost for c in linked_case_objects)

        return CaseSyndicateIntelResponse(
            case_id=case_id,
            is_part_of_syndicate=True,
            syndicate_tag=syndicate_tag,
            total_linked_cases=len(link_items),
            total_victims=len(unique_victims),
            cumulative_loss_amount=cumulative_loss,
            currency=main_case.currency,
            shared_wallets=list(shared_wallets_set),
            links=link_items
        )

    @classmethod
    def get_all_syndicates(cls, db: Session) -> List[GlobalSyndicateCluster]:
        """
        Returns all detected crime syndicates across the entire platform.
        """
        all_links = db.query(CaseLink).all()
        if not all_links:
            return []

        # Group by syndicate_tag
        clusters: Dict[str, Dict[str, Any]] = {}
        for l in all_links:
            tag = l.syndicate_tag or "UNLABELED-RING"
            if tag not in clusters:
                clusters[tag] = {
                    "syndicate_tag": tag,
                    "root_wallet": l.shared_wallet,
                    "case_ids": set(),
                    "currency": "INR"
                }
            clusters[tag]["case_ids"].add(l.source_case_id)
            clusters[tag]["case_ids"].add(l.target_case_id)

        result: List[GlobalSyndicateCluster] = []
        for tag, data in clusters.items():
            case_ids = list(data["case_ids"])
            cases = db.query(Case).filter(Case.case_id.in_(case_ids)).all()
            if not cases:
                continue

            victims = set(c.unregistered_victim_name or c.victim_name for c in cases)
            total_loss = sum(c.amount_lost for c in cases)
            dates = [c.incident_date for c in cases if c.incident_date]
            earliest = min(dates) if dates else None
            latest = max(dates) if dates else None

            summaries = []
            for c in cases:
                inv_name = None
                if c.assigned_investigator_id:
                    inv = db.query(User).filter(User.id == c.assigned_investigator_id).first()
                    inv_name = inv.full_name if inv else None
                summaries.append(LinkedCaseSummary(
                    case_id=c.case_id,
                    case_number=c.case_number,
                    title=c.title,
                    victim_name=c.unregistered_victim_name or c.victim_name,
                    amount_lost=c.amount_lost,
                    currency=c.currency,
                    blockchain=c.blockchain,
                    status=c.status.value if hasattr(c.status, "value") else str(c.status),
                    priority=c.priority.value if hasattr(c.priority, "value") else str(c.priority),
                    incident_date=c.incident_date,
                    suspect_wallet=c.suspect_wallet,
                    assigned_investigator_name=inv_name
                ))

            result.append(GlobalSyndicateCluster(
                syndicate_tag=tag,
                root_wallet=data["root_wallet"],
                case_count=len(cases),
                victim_count=len(victims),
                cumulative_loss=total_loss,
                currency=cases[0].currency if cases else "INR",
                earliest_incident=earliest,
                latest_incident=latest,
                case_ids=case_ids,
                linked_cases=summaries
            ))

        return sorted(result, key=lambda x: x.cumulative_loss, reverse=True)
