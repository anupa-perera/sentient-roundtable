import asyncio
import time


class EphemeralKeyStore:
    """In-memory API key store scoped to this process only."""

    def __init__(self, ttl_seconds: int) -> None:
        self._ttl_seconds = ttl_seconds
        self._keys: dict[str, tuple[str, float]] = {}
        self._lock = asyncio.Lock()

    async def set_key(self, session_id: str, api_key: str) -> None:
        """Store key in memory with a TTL-bound expiry timestamp."""
        expires_at = time.time() + self._ttl_seconds
        async with self._lock:
            self._keys[session_id] = (api_key, expires_at)

    async def get_key(self, session_id: str) -> str | None:
        """Return key if still valid, otherwise purge and return None."""
        async with self._lock:
            value = self._keys.get(session_id)
            if value is None:
                return None
            api_key, expires_at = value
            if expires_at < time.time():
                self._keys.pop(session_id, None)
                return None
            return api_key

    async def delete_key(self, session_id: str) -> None:
        """Delete key for a session."""
        async with self._lock:
            self._keys.pop(session_id, None)

    async def cleanup_expired(self) -> None:
        """Clean stale keys in bulk (optional maintenance method)."""
        now = time.time()
        async with self._lock:
            expired = [session_id for session_id, (_, expires) in self._keys.items() if expires < now]
            for session_id in expired:
                self._keys.pop(session_id, None)
