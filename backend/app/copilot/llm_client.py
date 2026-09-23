"""
Ollama HTTP Client for local, privacy-preserving LLM inference and embeddings.

Parameters:
- llm_model: "llama3.1:8b" (supports "mistral:7b")
- context_window: 131072 tokens (128K)
- temperature: 0.1 (forensic precision mode)
- embedding_model: "nomic-embed-text"
"""

import os
import logging
from typing import Dict, Any, List, Optional
import httpx

logger = logging.getLogger(__name__)

class OllamaClient:
    """
    HTTP Client for local Ollama server ensuring data never leaves the server environment.
    """

    def __init__(
        self,
        host: Optional[str] = None,
        llm_model: str = "llama3.1:8b",
        embedding_model: str = "nomic-embed-text",
        context_window: int = 131072,  # 128K tokens
        temperature: float = 0.1,      # Forensic precision mode
        timeout: float = 5.0
    ):
        self.host = (host or os.getenv("OLLAMA_HOST") or os.getenv("OLLAMA_URL") or "http://localhost:11434").rstrip("/")
        self.llm_model = llm_model
        self.embedding_model = embedding_model
        self.context_window = context_window
        self.temperature = temperature
        self.timeout_config = httpx.Timeout(timeout, connect=0.5)
        self._is_available: Optional[bool] = None

    def is_available(self) -> bool:
        if self._is_available is not None:
            return self._is_available
        try:
            with httpx.Client(timeout=httpx.Timeout(0.5, connect=0.2)) as client:
                res = client.get(f"{self.host}/api/tags")
                self._is_available = (res.status_code == 200)
        except Exception:
            self._is_available = False
        return self._is_available

    def check_health(self) -> Dict[str, Any]:
        """
        Check if Ollama local server is running and accessible.
        """
        try:
            with httpx.Client(timeout=httpx.Timeout(2.0, connect=0.5)) as client:
                res = client.get(f"{self.host}/api/tags")
                if res.status_code == 200:
                    models = [m.get("name") for m in res.json().get("models", [])]
                    self._is_available = True
                    return {
                        "status": "online",
                        "host": self.host,
                        "available_models": models,
                        "configured_llm": self.llm_model,
                        "configured_embedding": self.embedding_model
                    }
                self._is_available = False
                return {"status": "degraded", "http_status": res.status_code, "host": self.host}
        except Exception as e:
            self._is_available = False
            return {"status": "offline", "host": self.host, "error": str(e)}

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        context_window: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Generate text completion from Ollama endpoint.
        """
        target_model = model or self.llm_model
        target_temp = temperature if temperature is not None else self.temperature
        target_ctx = context_window or self.context_window

        payload = {
            "model": target_model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": target_temp,
                "num_ctx": target_ctx
            }
        }
        if system_prompt:
            payload["system"] = system_prompt

        url = f"{self.host}/api/generate"
        try:
            with httpx.Client(timeout=self.timeout_config) as client:
                res = client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    return {
                        "success": True,
                        "model": target_model,
                        "response": data.get("response", ""),
                        "context_window": target_ctx,
                        "temperature": target_temp,
                        "raw": data
                    }
                else:
                    logger.warning(f"Ollama error {res.status_code}: {res.text}")
                    return self._fallback_generate_response(prompt, f"Ollama HTTP {res.status_code}")
        except Exception as e:
            logger.error(f"Failed to communicate with Ollama at {url}: {e}")
            return self._fallback_generate_response(prompt, str(e))

    def chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        context_window: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Multi-turn chat completion using Ollama /api/chat endpoint.
        """
        target_model = model or self.llm_model
        target_temp = temperature if temperature is not None else self.temperature
        target_ctx = context_window or self.context_window

        payload = {
            "model": target_model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": target_temp,
                "num_ctx": target_ctx
            }
        }

        url = f"{self.host}/api/chat"
        try:
            with httpx.Client(timeout=self.timeout_config) as client:
                res = client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    msg = data.get("message", {})
                    return {
                        "success": True,
                        "model": target_model,
                        "role": msg.get("role", "assistant"),
                        "content": msg.get("content", ""),
                        "context_window": target_ctx,
                        "temperature": target_temp
                    }
                else:
                    return self._fallback_chat_response(messages, f"Ollama HTTP {res.status_code}")
        except Exception as e:
            logger.error(f"Failed to execute chat with Ollama: {e}")
            return self._fallback_chat_response(messages, str(e))

    def embed(
        self,
        text: str,
        model: Optional[str] = None
    ) -> List[float]:
        """
        Generate vector embedding using nomic-embed-text via Ollama /api/embeddings.
        Falls back to a normalized deterministic hash embedding if Ollama is offline.
        """
        target_model = model or self.embedding_model
        url = f"{self.host}/api/embeddings"
        payload = {
            "model": target_model,
            "prompt": text
        }
        try:
            with httpx.Client(timeout=self.timeout_config) as client:
                res = client.post(url, json=payload)
                if res.status_code == 200:
                    embedding = res.json().get("embedding", [])
                    if embedding:
                        return embedding
        except Exception as e:
            logger.debug(f"Ollama embedding call failed: {e}")

        # Deterministic fallback embeddingvector of dimension 768
        return self._deterministic_fallback_embedding(text)

    def _deterministic_fallback_embedding(self, text: str, dim: int = 768) -> List[float]:
        import hashlib
        import math
        vec = []
        seed = text.encode("utf-8")
        for i in range(dim):
            h = hashlib.sha256(seed + i.to_bytes(4, "big")).digest()
            val = (int.from_bytes(h[:4], "big") / 4294967295.0) * 2.0 - 1.0
            vec.append(val)
        norm = math.sqrt(sum(v*v for v in vec)) or 1.0
        return [v / norm for v in vec]

    def _fallback_generate_response(self, prompt: str, error_msg: str) -> Dict[str, Any]:
        return {
            "success": False,
            "model": self.llm_model,
            "response": f"[LOCAL LLM OFFLINE ({error_msg})]: Request processed in forensic fallback mode.",
            "context_window": self.context_window,
            "temperature": self.temperature,
            "error": error_msg
        }

    def _fallback_chat_response(self, messages: List[Dict[str, str]], error_msg: str) -> Dict[str, Any]:
        return {
            "success": False,
            "model": self.llm_model,
            "role": "assistant",
            "content": f"[LOCAL LLM OFFLINE ({error_msg})]: Fallback response generated.",
            "context_window": self.context_window,
            "temperature": self.temperature,
            "error": error_msg
        }
