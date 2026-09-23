"""
Crypto-Trace Copilot package.

Includes:
- OllamaClient: Local Ollama HTTP client (Llama 3.1 8B / Mistral 7B)
- RAGPipeline: ChromaDB + nomic-embed-text vector store & retrieval
- NarrativeGenerator: Executive summary, Court narrative, Sec 91 CrPC notice, VASP subpoena, MLAT request generator
- ChatSessionManager & ChatSession: Multi-turn chat session state manager
- InvestigationCopilot: Grounded QA engine
"""

from app.copilot.llm_client import OllamaClient
from app.copilot.rag_pipeline import RAGPipeline
from app.copilot.narrative_generator import NarrativeGenerator
from app.copilot.chat_session import ChatSessionManager, ChatSession
from app.copilot.investigator_copilot import InvestigationCopilot

__all__ = [
    "OllamaClient",
    "RAGPipeline",
    "NarrativeGenerator",
    "ChatSessionManager",
    "ChatSession",
    "InvestigationCopilot"
]
