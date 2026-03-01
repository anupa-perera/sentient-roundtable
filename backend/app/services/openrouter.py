import json
from collections.abc import Awaitable, Callable

import httpx


TokenCallback = Callable[[str], Awaitable[None]]


class OpenRouterClient:
    """Small async client for OpenRouter model and completion APIs."""

    def __init__(self, base_url: str, http_referer: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._http_referer = http_referer

    def _headers(self, api_key: str) -> dict[str, str]:
        """Build OpenRouter headers without exposing keys to logs."""
        return {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": self._http_referer,
        }

    async def list_models(self, api_key: str) -> list[dict]:
        """Fetch model catalog for a given API key."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self._base_url}/models",
                headers=self._headers(api_key),
            )
            if response.status_code >= 400:
                raise RuntimeError(f"OpenRouter model listing failed ({response.status_code}).")
            payload = response.json()
            data = payload.get("data")
            if not isinstance(data, list):
                return []
            return data

    async def chat_completion(
        self,
        *,
        api_key: str,
        model: str,
        system_prompt: str,
        user_message: str,
        max_tokens: int,
        temperature: float,
    ) -> str:
        """Execute a non-streaming chat completion and return full text."""
        body = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self._base_url}/chat/completions",
                headers=self._headers(api_key),
                json=body,
            )
            if response.status_code >= 400:
                raise RuntimeError(f"OpenRouter completion failed ({response.status_code}).")
            payload = response.json()
            choices = payload.get("choices", [])
            if not choices:
                return ""
            return str(choices[0].get("message", {}).get("content", "")).strip()

    async def chat_completion_stream(
        self,
        *,
        api_key: str,
        model: str,
        system_prompt: str,
        user_message: str,
        on_token: TokenCallback,
        max_tokens: int,
        temperature: float,
    ) -> str:
        """Execute streaming chat completion, forwarding each token to callback."""
        body = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": True,
        }
        full_response = ""
        async with httpx.AsyncClient(timeout=180.0) as client:
            async with client.stream(
                "POST",
                f"{self._base_url}/chat/completions",
                headers=self._headers(api_key),
                json=body,
            ) as response:
                if response.status_code >= 400:
                    raise RuntimeError(f"OpenRouter stream failed ({response.status_code}).")
                async for line in response.aiter_lines():
                    if not line or not line.startswith("data: "):
                        continue
                    payload = line[6:]
                    if payload.strip() == "[DONE]":
                        break
                    try:
                        chunk = json.loads(payload)
                    except json.JSONDecodeError:
                        continue
                    token = (
                        chunk.get("choices", [{}])[0]
                        .get("delta", {})
                        .get("content", "")
                    )
                    if token:
                        full_response += token
                        await on_token(token)
        return full_response.strip()
