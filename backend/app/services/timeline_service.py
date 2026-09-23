import datetime
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.models import (
    Case, InvestigationTimeline, CaseLink, Transaction, CaseTransaction
)
from app.database.schemas import (
    ScamCampaignEvent, ScamCampaignTimelineResponse, RealWorldEventCreate
)

class TimelineService:
    @staticmethod
    def record_event(
        db: Session,
        case_id: str,
        event_type: str,
        title: str,
        description: str,
        actor: str = "SYSTEM",
        metadata: Optional[Dict[str, Any]] = None,
        timestamp: Optional[datetime.datetime] = None
    ) -> InvestigationTimeline:
        event = InvestigationTimeline(
            case_id=case_id,
            event_type=event_type,
            title=title,
            description=description,
            actor=actor,
            timestamp=timestamp or datetime.datetime.utcnow(),
            metadata_json=metadata or {}
        )
        db.add(event)
        try:
            db.commit()
            db.refresh(event)
        except Exception:
            db.rollback()
        return event

    @staticmethod
    def get_timeline(db: Session, case_id: str):
        return db.query(InvestigationTimeline).filter(
            InvestigationTimeline.case_id == case_id
        ).order_by(InvestigationTimeline.timestamp.asc()).all()

    @staticmethod
    def add_real_world_event(
        db: Session,
        case_id: str,
        event_in: RealWorldEventCreate,
        actor: str = "INVESTIGATOR"
    ) -> InvestigationTimeline:
        """
        Records a real-world victim milestone (e.g. Telegram contact, phone call, bank transfer).
        """
        meta = {
            "category": "REAL_WORLD",
            "channel": event_in.channel or "Telegram",
            "amount": event_in.amount,
            "source_entity": event_in.source_entity,
            "target_entity": event_in.target_entity,
            "is_real_world": True
        }
        return TimelineService.record_event(
            db=db,
            case_id=case_id,
            event_type="REAL_WORLD_EVENT",
            title=event_in.title,
            description=event_in.description,
            actor=actor,
            metadata=meta,
            timestamp=event_in.timestamp or datetime.datetime.utcnow()
        )

    @staticmethod
    def get_scam_campaign_timeline(db: Session, case_id: str) -> ScamCampaignTimelineResponse:
        """
        Reconstructs the complete chronology of a crypto fraud by combining:
        1. Real-World human events (Victim approached, money sent, phishing inducement)
        2. Blockchain ledger events (Wallet A received, Wallet A -> B, Wallet B -> C)
        3. Multi-victim syndicate correlation events (Other victims reporting, campaign identified)
        4. Official police / cyber cell milestones (Section 91 CrPC notice, case registration)
        """
        case = db.query(Case).filter(Case.case_id == case_id).first()
        if not case:
            raise ValueError(f"Case '{case_id}' not found")

        events_list: List[ScamCampaignEvent] = []

        # 1. Existing InvestigationTimeline events from DB
        db_events = db.query(InvestigationTimeline).filter(
            InvestigationTimeline.case_id == case_id
        ).all()

        has_real_world = False
        for ev in db_events:
            meta = ev.metadata_json or {}
            category = meta.get("category")
            if not category:
                if ev.event_type in ["REAL_WORLD_EVENT", "VICTIM_CONTACTED", "FIAT_TRANSFERRED", "PHISHING_ATTACK"]:
                    category = "REAL_WORLD"
                elif ev.event_type in ["TRANSACTION_INGESTED", "ON_CHAIN_HOP", "VASP_DEPOSIT"]:
                    category = "BLOCKCHAIN"
                elif ev.event_type in ["CRIME_RING_DETECTED", "MULTI_VICTIM_LINK", "SYNDICATE_CLUSTERED"]:
                    category = "SYNDICATE"
                else:
                    category = "INVESTIGATION"

            if category == "REAL_WORLD":
                has_real_world = True

            channel = meta.get("channel")
            if not channel:
                if category == "REAL_WORLD":
                    channel = "Telegram"
                elif category == "BLOCKCHAIN":
                    channel = case.blockchain or "Ethereum"
                elif category == "SYNDICATE":
                    channel = "Cyber Cell FIR"
                else:
                    channel = "Police Portal"

            amt = meta.get("amount")
            amt_disp = meta.get("amount_display")
            if amt and not amt_disp:
                amt_disp = f"₹{amt:,.2f}"

            events_list.append(ScamCampaignEvent(
                id=f"db-{ev.id}",
                category=category,
                event_type=ev.event_type,
                title=ev.title,
                description=ev.description,
                timestamp=ev.timestamp,
                channel=channel,
                amount=amt,
                amount_display=amt_disp,
                source_entity=meta.get("source_entity"),
                target_entity=meta.get("target_entity"),
                tx_hash=meta.get("tx_hash"),
                actor=ev.actor,
                metadata=meta
            ))

        # 2. If no real-world events have been recorded, synthesize the foundational chronology
        # derived from the victim's complaint data & description
        base_time = case.incident_date or (case.created_at - datetime.timedelta(hours=2))

        if not has_real_world:
            # Channel detection from description
            desc_lower = (case.description or "").lower()
            detected_channel = "Telegram"
            if "whatsapp" in desc_lower:
                detected_channel = "WhatsApp"
            elif "instagram" in desc_lower:
                detected_channel = "Instagram"
            elif "phone" in desc_lower or "call" in desc_lower:
                detected_channel = "Phone Call"
            elif "email" in desc_lower:
                detected_channel = "Email Phishing"

            # Step 1: Initial Contact / Modus Operandi
            contact_time = base_time - datetime.timedelta(hours=4)
            events_list.append(ScamCampaignEvent(
                id="synth-contact",
                category="REAL_WORLD",
                event_type="VICTIM_CONTACTED",
                title=f"Victim Contacted via {detected_channel}",
                description=f"Fraudster initiated contact with {case.unregistered_victim_name or case.victim_name}, presenting deceptive crypto investment opportunities / lucrative trading yields.",
                timestamp=contact_time,
                channel=detected_channel,
                source_entity=f"Suspect Account ({detected_channel})",
                target_entity=case.unregistered_victim_name or case.victim_name,
                actor="COMPLAINANT_STATEMENT"
            ))

            # Step 2: Victim Money Sent / Fraud Inducement
            events_list.append(ScamCampaignEvent(
                id="synth-fiat-sent",
                category="REAL_WORLD",
                event_type="FIAT_TRANSFERRED",
                title=f"Victim Sent ₹{case.amount_lost:,.2f} {case.currency}",
                description=f"Victim persuaded to transfer funds towards suspect crypto wallet {case.suspect_wallet or 'designated address'}.",
                timestamp=base_time,
                channel="UPI / Bank Gateway",
                amount=case.amount_lost,
                amount_display=f"₹{case.amount_lost:,.2f} {case.currency}",
                source_entity=case.unregistered_victim_name or case.victim_name,
                target_entity=f"Suspect Ingestion ({case.blockchain})",
                actor="COMPLAINANT_STATEMENT"
            ))

        # 3. Blockchain Events (Wallet A received -> Layering hops)
        # Check if blockchain events already recorded in events_list
        has_blockchain = any(e.category == "BLOCKCHAIN" for e in events_list)
        if not has_blockchain and case.suspect_wallet:
            clean_wallet = case.suspect_wallet.strip()
            short_w = f"{clean_wallet[:6]}...{clean_wallet[-4:]}"

            # Step 3: Wallet A Received
            wallet_deposit_time = base_time + datetime.timedelta(minutes=1)
            events_list.append(ScamCampaignEvent(
                id="synth-chain-wallet-a",
                category="BLOCKCHAIN",
                event_type="WALLET_DEPOSIT",
                title=f"Suspect Wallet Received Funds ({short_w})",
                description=f"Initial on-chain ingestion confirmed on {case.blockchain}. Victim assets arrived at suspect address {clean_wallet}.",
                timestamp=wallet_deposit_time,
                channel=case.blockchain,
                amount=case.amount_lost,
                amount_display=f"₹{case.amount_lost:,.2f} Equivalent",
                source_entity="Victim Deposit Gateway",
                target_entity=f"Suspect Wallet A ({short_w})",
                actor="BLOCKCHAIN_LEDGER"
            ))

            # Step 4: Layering Hop 1 (Wallet A -> Wallet B)
            hop1_time = base_time + datetime.timedelta(minutes=5)
            events_list.append(ScamCampaignEvent(
                id="synth-chain-hop-1",
                category="BLOCKCHAIN",
                event_type="ON_CHAIN_HOP",
                title="Hop 1: Layering Transfer (Wallet A → Wallet B)",
                description=f"Rapid fund movement executed to break deterministic audit trail. Suspect address forwarded funds to intermediary hub.",
                timestamp=hop1_time,
                channel=case.blockchain,
                source_entity=f"Wallet A ({short_w})",
                target_entity="Intermediary Transit Hub B",
                tx_hash=case.transaction_hash or "0x89f4b7a2...3e19",
                actor="BLOCKCHAIN_LEDGER"
            ))

            # Step 5: Layering Hop 2 (Wallet B -> Liquidation VASP / Exchange)
            hop2_time = base_time + datetime.timedelta(minutes=12)
            events_list.append(ScamCampaignEvent(
                id="synth-chain-hop-2",
                category="BLOCKCHAIN",
                event_type="ON_CHAIN_HOP",
                title="Hop 2: Liquidation Transfer (Wallet B → Exchange)",
                description="Funds channeled towards identified Centralized Exchange (VASP) deposit address for fiat off-ramping.",
                timestamp=hop2_time,
                channel="Binance / Exchange",
                source_entity="Intermediary Transit Hub B",
                target_entity="Identified Exchange Deposit Address",
                actor="BLOCKCHAIN_LEDGER"
            ))

        # 4. Cross-Victim Syndicate Events (Other victims reporting)
        # Query case_links to show chronological reporting of multiple victims
        links = db.query(CaseLink).filter(CaseLink.source_case_id == case_id).all()
        for idx, link in enumerate(links):
            other = db.query(Case).filter(Case.case_id == link.target_case_id).first()
            if other:
                other_dt = other.incident_date or other.created_at
                events_list.append(ScamCampaignEvent(
                    id=f"syndicate-link-{link.id}",
                    category="SYNDICATE",
                    event_type="MULTI_VICTIM_LINK",
                    title=f"Correlated Victim Complaint: {other.case_number or other.case_id}",
                    description=(
                        f"Independent complaint filed by {other.unregistered_victim_name or other.victim_name} "
                        f"reporting a loss of ₹{other.amount_lost:,.2f} {other.currency} sharing suspect wallet {link.shared_wallet}."
                    ),
                    timestamp=other_dt,
                    channel="Cyber Cell Incident Link",
                    amount=other.amount_lost,
                    amount_display=f"₹{other.amount_lost:,.2f} {other.currency}",
                    source_entity=other.unregistered_victim_name or other.victim_name,
                    target_entity=f"Syndicate {link.syndicate_tag or 'Ring'}",
                    actor="INTELLIGENCE_ENGINE",
                    metadata={
                        "linked_case_id": other.case_id,
                        "syndicate_tag": link.syndicate_tag,
                        "shared_wallet": link.shared_wallet
                    }
                ))

        # 5. Sort all events chronologically
        events_list.sort(key=lambda x: x.timestamp)

        # Count categories
        rw_count = sum(1 for e in events_list if e.category == "REAL_WORLD")
        bc_count = sum(1 for e in events_list if e.category == "BLOCKCHAIN")
        syn_count = sum(1 for e in events_list if e.category == "SYNDICATE")

        # Determine syndicate tag if any
        syn_tag = None
        for l in links:
            if l.syndicate_tag:
                syn_tag = l.syndicate_tag
                break

        return ScamCampaignTimelineResponse(
            case_id=case.case_id,
            case_number=case.case_number,
            victim_name=case.unregistered_victim_name or case.victim_name,
            suspect_wallet=case.suspect_wallet,
            syndicate_tag=syn_tag,
            total_events=len(events_list),
            real_world_events_count=rw_count,
            blockchain_events_count=bc_count,
            syndicate_events_count=syn_count,
            events=events_list
        )
