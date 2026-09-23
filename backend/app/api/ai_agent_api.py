from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import json
from app.config import settings

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
    description: Optional[str] = None

class IntakeResponse(BaseModel):
    reply_text: str
    extracted_data: ExtractedData
    is_complete: bool

SYSTEM_PROMPT = """
You are 'Crypto Copilot', an empathetic, professional cyber crime investigator AI assistant for India's Law Enforcement Cyber Cell.
Your goal is to guide victims through filing an official cryptocurrency cyber fraud report with compassion, asking one clear question at a time.
Extract the following information:
1. Victim's Name
2. Amount Lost (numeric value in INR or crypto)
3. Currency (default INR)
4. Suspect Wallet Address (e.g., 0x...)
5. Blockchain Network (Ethereum, Polygon, BSC, Tron, Solana, Bitcoin)
6. Modus Operandi / Incident Summary

Analyze the conversation history and user input. If information is missing, ask for it empathetically in the language the victim speaks (English, Hindi, or Hinglish).
If the key details (especially name, amount lost, and suspect wallet or incident details) have been obtained, summarize them reassuringly and set is_complete to true.

IMPORTANT: Return ONLY a valid JSON object matching this schema:
{
  "reply_text": "Your natural language response to the user.",
  "extracted_data": {
    "victim_name": "extracted name or null",
    "amount_lost": 10000,
    "currency": "INR",
    "suspect_wallet": "extracted wallet or null",
    "blockchain": "Ethereum",
    "description": "Brief factual summary of what happened"
  },
  "is_complete": false
}
"""

@router.post("/intake", response_model=IntakeResponse)
def crypto_copilot_intake(request: IntakeRequest):
    model = get_gemini_model()
    # Fallback mock logic if no API key is provided
    if not model:
        print("WARNING: GEMINI_API_KEY not set or invalid. Using mock Crypto Copilot response.")
        return mock_intake_logic(request)

    try:
        # Construct the prompt
        prompt = SYSTEM_PROMPT + "\n\nConversation History:\n"
        for msg in request.conversation_history:
            prompt += f"{msg.role}: {msg.content}\n"
        prompt += f"user: {request.latest_user_input}\n\n"
        prompt += "Return the JSON response now:"

        response = model.generate_content(prompt)
        response_text = response.text.strip()
        
        # Clean up markdown formatting if Gemini returns code blocks
        if response_text.startswith("```json"):
            response_text = response_text[7:-3].strip()
        elif response_text.startswith("```"):
            response_text = response_text[3:-3].strip()

        # Regex fallback for JSON object
        import re
        match = re.search(r'\{[\s\S]*\}', response_text)
        if match:
            response_text = match.group(0)
            
        data = json.loads(response_text, strict=False)
        
        return IntakeResponse(
            reply_text=data.get("reply_text", "I understand. Can you provide more details?"),
            extracted_data=ExtractedData(**data.get("extracted_data", {})),
            is_complete=data.get("is_complete", False)
        )
    except Exception as e:
        print(f"Crypto Copilot Error: {e}")
        # Fallback to mock on error so the app doesn't break
        return mock_intake_logic(request)


def mock_intake_logic(request: IntakeRequest) -> IntakeResponse:
    """A simple mock state machine to simulate the AI if Gemini is unavailable."""
    input_text = request.latest_user_input.lower()
    history_len = len(request.conversation_history)
    
    # Very basic mock extraction based on turn count
    ext_data = ExtractedData()
    if history_len > 1:
        ext_data.victim_name = "Mock User"
    if history_len > 3:
        ext_data.amount_lost = 50000
    if history_len > 5:
        ext_data.suspect_wallet = "0xMockWalletAddress123"
        
    if history_len == 0:
        reply = "Hello! I am Crypto Copilot. I'm sorry you experienced this. Could you please tell me your full name?"
    elif history_len == 2:
        reply = "Thank you. Can you tell me roughly how much money was lost?"
    elif history_len == 4:
        reply = "I've noted the amount. Do you happen to have the suspect's wallet address or transaction hash?"
    else:
        reply = "Thank you. I have collected all the necessary details. You can now submit your complaint."
        return IntakeResponse(reply_text=reply, extracted_data=ext_data, is_complete=True)
        
    return IntakeResponse(reply_text=reply, extracted_data=ext_data, is_complete=False)
