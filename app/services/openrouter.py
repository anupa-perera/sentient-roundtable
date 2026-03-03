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

    @staticmethod
    def _build_chat_body(
        *,
        model: str,
        system_prompt: str,
        user_message: str,
        max_tokens: int,
        temperature: float,
        stream: bool,
    ) -> dict:
        """Build shared chat completion request payload."""
        return {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": stream,
        }

    @staticmethod
    def _extract_error_detail(raw_body: str) -> str | None:
        """Extract provider error message from response body when available."""
        try:
            payload = json.loads(raw_body)
        except json.JSONDecodeError:
            return None
        error_payload = payload.get("error")
        if isinstance(error_payload, dict):
            message = error_payload.get("message")
            if isinstance(message, str) and message.strip():
                return message.strip()
        message = payload.get("message")
        if isinstance(message, str) and message.strip():
            return message.strip()
        return None

    @classmethod
    def _raise_for_status(cls, operation: str, response: httpx.Response) -> None:
        """Raise consistent runtime error with optional provider detail."""
        if response.status_code < 400:
            return
        detail = cls._extract_error_detail(response.text)
        suffix = f": {detail}" if detail else "."
        raise RuntimeError(f"OpenRouter {operation} failed ({response.status_code}){suffix}")

    @staticmethod
    def _extract_completion_text(payload: dict) -> str:
        """Extract completion text from non-stream response payload."""
        choices = payload.get("choices")
        if not isinstance(choices, list) or not choices:
            return ""
        first_choice = choices[0]
        if not isinstance(first_choice, dict):
            return ""
        message = first_choice.get("message")
        if not isinstance(message, dict):
            return ""
        content = message.get("content", "")
        if isinstance(content, str):
            return content.strip()
        if isinstance(content, list):
            # Some providers return content blocks like [{"type":"text","text":"..."}].
            parts = [
                block.get("text", "")
                for block in content
                if isinstance(block, dict) and isinstance(block.get("text"), str)
            ]
            return "".join(parts).strip()
        return ""

    @staticmethod
    def _extract_stream_token(chunk: dict) -> str:
        """Extract token text from one stream chunk without brittle indexing."""
        choices = chunk.get("choices")
        if not isinstance(choices, list) or not choices:
            return ""
        first_choice = choices[0]
        if not isinstance(first_choice, dict):
            return ""
        delta = first_choice.get("delta")
        if not isinstance(delta, dict):
            return ""
        content = delta.get("content", "")
        return content if isinstance(content, str) else ""

    async def list_models(self, api_key: str) -> list[dict]:
        """Fetch model catalog for a given API key."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self._base_url}/models",
                headers=self._headers(api_key),
            )
            self._raise_for_status("model listing", response)
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
        body = self._build_chat_body(
            model=model,
            system_prompt=system_prompt,
            user_message=user_message,
            max_tokens=max_tokens,
            temperature=temperature,
            stream=False,
        )
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self._base_url}/chat/completions",
                headers=self._headers(api_key),
                json=body,
            )
            self._raise_for_status("completion", response)
            payload = response.json()
            return self._extract_completion_text(payload)

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
        body = self._build_chat_body(
            model=model,
            system_prompt=system_prompt,
            user_message=user_message,
            max_tokens=max_tokens,
            temperature=temperature,
            stream=True,
        )
        full_response = ""
        async with httpx.AsyncClient(timeout=180.0) as client:
            async with client.stream(
                "POST",
                f"{self._base_url}/chat/completions",
                headers=self._headers(api_key),
                json=body,
            ) as response:
                if response.status_code >= 400:
                    raw_error = await response.aread()
                    detail = self._extract_error_detail(raw_error.decode(errors="replace"))
                    suffix = f": {detail}" if detail else "."
                    raise RuntimeError(f"OpenRouter stream failed ({response.status_code}){suffix}")
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
                    if not isinstance(chunk, dict):
                        continue
                    token = self._extract_stream_token(chunk)
                    if token:
                        full_response += token
                        await on_token(token)
        return full_response.strip()
