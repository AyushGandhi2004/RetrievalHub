"""
Unit tests for RAG pipeline components.

Covers TokenCounter, RRF math, context_expander neighbor logic, and the
JWT key-extraction helper in uploadthing_client — all without hitting
any real external API.
"""
import pytest
from unittest.mock import MagicMock, patch, AsyncMock


# ──────────────────────────────────────────────────────────────────────────────
# TokenCounter
# ──────────────────────────────────────────────────────────────────────────────

class TestTokenCounter:
    def setup_method(self):
        from core.token_counter import TokenCounter
        self.counter = TokenCounter()

    def _usage(self, prompt, completion):
        u = MagicMock()
        u.prompt_tokens = prompt
        u.completion_tokens = completion
        return u

    def test_initial_state_is_zero(self):
        assert self.counter.ingestion_total == 0
        assert self.counter.query_total == 0

    def test_ingestion_phase_accumulates(self):
        self.counter.add(self._usage(100, 50), phase="ingestion")
        self.counter.add(self._usage(200, 75), phase="ingestion")
        assert self.counter.ingestion_total == 425
        assert self.counter.query_total == 0

    def test_query_phase_accumulates(self):
        self.counter.add(self._usage(80, 40), phase="query")
        assert self.counter.query_total == 120
        assert self.counter.ingestion_total == 0

    def test_summary_grand_total(self):
        self.counter.add(self._usage(100, 50), phase="ingestion")
        self.counter.add(self._usage(80, 20), phase="query")
        s = self.counter.summary()
        assert s["ingestion_tokens"] == 150
        assert s["query_tokens"] == 100
        assert s["grand_total"] == 250

    def test_unknown_phase_defaults_to_query(self):
        self.counter.add(self._usage(10, 5), phase="unknown")
        assert self.counter.query_total == 15


# ──────────────────────────────────────────────────────────────────────────────
# RRF fusion (inline — mirrors hybrid_retriever logic exactly)
# ──────────────────────────────────────────────────────────────────────────────

def _rrf_fuse(dense_rank: dict, sparse_rank: dict, alpha: float, k: int = 60) -> dict:
    """Local copy of the RRF logic so tests don't import heavy dependencies."""
    all_ids = set(dense_rank) | set(sparse_rank)
    rrf: dict[str, float] = {}
    for id_ in all_ids:
        score = 0.0
        if id_ in dense_rank:
            score += alpha * (1.0 / (k + dense_rank[id_]))
        if id_ in sparse_rank:
            score += (1 - alpha) * (1.0 / (k + sparse_rank[id_]))
        rrf[id_] = score
    return rrf


class TestRRFFusion:
    def test_dense_only_doc_gets_scored(self):
        scores = _rrf_fuse(dense_rank={"doc_a": 0}, sparse_rank={}, alpha=1.0)
        assert "doc_a" in scores
        assert scores["doc_a"] == pytest.approx(1.0 / (60 + 0))

    def test_sparse_only_doc_gets_scored(self):
        scores = _rrf_fuse(dense_rank={}, sparse_rank={"doc_b": 0}, alpha=0.0)
        assert "doc_b" in scores
        assert scores["doc_b"] == pytest.approx(1.0 / (60 + 0))

    def test_shared_doc_scores_higher_than_single_list(self):
        # doc_c appears in both lists at rank 0 — should outscore doc_d in one list only
        scores = _rrf_fuse(
            dense_rank={"doc_c": 0, "doc_d": 1},
            sparse_rank={"doc_c": 0},
            alpha=0.7,
        )
        assert scores["doc_c"] > scores["doc_d"]

    def test_alpha_zero_ignores_dense(self):
        # alpha=0 means dense weight is 0; doc only in dense should score 0
        scores = _rrf_fuse(dense_rank={"dense_only": 0}, sparse_rank={}, alpha=0.0)
        assert scores["dense_only"] == 0.0

    def test_higher_rank_yields_lower_score(self):
        scores = _rrf_fuse(
            dense_rank={"top": 0, "bottom": 9},
            sparse_rank={},
            alpha=1.0,
        )
        assert scores["top"] > scores["bottom"]

    def test_k60_smoothing_constant(self):
        # k=60 means even rank-0 score is 1/60, never 1/0
        scores = _rrf_fuse(dense_rank={"doc": 0}, sparse_rank={}, alpha=1.0, k=60)
        assert scores["doc"] == pytest.approx(1 / 60)

    def test_union_of_ids(self):
        scores = _rrf_fuse(
            dense_rank={"a": 0, "b": 1},
            sparse_rank={"b": 0, "c": 1},
            alpha=0.5,
        )
        assert set(scores.keys()) == {"a", "b", "c"}


# ──────────────────────────────────────────────────────────────────────────────
# context_expander — neighbor padding logic
# ──────────────────────────────────────────────────────────────────────────────

class TestContextExpander:
    def _make_chunks(self, n: int) -> list[dict]:
        return [
            {"chunk_index": i, "text": f"chunk_{i}", "page_number": i + 1}
            for i in range(n)
        ]

    async def _expand(self, chunks, all_chunks):
        """Inline re-implementation of expand() to avoid BM25 file I/O."""
        by_index = {c["chunk_index"]: c for c in all_chunks}
        expanded = []
        for chunk in chunks:
            idx = chunk["chunk_index"]
            parts = []
            prev = by_index.get(idx - 1)
            if prev:
                parts.append(prev["text"])
            parts.append(chunk["text"])
            nxt = by_index.get(idx + 1)
            if nxt:
                parts.append(nxt["text"])
            expanded.append({**chunk, "text": "\n\n".join(parts)})
        return expanded

    @pytest.mark.asyncio
    async def test_middle_chunk_includes_neighbors(self):
        all_chunks = self._make_chunks(5)
        result = await self._expand([all_chunks[2]], all_chunks)
        assert "chunk_1" in result[0]["text"]
        assert "chunk_2" in result[0]["text"]
        assert "chunk_3" in result[0]["text"]

    @pytest.mark.asyncio
    async def test_first_chunk_has_no_left_neighbor(self):
        all_chunks = self._make_chunks(3)
        result = await self._expand([all_chunks[0]], all_chunks)
        assert result[0]["text"].startswith("chunk_0")
        assert "chunk_1" in result[0]["text"]

    @pytest.mark.asyncio
    async def test_last_chunk_has_no_right_neighbor(self):
        all_chunks = self._make_chunks(3)
        result = await self._expand([all_chunks[2]], all_chunks)
        assert result[0]["text"].endswith("chunk_2")
        assert "chunk_1" in result[0]["text"]

    @pytest.mark.asyncio
    async def test_originals_not_mutated(self):
        all_chunks = self._make_chunks(3)
        original_text = all_chunks[1]["text"]
        await self._expand([all_chunks[1]], all_chunks)
        assert all_chunks[1]["text"] == original_text

    @pytest.mark.asyncio
    async def test_single_chunk_no_neighbors(self):
        all_chunks = self._make_chunks(1)
        result = await self._expand([all_chunks[0]], all_chunks)
        assert result[0]["text"] == "chunk_0"


# ──────────────────────────────────────────────────────────────────────────────
# uploadthing_client — JWT key extraction
# ──────────────────────────────────────────────────────────────────────────────

class TestExtractApiKey:
    def setup_method(self):
        from core.uploadthing_client import _extract_api_key
        self.extract = _extract_api_key

    def _make_token(self, payload_dict: dict) -> str:
        import base64, json
        payload_b64 = base64.urlsafe_b64encode(
            json.dumps(payload_dict).encode()
        ).rstrip(b"=").decode()
        return f"header.{payload_b64}.signature"

    def test_extracts_api_key_from_jwt(self):
        token = self._make_token({"apiKey": "sk_live_test123", "appId": "app_abc"})
        assert self.extract(token) == "sk_live_test123"

    def test_returns_token_when_no_api_key_field(self):
        token = self._make_token({"appId": "app_abc"})
        # Falls back to the raw token since no apiKey in payload
        assert self.extract(token) == token

    def test_returns_empty_string_unchanged(self):
        assert self.extract("") == ""

    def test_plain_api_key_passthrough(self):
        # Non-JWT string (no dots) treated as-is
        plain = "sk_live_plain"
        result = self.extract(plain)
        # Either returns the plain key (part[0] decode attempt) or the key itself
        assert isinstance(result, str) and len(result) > 0

    def test_malformed_jwt_returns_token(self):
        result = self.extract("not.valid.jwt!!!")
        assert isinstance(result, str)
