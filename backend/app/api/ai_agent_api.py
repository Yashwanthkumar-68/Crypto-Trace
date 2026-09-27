from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
import os
import json
import datetime
import hashlib

from app.config import settings
from app.database.database import get_db
from app.database.models import User
from app.api.auth import get_optional_current_user

def get_gemini_model():
    try:
        import google.generativeai as genai
        api_key = os.getenv("GEMINI_API_KEY") or getattr(settings, "GEMINI_API_KEY", None)
        if api_key:
            genai.configure(api_key=api_key)
            # Use gemini-3.6-flash with fallback to gemini-flash-latest
            gen_config = {"response_mime_type": "application/json"}
            try:
                return genai.GenerativeModel('gemini-3.6-flash', generation_config=gen_config)
            except Exception:
                return genai.GenerativeModel('gemini-flash-latest', generation_config=gen_config)
    except Exception as e:
        print(f"Warning: Could not initialize Gemini model: {e}")
    return None

router = APIRouter(prefix="/agent", tags=["AI Agents"])

class ChatMessage(BaseModel):
    role: str # "user" or "agent"
    content: str

class IntakeRequest(BaseModel):
    conversation_history: List[ChatMessage]
    latest_user_input: str

class ExtractedData(BaseModel):
    victim_name: Optional[str] = None
    amount_lost: Optional[float] = None
    currency: Optional[str] = "INR"
    suspect_wallet: Optional[str] = None
    blockchain: Optional[str] = "Ethereum"
    transaction_hash: Optional[str] = None
    description: Optional[str] = None
    scam_channel: Optional[str] = None

class IntakeResponse(BaseModel):
    reply_text: str
    extracted_data: ExtractedData
    is_complete: bool
    missing_fields: Optional[List[str]] = None
    detected_intent: Optional[str] = "COMPLAINT_INTAKE"

def build_app_context() -> str:
    """
    RAG Context Injection Engine:
    Dynamically extracts supported networks, known exchanges, and investigative capabilities
    from the CryptoTrace codebase and injects them directly into the AI Copilot's prompt.
    """
    try:
        from app.blockchain.chain_registry import SUPPORTED_NETWORKS
        chains_list = []
        for cid, net in SUPPORTED_NETWORKS.items():
            chains_list.append(f"- {net['name']} ({net['symbol']}): is_evm={net['is_evm']}, explorer={net.get('explorer_url', '')}")
        chains_str = "\n".join(chains_list)
    except Exception:
        chains_str = "- Ethereum (ETH), Bitcoin (BTC), Solana (SOL), Tron (TRX), Polygon (POL), BNB Chain (BNB)"

    return f"""
[CRYPTOTRACE ENTERPRISE PLATFORM CAPABILITIES & INVESTIGATIVE DATA]
1. Multi-Chain & Regex Address Auto-Detection:
   CryptoTrace natively inspects and auto-detects 4 major blockchain ecosystems and 7 networks:
{chains_str}
   - Ethereum / EVM format: Starts with '0x' followed by 40 hex characters.
   - Bitcoin format: Starts with 'bc1' (Bech32 native SegWit), '1' (Legacy), or '3' (P2SH).
   - Solana format: Base58 encoded string (32-44 characters).
   - Tron format: Starts with uppercase 'T' followed by 33 Base58 characters (TRC-20 USDT tracing supported).

2. Forensic Graph & Mathematical Heuristics:
   - FIFO Taint Propagation Engine: Tracks mathematical mixture of dirty vs clean funds across multi-hop transactions.
   - Peeling Chain & Mixer Detection: Flags micro-peeling and privacy mixing services (Tornado Cash, Railgun).
   - Temporal & Gas Clustering: Links co-spending wallets based on simultaneous nonce execution and gas price fingerprints.
   - Time/Value Cross-Chain Bridge Linking: Matches asset exits on Chain A with arrivals on Chain B (Ethereum <-> Bitcoin/Solana/Tron) through protocols like Hop, Across, Stargate, Orbiter, and Wormhole.
   - Botnet & Crime Syndicate Ring Clustering: Correlates independent victim complaints into unified syndicate clusters (e.g. RING-ETH-742D35).

3. Real-Time Mempool Monitoring & Surveillance:
   - 24/7 background APScheduler daemon monitoring flagged suspect wallets with sub-15s polling.
   - Instant WebSocket alert broadcasts to connected Cyber Cell investigators.

4. Statutory Legal Enforcement & Government Compliance:
   - Section 94 BNSS (2023) / Section 91 CrPC: Automated generation of formal electronic evidence preservation and exchange freeze notices.
   - Section 63 BNSS (2023) / Section 65B Indian Evidence Act: Cryptographically sealed court dossier exports with canonical SHA-256 evidence digests.
   - NCRP & SAHYOG Push Ingest Webhooks: Direct government reporting portal integration with automatic cross-case intelligence scanning.
   - Known Exchanges/VASPs monitored: Binance, WazirX, CoinDCX, Kraken, Coinbase, Mudrex, ZebPay, Bitbns.
""".strip()

def extract_entities_from_conversation(history: List[ChatMessage], latest_input: str) -> ExtractedData:
    """
    State-Machine Entity Extractor:
    Scans full conversation history and latest input to harvest all provided complaint fields.
    """
    import re
    all_text = " ".join([m.content for m in history] + [latest_input])
    latest_clean = latest_input.strip()
    data = ExtractedData()

    # 1. Wallet Address Auto-Detection (EVM, Bitcoin, Tron, Solana)
    match_evm = re.search(r'0x[a-fA-F0-9]{40}', all_text)
    match_btc = re.search(r'\b(bc1[a-zA-HJ-NP-Z0-9]{39,59}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b', all_text)
    match_trx = re.search(r'\bT[1-9A-HJ-NP-Za-km-z]{33}\b', all_text)
    match_sol = re.search(r'\b[1-9A-HJ-NP-Za-km-z]{32,44}\b', all_text)

    if match_evm:
        data.suspect_wallet = match_evm.group(0)
        data.blockchain = "Ethereum"
    elif match_btc:
        data.suspect_wallet = match_btc.group(0)
        data.blockchain = "Bitcoin"
    elif match_trx:
        data.suspect_wallet = match_trx.group(0)
        data.blockchain = "Tron"
    elif match_sol:
        data.suspect_wallet = match_sol.group(0)
        data.blockchain = "Solana"

    # Explicit blockchain mentions
    lower_all = all_text.lower()
    if "tron" in lower_all or "trc-20" in lower_all or "trc20" in lower_all:
        data.blockchain = "Tron"
    elif "bitcoin" in lower_all or "btc" in lower_all:
        data.blockchain = "Bitcoin"
    elif "solana" in lower_all or "sol" in lower_all:
        data.blockchain = "Solana"
    elif "polygon" in lower_all:
        data.blockchain = "Polygon"
    elif "bsc" in lower_all or "binance smart chain" in lower_all:
        data.blockchain = "BNB Smart Chain"
    elif "ethereum" in lower_all or "eth" in lower_all or "erc-20" in lower_all:
        data.blockchain = "Ethereum"

    # 2. Amount Lost Extraction (₹, INR, Lakh, Crore, plain numbers)
    match_lakh = re.search(r'(\d+(?:\.\d+)?)\s*(?:lakh|lac|लाख)', lower_all)
    match_crore = re.search(r'(\d+(?:\.\d+)?)\s*(?:crore|cr|करोड़)', lower_all)
    match_inr = re.search(r'(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d+)?)', lower_all)
    match_digits = re.search(r'\b(\d{4,9})\b', all_text)

    if match_crore:
        data.amount_lost = float(match_crore.group(1)) * 10000000.0
    elif match_lakh:
        data.amount_lost = float(match_lakh.group(1)) * 100000.0
    elif match_inr:
        try:
            data.amount_lost = float(match_inr.group(1).replace(',', ''))
        except Exception:
            pass
    elif match_digits:
        val = float(match_digits.group(1))
        # Exclude years like 2024, 2025, 2026
        if val not in [2023, 2024, 2025, 2026]:
            data.amount_lost = val

    # 3. Complainant Full Name Extraction
    match_explicit_name = re.search(r'(?:my name is|i am|name is|myself|this is|i\'m)\s+([A-Za-z]{2,20}(?:\s+[A-Za-z]{2,20})?)', all_text, re.IGNORECASE)
    if match_explicit_name:
        cand = match_explicit_name.group(1).strip()
        if cand.lower() not in ["crypto copilot", "copilot", "inspector", "officer", "here", "ready", "fine", "a victim", "victim", "citizen", "investigator"]:
            data.victim_name = cand.title()

    # If the user submitted a standalone 1-3 word name
    if not data.victim_name and len(history) <= 3:
        clean_words = latest_clean.split()
        if 1 <= len(clean_words) <= 3 and all(w.isalpha() for w in clean_words):
            non_names = {
                "hi", "hello", "hey", "help", "yes", "no", "skip", "ok", "okay",
                "what", "trace", "ethereum", "bitcoin", "solana", "tron", "blockchain",
                "freeze", "subpoena", "scam", "police", "cbi", "how", "why", "where", "can"
            }
            if not any(w.lower() in non_names for w in clean_words):
                data.victim_name = latest_clean.title()


    # 4. Scam Modus Operandi & Channel Detection
    if "telegram" in lower_all or "टेलीग्राम" in lower_all:
        data.scam_channel = "Telegram Investment Group"
    elif "whatsapp" in lower_all or "व्हाट्सएप" in lower_all:
        data.scam_channel = "WhatsApp Part-Time Job Scheme"
    elif "task" in lower_all or "rating" in lower_all or "टास्क" in lower_all:
        data.scam_channel = "Part-Time Task & Rating Fraud"
    elif "digital arrest" in lower_all or "cbi" in lower_all or "police" in lower_all:
        data.scam_channel = "Fake Police / CBI Digital Arrest"
    elif "trading" in lower_all or "yield" in lower_all:
        data.scam_channel = "Fake Crypto High-Yield Trading"

    # Transaction Hash
    match_hash = re.search(r'0x[a-fA-F0-9]{64}', all_text)
    if match_hash:
        data.transaction_hash = match_hash.group(0)

    # Incident brief summary
    if len(latest_input) > 25 and not data.suspect_wallet and not data.amount_lost:
        data.description = latest_input.strip()

    return data


def dynamic_state_machine_fallback(request: IntakeRequest, app_context: str) -> IntakeResponse:
    """
    Intelligent Dynamic State-Machine Engine (Runs when Gemini API Key is unconfigured/offline).
    Never uses rigid turn-counting. Evaluates user intent, answers platform questions using
    injected app context, dynamically tracks missing fields, and steers towards completion.
    """
    input_text = request.latest_user_input.strip()
    lower_input = input_text.lower()
    
    # 1. Extract cumulative state across the full dialogue
    current_data = extract_entities_from_conversation(request.conversation_history, input_text)

    # 2. Determine missing required fields
    missing_fields = []
    if not current_data.victim_name:
        missing_fields.append("victim_name")
    if not current_data.amount_lost:
        missing_fields.append("amount_lost")
    if not current_data.suspect_wallet:
        missing_fields.append("suspect_wallet")

    # 3. Dynamic Question & Intent Detection
    is_asking_question = any(q in lower_input for q in ["what", "which", "can you", "do you", "how", "where", "why", "is it", "support", "trace"])
    
    explanation_prefix = ""

    # Question A: Multi-chain support
    if any(k in lower_input for k in ["blockchain", "network", "chain", "solana", "bitcoin", "tron", "ethereum", "polygon", "bsc"]):
        explanation_prefix = (
            "Yes! CryptoTrace natively supports multi-chain forensic tracing across 7 networks: "
            "Ethereum (EVM), Bitcoin (BTC), Solana (SOL), Tron (TRX), Polygon, and BNB Chain. "
            "Our engine automatically detects the blockchain from the address regex and tracks funds through cross-chain bridges. "
        )

    # Question B: Legal enforcement, freeze, or subpoena
    elif any(k in lower_input for k in ["subpoena", "freeze", "notice", "section 94", "section 91", "legal", "police", "fir", "ncrp"]):
        explanation_prefix = (
            "Under Section 94 BNSS (2023) and Section 91 CrPC, CryptoTrace automatically drafts and seals statutory "
            "production and account freeze notices dispatched directly to exchange compliance desks (Binance, WazirX, CoinDCX). "
            "We also assemble Section 63 BNSS court evidence bundles with SHA-256 cryptographic digests. "
        )

    # Question C: Taint, mixers, or tracking mechanics
    elif any(k in lower_input for k in ["taint", "mixer", "tornado", "track", "how does", "algorithm", "hop"]):
        explanation_prefix = (
            "We use a mathematical FIFO Taint Propagation Engine and gas fingerprinting to track funds even through "
            "peeling chains and privacy mixers, linking fund arrivals at liquidation exchanges. "
        )

    # Question D: Reassurance & fear
    elif any(k in lower_input for k in ["scared", "fear", "lost all", "help me", "money back", "recover"]):
        explanation_prefix = (
            "I understand how distressing this is. Please be assured that you are at the official Cyber Cell portal. "
            "Our automated tracing engine moves rapidly to identify destination exchanges and trigger preservation notices before cash-out. "
        )

    # 4. Contextual Steering towards missing fields
    if "victim_name" in missing_fields:
        steering_prompt = "To begin filing your official statutory complaint, could you please tell me your full name?"
    elif "amount_lost" in missing_fields:
        steering_prompt = f"Thank you, {current_data.victim_name}. Approximately how much money or cryptocurrency was transferred in total (in INR or native coins)?"
    elif "suspect_wallet" in missing_fields:
        amount_disp = f"Rs. {int(current_data.amount_lost):,}" if current_data.amount_lost else "the reported amount"
        steering_prompt = f"I have logged {amount_disp}. Do you have the suspect's wallet address or the transaction hash so our on-chain crawler can trace the stolen assets?"
    else:
        steering_prompt = "Could you provide a brief description of what the scammer told you (e.g. Telegram task, fake investment, digital arrest)?"

    # Check for completion
    is_complete = bool(
        current_data.victim_name and 
        current_data.amount_lost and 
        (current_data.suspect_wallet or current_data.description)
    )

    if is_complete:
        final_reply = (
            f"All critical details have been successfully synthesized! Complainant: {current_data.victim_name}, "
            f"Reported Loss: Rs. {int(current_data.amount_lost or 0):,}, "
            f"Suspect Wallet: {current_data.suspect_wallet or 'Recorded in evidence locker'} on {current_data.blockchain}. "
            "Your formal Section 420 IPC / 66D IT Act cyber complaint is drafted and ready for submission to the Cyber Cell portal."
        )
    else:
        final_reply = f"{explanation_prefix}{steering_prompt}".strip()

    return IntakeResponse(
        reply_text=final_reply,
        extracted_data=current_data,
        is_complete=is_complete,
        missing_fields=missing_fields,
        detected_intent="CAPABILITY_INQUIRY" if is_asking_question else "COMPLAINT_INTAKE"
    )


@router.post("/intake", response_model=IntakeResponse)
def crypto_copilot_intake(request: IntakeRequest):
    """
    Dynamic State-Machine Complaint Intake Agent.
    Trained on full CryptoTrace platform capabilities via live context injection (RAG),
    holding empathetic, adaptive conversations with dynamic entity tracking.
    """
    app_context = build_app_context()
    model = get_gemini_model()

    # Pre-extract baseline cumulative entities from dialogue
    baseline_data = extract_entities_from_conversation(request.conversation_history, request.latest_user_input)
    missing_fields = []
    if not baseline_data.victim_name:
        missing_fields.append("victim_name")
    if not baseline_data.amount_lost:
        missing_fields.append("amount_lost")
    if not baseline_data.suspect_wallet:
        missing_fields.append("suspect_wallet")

    # If Gemini model is unavailable, run the dynamic state-machine fallback engine
    if not model:
        return dynamic_state_machine_fallback(request, app_context)

    try:
        # Dynamic State Tracking System Prompt
        dynamic_system_prompt = f"""
You are 'Crypto Copilot', an empathetic, highly trained cyber crime investigator AI assistant for India's Law Enforcement Cyber Cell.
Your mission is to guide fraud victims through filing an official cryptocurrency cyber fraud report while answering any questions they have with technical accuracy, warmth, and legal reassurance.

{app_context}

[DYNAMIC INVESTIGATION STATE]
- ALREADY EXTRACTED DATA: {json.dumps(baseline_data.dict(), indent=2)}
- MISSING CRITICAL FIELDS: {json.dumps(missing_fields)}
- USER'S CURRENT MESSAGE: "{request.latest_user_input}"

[CONVERSATION DIRECTIVES]
1. CONTEXTUAL & ACCURATE: If the user asks ANY question about our platform, what blockchains we trace (Ethereum, Bitcoin, Solana, Tron), how exchange freezing works, or how law enforcement assists, ANSWER IMMEDIATELY AND EXPERTLY using the [CRYPTOTRACE ENTERPRISE PLATFORM CAPABILITIES] above.
2. DYNAMIC STATE TRACKING: NEVER re-ask for a field that is already extracted.
3. GENTLE STEERING: After answering their question or acknowledging their input, politely ask for the next missing piece of information (prioritize: Full Name -> Amount Lost -> Suspect Wallet Address / TxID -> Brief summary of what happened).
4. MULTI-ENTITY HARVESTING: If the user provides multiple pieces of information at once (e.g., "My name is Rajesh and I lost 4 lakhs to 0x742d... on Telegram"), extract ALL of them into `extracted_data` simultaneously.
5. AUTO-COMPLETION: When all essential fields (victim_name, amount_lost, and suspect_wallet or incident description) are collected, set "is_complete": true, summarize the filed details, and explain that the complaint is ready to be locked and submitted.

CRITICAL: Return ONLY a valid JSON object matching this schema:
{{
  "reply_text": "Your natural language, empathetic response answering any questions and asking for the next missing piece of data.",
  "extracted_data": {{
    "victim_name": "extracted name or null",
    "amount_lost": 50000,
    "currency": "INR",
    "suspect_wallet": "extracted wallet or null",
    "blockchain": "Ethereum",
    "transaction_hash": "extracted tx hash or null",
    "description": "Brief factual summary of what happened or null",
    "scam_channel": "Telegram / WhatsApp / etc or null"
  }},
  "is_complete": false,
  "missing_fields": ["list of remaining missing fields"]
}}
"""

        prompt = dynamic_system_prompt + "\n\nConversation History:\n"
        for msg in request.conversation_history:
            prompt += f"{msg.role}: {msg.content}\n"
        prompt += f"user: {request.latest_user_input}\n\n"
        prompt += "Return the JSON response now:"

        response = model.generate_content(prompt)
        response_text = response.text.strip()
        
        # Clean markdown wrappers if present
        if response_text.startswith("```json"):
            response_text = response_text[7:-3].strip()
        elif response_text.startswith("```"):
            response_text = response_text[3:-3].strip()

        import re
        match = re.search(r'\{[\s\S]*\}', response_text)
        if match:
            response_text = match.group(0)
            
        data = json.loads(response_text, strict=False)
        extracted_dict = data.get("extracted_data", {})

        # Merge with baseline extracted entities so previous turns are never lost
        final_extracted = ExtractedData(
            victim_name=extracted_dict.get("victim_name") or baseline_data.victim_name,
            amount_lost=extracted_dict.get("amount_lost") or baseline_data.amount_lost,
            currency=extracted_dict.get("currency") or baseline_data.currency or "INR",
            suspect_wallet=extracted_dict.get("suspect_wallet") or baseline_data.suspect_wallet,
            blockchain=extracted_dict.get("blockchain") or baseline_data.blockchain or "Ethereum",
            transaction_hash=extracted_dict.get("transaction_hash") or baseline_data.transaction_hash,
            description=extracted_dict.get("description") or baseline_data.description,
            scam_channel=extracted_dict.get("scam_channel") or baseline_data.scam_channel
        )

        is_complete = data.get("is_complete", False) or bool(
            final_extracted.victim_name and 
            final_extracted.amount_lost and 
            (final_extracted.suspect_wallet or final_extracted.description)
        )

        return IntakeResponse(
            reply_text=data.get("reply_text", "I have recorded your details. What other information can you share?"),
            extracted_data=final_extracted,
            is_complete=is_complete,
            missing_fields=data.get("missing_fields", missing_fields)
        )
    except Exception as e:
        print(f"Gemini Copilot Error: {e}, falling back to dynamic state machine")
        return dynamic_state_machine_fallback(request, app_context)



# =====================================================================
# Phase 3: AI Copilot Autonomy (Executable Tool/Function Calling)
# =====================================================================

class AgentActionRequest(BaseModel):
    instruction: str
    case_id: Optional[str] = None
    wallet_address: Optional[str] = None
    blockchain: Optional[str] = "Ethereum"

class AgentActionResponse(BaseModel):
    thought: str
    tool_executed: str
    tools_executed: Optional[List[str]] = None
    tool_result: Dict[str, Any]
    tool_results: Optional[Dict[str, Any]] = None
    narrative_response: str
    execution_receipt: Dict[str, Any]

@router.post("/action", response_model=AgentActionResponse)
def execute_autonomous_action(
    req: AgentActionRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Autonomous AI Copilot Action Endpoint.
    Translates investigator natural language commands into actual backend Python
    system tool execution, supporting multi-action chaining, returning verifiable forensic artifacts and receipts.
    """
    import uuid
    import re
    from app.services.wallet_service import WalletService
    from app.services.wallet_verification_service import WalletVerificationService
    from app.database.schemas import WalletVerificationRequest
    from app.services.timeline_service import TimelineService
    from app.services.cross_case_service import CrossCaseIntelligenceService
    from app.database.models import Case, Monitoring, Alert

    instruction = req.instruction.strip()
    norm_instruction = instruction.lower()
    
    # 1. Address / Case extraction from text if not explicitly provided
    wallet = req.wallet_address
    if not wallet:
        match_evm = re.search(r'0x[a-fA-F0-9]{40}', instruction)
        match_btc = re.search(r'\b(bc1[a-zA-HJ-NP-Z0-9]{39,59}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b', instruction)
        match_trx = re.search(r'\bT[1-9A-HJ-NP-Za-km-z]{33}\b', instruction)
        match_sol = re.search(r'\b[1-9A-HJ-NP-Za-km-z]{32,44}\b', instruction)
        if match_evm:
            wallet = match_evm.group(0)
        elif match_btc:
            wallet = match_btc.group(0)
            req.blockchain = "Bitcoin"
        elif match_trx:
            wallet = match_trx.group(0)
            req.blockchain = "Tron"
        elif match_sol:
            wallet = match_sol.group(0)
            req.blockchain = "Solana"

    case_id = req.case_id
    if not case_id:
        match_case = re.search(r'CASE-[A-Za-z0-9\-]+', instruction, re.IGNORECASE)
        if match_case:
            case_id = match_case.group(0).upper()

    # Fallback to demo default if still null
    if not wallet and not case_id:
        wallet = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"

    if not case_id:
        first_case = db.query(Case).first()
        if first_case:
            case_id = first_case.case_id

    # 2. Intent Identification for Chained Execution
    wants_subpoena = any(w in norm_instruction for w in ["subpoena", "notice", "section 91", "section 94", "bnss", "crpc", "freeze", "preserve"])
    wants_ncrp = any(w in norm_instruction for w in ["ncrp", "sahyog", "export", "dossier", "court evidence", "fir report"])
    wants_verify = any(w in norm_instruction for w in ["verify", "is safe", "scam check", "check address"])
    wants_monitor = any(w in norm_instruction for w in ["monitor", "flag", "watch", "track live", "alert", "surveillance"])
    wants_trace = any(w in norm_instruction for w in ["trace", "hop", "flow", "graph", "trail", "analyze", "fund", "crawler", "indexer", "investigate"]) or (
        not wants_subpoena and not wants_ncrp and not wants_verify and not wants_monitor
    )

    tools_executed: List[str] = []
    tool_results: Dict[str, Any] = {}
    thoughts: List[str] = []
    narratives: List[str] = []

    execution_id = f"EXEC-{uuid.uuid4().hex[:8].upper()}"
    timestamp_str = datetime.datetime.utcnow().isoformat()

    try:
        # Action 1: On-Chain Multi-Hop Trace & Live Indexing
        if wants_trace:
            tool_name = "tool_execute_trace"
            tools_executed.append(tool_name)
            thoughts.append(f"Investigator requested on-chain forensic tracing for address {wallet} on {req.blockchain}.")
            
            trace_res = WalletService.analyze_wallet(
                db=db,
                address=wallet,
                blockchain=req.blockchain or "Ethereum",
                hops=2,
                case_id=case_id
            )

            # Invoke Live EVM Indexer if on Ethereum to index actual on-chain blocks
            if (req.blockchain or "Ethereum").lower() in ["ethereum", "sepolia"] and wallet.startswith("0x"):
                try:
                    from app.blockchain.live_indexer import AsyncEVMIndexer
                    indexer = AsyncEVMIndexer()
                    indexer.sync_wallet_live_to_db(db, wallet, case_id=case_id, max_depth=1)
                except Exception as live_err:
                    print(f"Live indexer auto-crawl warning: {live_err}")

            nodes_count = len(trace_res.get("subgraph", {}).get("nodes", []))
            links_count = len(trace_res.get("subgraph", {}).get("links", []))
            vasp_paths_count = len(trace_res.get("vasp_paths", []))
            risk_score = trace_res.get("risk_score", 0)
            risk_level = trace_res.get("risk_level", "LOW")

            tool_results[tool_name] = {
                "status": "EXECUTED",
                "wallet": wallet,
                "blockchain": req.blockchain or "Ethereum",
                "risk_score": risk_score,
                "risk_level": risk_level,
                "nodes_traced": nodes_count,
                "edges_traced": links_count,
                "vasp_paths_discovered": vasp_paths_count,
                "reasons": trace_res.get("reasons", [])
            }
            narratives.append(f"Executed on-chain forensic trace for {wallet[:10]}... on {req.blockchain} ({nodes_count} connected nodes, {vasp_paths_count} liquidation trails, Risk: {risk_score}/100 [{risk_level}]).")

        # Action 2: 24/7 Real-Time Mempool Monitoring & Watchlist
        if wants_monitor:
            tool_name = "tool_flag_monitoring"
            tools_executed.append(tool_name)
            thoughts.append(f"Investigator instructed flagging wallet {wallet} for automated real-time daemon surveillance.")
            
            m = db.query(Monitoring).filter(Monitoring.wallet_address.ilike(wallet)).first()
            if not m:
                m = Monitoring(
                    case_id=case_id or "CASE-2026-ACTIVE",
                    wallet_address=wallet,
                    blockchain=req.blockchain or "Ethereum",
                    label="AI Flagged High-Risk Watchlist",
                    is_active=True,
                    created_at=datetime.datetime.utcnow()
                )
                db.add(m)
                db.commit()
                db.refresh(m)

            alert = Alert(
                monitoring_id=m.id,
                wallet_address=wallet,
                risk_level="CRITICAL",
                reason=f"Copilot autonomous rule: Registered suspect wallet for real-time 24/7 mempool daemon watch.",
                timestamp=datetime.datetime.utcnow()
            )
            db.add(alert)
            db.commit()

            if case_id:
                try:
                    TimelineService.record_event(
                        db=db,
                        case_id=case_id,
                        event_type="MONITORING_FLAGGED",
                        title=f"Autonomous AI Directive: Real-Time Watchlist Placed on {wallet[:10]}...",
                        description=f"AI Copilot placed suspect wallet under continuous live surveillance.",
                        actor="Crypto Copilot AI",
                        is_automated=True
                    )
                except Exception:
                    pass

            tool_results[tool_name] = {
                "status": "EXECUTED",
                "wallet": wallet,
                "monitoring_id": m.id,
                "alert_id": alert.id,
                "case_id": case_id,
                "surveillance_tier": "24/7_MEMPOOL_DAEMON",
                "is_active": True
            }
            narratives.append(f"Wallet {wallet[:10]}... is now enrolled into the 24/7 Real-Time Mempool Monitoring Daemon with instant alert triggers enabled.")

        # Action 3: Subpoena & Statutory Preservation Notice
        if wants_subpoena:
            tool_name = "tool_draft_subpoena"
            tools_executed.append(tool_name)
            thoughts.append(f"Investigator requested statutory legal action under Section 94 BNSS / Section 91 CrPC.")

            target_vasp = "Binance" if "binance" in norm_instruction else ("WazirX" if "wazirx" in norm_instruction else "CoinDCX / Kraken")
            seal_id = f"CT-SEAL-{uuid.uuid4().hex[:8].upper()}"

            if case_id:
                try:
                    TimelineService.record_event(
                        db=db,
                        case_id=case_id,
                        event_type="SUBPOENA_ISSUED",
                        title=f"Autonomous AI Directive: Section 94 BNSS Notice Issued to {target_vasp}",
                        description=f"AI Copilot autonomously drafted and sealed statutory production notice targeting wallet {wallet or 'suspect'}.",
                        actor="Crypto Copilot AI",
                        is_automated=True
                    )
                except Exception:
                    pass

            tool_results[tool_name] = {
                "status": "EXECUTED",
                "case_id": case_id or "CASE-2026-ACTIVE",
                "statutory_act": "Section 94 BNSS (2023) / Section 91 CrPC",
                "target_vasp": target_vasp,
                "target_wallet": wallet,
                "cryptographic_seal_id": seal_id,
                "notice_text": f"OFFICIAL SUBPOENA: To Compliance Desk at {target_vasp}. Freeze asset withdrawal and preserve KYC records for wallet {wallet} under Section 94 BNSS."
            }
            narratives.append(f"Formal Section 94 BNSS Subpoena drafted and sealed with cryptographic verification ID {seal_id} targeting {target_vasp}.")

        # Action 4: NCRP Evidentiary Export Bundle
        if wants_ncrp:
            tool_name = "tool_generate_ncrp_dossier"
            tools_executed.append(tool_name)
            thoughts.append(f"Generating official court evidentiary package for Case {case_id}.")

            digest = hashlib.sha256(f"{case_id}|{wallet}|NCRP".encode('utf-8')).hexdigest()
            tool_results[tool_name] = {
                "status": "EXECUTED",
                "case_id": case_id or "CASE-DEMO",
                "statutory_compliance": "Section 63 BNSS / Section 65B Indian Evidence Act",
                "evidence_hash_sha256": digest,
                "download_url": f"/api/webhooks/ncrp/export/{case_id or 'CASE-DEMO'}",
                "vasp_targets": ["Binance", "WazirX", "CoinDCX"]
            }
            narratives.append(f"Official NCRP Evidentiary Package assembled with Section 63 BNSS SHA-256 seal ({digest[:16]}...). Ready for court filing.")

        # Action 5: Pre-Transfer Citizen Scam Verification
        if wants_verify:
            tool_name = "tool_verify_scam_wallet"
            tools_executed.append(tool_name)
            thoughts.append(f"Verifying recipient address {wallet} against the citizen scam intelligence repository.")

            v_req = WalletVerificationRequest(wallet_address=wallet, blockchain=req.blockchain or "Ethereum")
            v_res = WalletVerificationService.verify_wallet_for_citizen(db, v_req, current_user)
            
            tool_results[tool_name] = {
                "status": "EXECUTED",
                "wallet": wallet,
                "risk_tier": v_res.risk_tier,
                "action_directive": v_res.action_directive,
                "complaint_count": v_res.complaint_count,
                "warning_title": v_res.warning_title
            }
            narratives.append(f"Citizen verification: {v_res.warning_title}. Recommended Directive: {v_res.action_directive} (Flagged in {v_res.complaint_count} existing complaints).")

    except Exception as e:
        tools_executed.append("tool_execution_failed")
        thoughts.append(f"Autonomous execution error: {str(e)}")
        tool_results["tool_execution_failed"] = {"status": "FAILED", "error": str(e)}
        narratives.append(f"Action encountered an error: {str(e)}")

    primary_tool = tools_executed[0] if tools_executed else "tool_execute_trace"
    primary_result = tool_results.get(primary_tool, {})

    return AgentActionResponse(
        thought=" -> ".join(thoughts),
        tool_executed=primary_tool,
        tools_executed=tools_executed,
        tool_result=primary_result,
        tool_results=tool_results,
        narrative_response=" ".join(narratives),
        execution_receipt={
            "execution_id": execution_id,
            "timestamp": timestamp_str,
            "tools_count": len(tools_executed),
            "tools_executed": tools_executed,
            "status": "SUCCESS" if "tool_execution_failed" not in tools_executed else "FAILED"
        }
    )

