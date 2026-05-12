import asyncio
import os
import json
import aiofiles
from config.settings import settings


class SessionManager:
    """Singleton — manages per-session state: metadata, SSE queues."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._queues: dict[str, asyncio.Queue] = {}
        return cls._instance

    # ── Session directory ─────────────────────────────────────────────────────

    def session_dir(self, session_id: str) -> str:
        path = os.path.join(settings.session_storage_path, session_id)
        os.makedirs(path, exist_ok=True)
        return path

    # ── Metadata ──────────────────────────────────────────────────────────────

    async def write_meta(self, session_id: str, meta: dict) -> None:
        path = os.path.join(self.session_dir(session_id), "meta.json")
        async with aiofiles.open(path, "w") as f:
            await f.write(json.dumps(meta, default=str))

    async def read_meta(self, session_id: str) -> dict:
        path = os.path.join(settings.session_storage_path, session_id, "meta.json")
        async with aiofiles.open(path) as f:
            return json.loads(await f.read())

    # ── SSE event queues ──────────────────────────────────────────────────────

    def create_queue(self, session_id: str) -> asyncio.Queue:
        """Create (or replace) the ingestion event queue for a session."""
        q = asyncio.Queue()
        self._queues[session_id] = q
        return q

    def get_queue(self, session_id: str) -> asyncio.Queue | None:
        return self._queues.get(session_id)

    def delete_queue(self, session_id: str) -> None:
        self._queues.pop(session_id, None)


session_manager = SessionManager()
