"""
Structured Forensic Narrative Generator for Law Enforcement and Legal Filings.

Generates:
- Executive summary of fund flow
- Court-ready forensic narrative paragraph
- Section 91 CrPC notice auto-populated with wallet + amounts
- VASP subpoena draft
- MLAT request template
"""

import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.database.models import Case, Transaction, AddressLabel
from app.copilot.llm_client import OllamaClient
from app.copilot.rag_pipeline import RAGPipeline
from app.copilot import prompt_templates as prompts

logger = logging.getLogger(__name__)

class NarrativeGenerator:
    """
    Forensic narrative and legal document generator powered by Llama 3.1 8B / Mistral 7B & ChromaDB RAG.
    """

    def __init__(
        self,
        llm_client: Optional[OllamaClient] = None,
        rag_pipeline: Optional[RAGPipeline] = None
    ):
        self.llm_client = llm_client or OllamaClient()
        self.rag_pipeline = rag_pipeline or RAGPipeline(llm_client=self.llm_client)

    def _get_case_data(self, db: Session, case_id: str) -> Dict[str, Any]:
        """
        Retrieve case parameters and relevant transactions from DB.
        """
        case = db.query(Case).filter(Case.case_id == case_id).first()
        if not case:
            return {
                "case_id": case_id,
                "suspect_wallet": "Unknown",
                "victim_name": "Unspecified Victim",
                "amount_lost": 0.0,
                "currency": "ETH",
                "blockchain": "Ethereum",
                "complaint_reference": "N/A",
                "transactions": []
            }

        txs = db.query(Transaction).filter(
            (Transaction.case_id == case.case_id) |
            (Transaction.from_address.ilike(case.suspect_wallet or "")) |
            (Transaction.to_address.ilike(case.suspect_wallet or ""))
        ).all()

        return {
            "case_id": case.case_id,
            "suspect_wallet": case.suspect_wallet or "0x0000000000000000000000000000000000000000",
            "victim_name": case.victim_name or "Victim",
            "amount_lost": case.amount_lost or 0.0,
            "currency": case.currency or "ETH",
            "blockchain": case.blockchain or "Ethereum",
            "complaint_reference": case.complaint_reference or "N/A",
            "transactions": txs
        }

    def generate_executive_summary(self, case_id: str, db: Session) -> Dict[str, Any]:
        """
        Generate an Executive Summary of Fund Flow for the case.
        """
        self.rag_pipeline.index_case_graph(case_id, db)
        context = self.rag_pipeline.get_grounded_context_str(
            query="executive summary fund flow movement hops loss destination exchange",
            case_id=case_id,
            top_k=10
        )
        case_data = self._get_case_data(db, case_id)

        prompt = prompts.EXECUTIVE_SUMMARY_PROMPT.format(
            case_id=case_data["case_id"],
            suspect_wallet=case_data["suspect_wallet"],
            victim_name=case_data["victim_name"],
            amount_lost=case_data["amount_lost"],
            currency=case_data["currency"],
            blockchain=case_data["blockchain"],
            complaint_reference=case_data["complaint_reference"],
            context=context
        )

        res = self.llm_client.generate(prompt=prompt, system_prompt=prompts.FORENSIC_SYSTEM_PROMPT)
        output_text = res.get("response", "")

        # Fallback formatting if LLM response is offline/fallback
        if not res.get("success") or "[LOCAL LLM OFFLINE" in output_text:
            output_text = (
                f"### Executive Summary of Fund Flow — Case `{case_data['case_id']}`\n\n"
                f"**1. Background & Incident Overview**\n"
                f"- **Victim**: {case_data['victim_name']}\n"
                f"- **Total Loss**: {case_data['amount_lost']} {case_data['currency']} ({case_data['blockchain']})\n"
                f"- **Suspect Wallet**: `{case_data['suspect_wallet']}`\n"
                f"- **Complaint Ref**: {case_data['complaint_reference']}\n\n"
                f"**2. Grounded Evidence Analysis**\n"
                f"{context}\n\n"
                f"**3. Recommended Next Actions**\n"
                f"- Issue emergency freeze notice / subpoena to terminal deposit entities."
            )

        return {
            "document_type": "EXECUTIVE_SUMMARY",
            "case_id": case_id,
            "content": output_text,
            "model_used": res.get("model", self.llm_client.llm_model),
            "retrieved_context": context
        }

    def generate_court_narrative(self, case_id: str, db: Session) -> Dict[str, Any]:
        """
        Generate a Court-Ready Forensic Narrative Paragraph for formal legal filings.
        """
        self.rag_pipeline.index_case_graph(case_id, db)
        context = self.rag_pipeline.get_grounded_context_str(
            query="court narrative forensic evidence transaction flow hops addresses deposit exchange",
            case_id=case_id,
            top_k=10
        )
        case_data = self._get_case_data(db, case_id)

        prompt = prompts.COURT_NARRATIVE_PROMPT.format(
            case_id=case_data["case_id"],
            complaint_reference=case_data["complaint_reference"],
            suspect_wallet=case_data["suspect_wallet"],
            amount_lost=case_data["amount_lost"],
            currency=case_data["currency"],
            context=context
        )

        res = self.llm_client.generate(prompt=prompt, system_prompt=prompts.FORENSIC_SYSTEM_PROMPT)
        output_text = res.get("response", "")

        if not res.get("success") or "[LOCAL LLM OFFLINE" in output_text:
            output_text = (
                f"That during the course of forensic blockchain investigation in Case Ref `{case_data['case_id']}` "
                f"({case_data['complaint_reference']}), the investigating team analyzed illicit fund movements originating from suspect wallet "
                f"`{case_data['suspect_wallet']}` involving a reported displacement of {case_data['amount_lost']} {case_data['currency']}. "
                f"On-chain forensic tracing across indexed graph nodes established downstream transfers traversing intermediate peeling addresses "
                f"toward centralized Virtual Asset Service Provider (VASP) deposit infrastructure as evidenced by verified transaction ledgers."
            )

        return {
            "document_type": "COURT_NARRATIVE",
            "case_id": case_id,
            "content": output_text,
            "model_used": res.get("model", self.llm_client.llm_model)
        }

    def generate_section_91_notice(
        self,
        case_id: str,
        db: Session,
        target_entity: str = "Centralized Crypto Exchange (VASP)",
        investigator_name: str = "Investigating Officer, Cyber Crime Unit"
    ) -> Dict[str, Any]:
        """
        Generate an auto-populated Section 91 CrPC Notice requesting KYC, IP logs, and asset hold.
        """
        self.rag_pipeline.index_case_graph(case_id, db)
        case_data = self._get_case_data(db, case_id)
        context = self.rag_pipeline.get_grounded_context_str(
            query="transaction hash wallet deposit amount exchange VASP",
            case_id=case_id,
            top_k=10
        )

        tx_hashes = [getattr(t, "transaction_hash", getattr(t, "tx_hash", "")) for t in case_data["transactions"][:5]]
        tx_hash_str = ", ".join(tx_hashes) if tx_hashes else "[NOTIFIED IN CASE LEDGER]"

        prompt = prompts.SECTION_91_CRPC_PROMPT.format(
            case_id=case_data["case_id"],
            complaint_reference=case_data["complaint_reference"],
            target_entity=target_entity,
            wallet_address=case_data["suspect_wallet"],
            amount=case_data["amount_lost"],
            currency=case_data["currency"],
            tx_hashes=tx_hash_str,
            investigator_name=investigator_name,
            context=context
        )

        res = self.llm_client.generate(prompt=prompt, system_prompt=prompts.FORENSIC_SYSTEM_PROMPT)
        output_text = res.get("response", "")

        if not res.get("success") or "[LOCAL LLM OFFLINE" in output_text:
            output_text = (
                f"FORMAL NOTICE UNDER SECTION 91 CrPC, 1973 / BNSS 2023\n\n"
                f"To: Nodal Officer / Legal Compliance, {target_entity}\n"
                f"Re: Police Case / FIR Ref: {case_data['case_id']} ({case_data['complaint_reference']})\n"
                f"Investigating Officer: {investigator_name}\n\n"
                f"WHEREAS an investigation into cryptocurrency fraud involving loss of {case_data['amount_lost']} {case_data['currency']} is being conducted;\n"
                f"You are hereby directed to produce the following records/documents within 48 hours:\n"
                f"1. Complete KYC documentation (Government ID, selfie, photo ID, phone number, email ID) for target wallet `{case_data['suspect_wallet']}`.\n"
                f"2. IP login logs, MAC address, device IDs, and location logs associated with the account.\n"
                f"3. Direct bank account / fiat withdrawal details linked to this account.\n"
                f"4. Immediate temporary hold on all active balances in target account pending court order.\n\n"
                f"Transaction Hashes: {tx_hash_str}"
            )

        return {
            "document_type": "SECTION_91_CRPC_NOTICE",
            "case_id": case_id,
            "target_entity": target_entity,
            "wallet_address": case_data["suspect_wallet"],
            "amount": case_data["amount_lost"],
            "currency": case_data["currency"],
            "content": output_text
        }

    def generate_vasp_subpoena(
        self,
        case_id: str,
        db: Session,
        vasp_name: str = "Binance / WazirX / CoinDCX",
        wallet_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate a formal VASP Subpoena Draft.
        """
        self.rag_pipeline.index_case_graph(case_id, db)
        case_data = self._get_case_data(db, case_id)
        target_wallet = wallet_address or case_data["suspect_wallet"]
        context = self.rag_pipeline.get_grounded_context_str(query=f"vasp deposit address {target_wallet}", case_id=case_id, top_k=10)

        tx_hashes = ", ".join([getattr(t, "transaction_hash", getattr(t, "tx_hash", "")) for t in case_data["transactions"][:5]]) or "[CASE TX LEDGER]"

        prompt = prompts.VASP_SUBPOENA_PROMPT.format(
            case_id=case_data["case_id"],
            vasp_name=vasp_name,
            wallet_address=target_wallet,
            amount=case_data["amount_lost"],
            currency=case_data["currency"],
            tx_hashes=tx_hashes,
            context=context
        )

        res = self.llm_client.generate(prompt=prompt, system_prompt=prompts.FORENSIC_SYSTEM_PROMPT)
        output_text = res.get("response", "")

        if not res.get("success") or "[LOCAL LLM OFFLINE" in output_text:
            output_text = (
                f"SUBPOENA / LEGAL DEMAND FOR INFORMATION TO VIRTUAL ASSET SERVICE PROVIDER\n\n"
                f"TO: Compliance & Legal Department, {vasp_name}\n"
                f"CASE REFERENCE: {case_data['case_id']}\n"
                f"TARGET DEPOSIT ADDRESS: `{target_wallet}`\n"
                f"TRACED AMOUNT: {case_data['amount_lost']} {case_data['currency']}\n\n"
                f"DEMAND FOR IMMEDIATE RECORDS & PRESERVATION:\n"
                f"Pursuant to applicable law enforcement authority, you are hereby requested to disclose:\n"
                f"1. Full Subscriber Identity & Verified KYC records for account associated with deposit address `{target_wallet}`.\n"
                f"2. Complete audit trail of deposits, withdrawals, trades, and fiat conversions.\n"
                f"3. Immediate asset freeze directives on funds under control."
            )

        return {
            "document_type": "VASP_SUBPOENA",
            "case_id": case_id,
            "vasp_name": vasp_name,
            "wallet_address": target_wallet,
            "content": output_text
        }

    def generate_mlat_request(
        self,
        case_id: str,
        db: Session,
        target_jurisdiction: str = "United States / European Union / Singapore",
        vasp_name: str = "Offshore Crypto Exchange"
    ) -> Dict[str, Any]:
        """
        Generate a Mutual Legal Assistance Treaty (MLAT) Request Template.
        """
        self.rag_pipeline.index_case_graph(case_id, db)
        case_data = self._get_case_data(db, case_id)
        context = self.rag_pipeline.get_grounded_context_str(query="mlat international vasp jurisdiction", case_id=case_id, top_k=10)

        prompt = prompts.MLAT_REQUEST_PROMPT.format(
            originating_jurisdiction="India (Republic of India)",
            target_jurisdiction=target_jurisdiction,
            case_id=case_data["case_id"],
            vasp_name=vasp_name,
            wallet_address=case_data["suspect_wallet"],
            amount=case_data["amount_lost"],
            currency=case_data["currency"],
            context=context
        )

        res = self.llm_client.generate(prompt=prompt, system_prompt=prompts.FORENSIC_SYSTEM_PROMPT)
        output_text = res.get("response", "")

        if not res.get("success") or "[LOCAL LLM OFFLINE" in output_text:
            output_text = (
                f"MUTUAL LEGAL ASSISTANCE TREATY (MLAT) REQUEST TEMPLATE\n\n"
                f"FROM: Central Authority, Republic of India\n"
                f"TO: Competent Legal Authority, {target_jurisdiction}\n"
                f"CASE FILE: {case_data['case_id']}\n"
                f"SUBJECT VASP: {vasp_name}\n"
                f"TARGET ADDRESS: `{case_data['suspect_wallet']}` ({case_data['amount_lost']} {case_data['currency']})\n\n"
                f"1. SUMMARY OF INVESTIGATION & DUAL CRIMINALITY\n"
                f"This request relates to an international cyber fraud and money laundering investigation involving illicit transfers to `{vasp_name}`.\n\n"
                f"2. SPECIFIC ASSISTANCE REQUESTED\n"
                f"- Legal order requiring `{vasp_name}` to produce full KYC and IP logs for address `{case_data['suspect_wallet']}`.\n"
                f"- Temporary seizure and forfeiture of illicit proceeds."
            )

        return {
            "document_type": "MLAT_REQUEST",
            "case_id": case_id,
            "target_jurisdiction": target_jurisdiction,
            "vasp_name": vasp_name,
            "content": output_text
        }
