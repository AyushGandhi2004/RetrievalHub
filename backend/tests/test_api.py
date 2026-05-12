"""
API integration tests using httpx.AsyncClient + ASGITransport.

All tests run against the real FastAPI app in-process.
External services (Pinecone, Groq, Uploadthing) are patched so tests
run without real API keys or network access.
"""
import json
import os
import tempfile
import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock, patch


# ──────────────────────────────────────────────────────────────────────────────
# App fixture — import after sys.path is set by conftest.py
# ──────────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def app():
    from main import app as fastapi_app
    return fastapi_app


@pytest_asyncio.fixture
async def client(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


# ──────────────────────────────────────────────────────────────────────────────
# Health endpoint
# ──────────────────────────────────────────────────────────────────────────────

class TestHealth:
    @pytest.mark.asyncio
    async def test_health_returns_200(self, client):
        resp = await client.get("/health")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_health_body_has_status_ok(self, client):
        resp = await client.get("/health")
        assert resp.json()["status"] == "ok"


# ──────────────────────────────────────────────────────────────────────────────
# UUID4 validation — all routes reject bad session IDs
# ──────────────────────────────────────────────────────────────────────────────

_BAD_IDS = [
    "not-a-uuid",
    "12345678-1234-1234-1234-12345678901",   # too short
    "00000000-0000-0000-0000-000000000000",  # UUID nil (version=0)
    "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",  # non-hex
]


class TestUUIDValidation:
    @pytest.mark.asyncio
    @pytest.mark.parametrize("bad_id", _BAD_IDS)
    async def test_get_meta_rejects_bad_session_id(self, client, bad_id):
        resp = await client.get(f"/session/{bad_id}/meta")
        assert resp.status_code in (422, 404)

    @pytest.mark.asyncio
    @pytest.mark.parametrize("bad_id", _BAD_IDS)
    async def test_delete_rejects_bad_session_id(self, client, bad_id):
        resp = await client.delete(f"/session/{bad_id}")
        assert resp.status_code in (422, 404)

    @pytest.mark.asyncio
    async def test_ingest_rejects_bad_session_id(self, client):
        payload = {
            "file_url":   "https://example.com/doc.pdf",
            "file_key":   None,
            "session_id": "not-valid",
        }
        resp = await client.post("/ingest", json=payload)
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_query_rag_rejects_bad_session_id(self, client):
        payload = {"question": "hello", "session_id": "not-valid"}
        resp = await client.post("/query/rag", json=payload)
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_query_vectorless_rejects_bad_session_id(self, client):
        payload = {"question": "hello", "session_id": "not-valid"}
        resp = await client.post("/query/vectorless", json=payload)
        assert resp.status_code == 422


# ──────────────────────────────────────────────────────────────────────────────
# 404 for nonexistent sessions
# ──────────────────────────────────────────────────────────────────────────────

class TestNotFound:
    @pytest.mark.asyncio
    async def test_get_meta_404_for_unknown_session(self, client):
        sid = str(uuid.uuid4())
        resp = await client.get(f"/session/{sid}/meta")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_get_tree_404_for_unknown_session(self, client):
        sid = str(uuid.uuid4())
        resp = await client.get(f"/tree/{sid}")
        assert resp.status_code == 404


# ──────────────────────────────────────────────────────────────────────────────
# GET /session/{id}/meta — reads from real temp directory
# ──────────────────────────────────────────────────────────────────────────────

class TestSessionMeta:
    @pytest.mark.asyncio
    async def test_returns_meta_json_when_session_exists(self, client):
        sid = str(uuid.uuid4())
        meta = {
            "session_id": sid,
            "file_url": "https://example.com/test.pdf",
            "file_key": "key_123",
            "file_name": "test.pdf",
        }
        with tempfile.TemporaryDirectory() as tmp:
            session_dir = os.path.join(tmp, sid)
            os.makedirs(session_dir)
            with open(os.path.join(session_dir, "meta.json"), "w") as f:
                json.dump(meta, f)

            with patch("config.settings.settings.session_storage_path", tmp):
                resp = await client.get(f"/session/{sid}/meta")

        assert resp.status_code == 200
        body = resp.json()
        assert body["session_id"] == sid
        assert body["file_name"] == "test.pdf"


# ──────────────────────────────────────────────────────────────────────────────
# DELETE /session/{id} — idempotent behaviour
# ──────────────────────────────────────────────────────────────────────────────

class TestDeleteSession:
    @pytest.mark.asyncio
    async def test_delete_returns_200_even_when_session_missing(self, client):
        """
        Render restarts wipe ephemeral storage, so delete must be idempotent —
        the frontend calls delete regardless of whether the session still exists.
        """
        sid = str(uuid.uuid4())
        with (
            patch("api.routes.session.delete_file", new_callable=AsyncMock),
            patch("api.routes.session.Pinecone", autospec=True),
        ):
            resp = await client.delete(f"/session/{sid}")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_delete_response_contains_session_id(self, client):
        sid = str(uuid.uuid4())
        with (
            patch("api.routes.session.delete_file", new_callable=AsyncMock),
            patch("api.routes.session.Pinecone", autospec=True),
        ):
            resp = await client.delete(f"/session/{sid}")
        body = resp.json()
        assert body["session_id"] == sid
        assert body["status"] == "deleted"

    @pytest.mark.asyncio
    async def test_delete_cleans_up_session_directory(self, client):
        sid = str(uuid.uuid4())
        with tempfile.TemporaryDirectory() as tmp:
            session_dir = os.path.join(tmp, sid)
            os.makedirs(session_dir)
            meta = {"session_id": sid, "file_key": None}
            with open(os.path.join(session_dir, "meta.json"), "w") as f:
                json.dump(meta, f)

            with (
                patch("config.settings.settings.session_storage_path", tmp),
                patch("api.routes.session.delete_file", new_callable=AsyncMock),
                patch("api.routes.session.Pinecone", autospec=True),
            ):
                resp = await client.delete(f"/session/{sid}")

            assert resp.status_code == 200
            assert not os.path.exists(session_dir)
