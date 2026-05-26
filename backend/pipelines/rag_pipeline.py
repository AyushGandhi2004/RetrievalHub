import json
import time
from typing import AsyncGenerator

from groq import AsyncGroq
from loguru import logger

from config.settings import settings
from pipelines.rag_prompt import ANSWER_PROMPT, build_context
from retrieval.hybrid_retriever import retrieve
from retrieval.reranker import rerank
from retrieval.context_expander import expand

_INSUFFICIENT_CONTEXT_REPLY = "Retrieved data is not enough to answer this question."


class RAGPipeline:
    def __init__(self):
        self._client = AsyncGroq(api_key=settings.groq_api_key)

    async def run(
        self, question: str, session_id: str
    ) -> AsyncGenerator[str, None]:
        """
        Async generator — yields raw SSE data strings ready to forward to the client.
        Event sequence: sources → token* → usage → done
        """
        t_start = time.monotonic()

        # ── Retrieval ──────────────────────────────────────────────────────────
        candidates = await retrieve(question, session_id)
        reranked   = await rerank(question, candidates)
        expanded   = await expand(reranked, session_id)

        retrieval_ms = int((time.monotonic() - t_start) * 1000)
        logger.debug(
            f"RAG retrieval [{session_id}]: {len(candidates)} candidates → "
            f"{len(reranked)} reranked, {retrieval_ms}ms"
        )

        # ── Sources event ──────────────────────────────────────────────────────
        sources_payload = [
            {
                "text":         c["text"][:500],   # display excerpt only
                "page_number":  c["page_number"],
                "chunk_index":  c["chunk_index"],
                "rerank_score": round(c.get("rerank_score", 0.0), 4),
            }
            for c in reranked
        ]
        yield f"data: {json.dumps({'type': 'sources', 'chunks': sources_payload})}\n\n"

        # ── Build context + prompt ─────────────────────────────────────────────
        context = build_context(expanded, question)
        if not context.strip():
            yield f"data: {json.dumps({'type': 'token', 'content': _INSUFFICIENT_CONTEXT_REPLY})}\n\n"
            yield f"data: {json.dumps({'type': 'usage', 'prompt_tokens': 0, 'completion_tokens': 0, 'total_tokens': 0, 'retrieval_ms': retrieval_ms})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            return

        prompt   = ANSWER_PROMPT.format(context=context, question=question)
        messages = [{"role": "user", "content": prompt}]

        # ── Streaming generation ───────────────────────────────────────────────
        prompt_tokens     = 0
        completion_tokens = 0

        stream = await self._client.chat.completions.create(
            model=settings.groq_model,
            temperature=settings.groq_temperature,
            max_tokens=settings.groq_max_tokens,
            messages=messages,
            stream=True,
        )

        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield f"data: {json.dumps({'type': 'token', 'content': chunk.choices[0].delta.content})}\n\n"
            if chunk.usage:
                prompt_tokens     = chunk.usage.prompt_tokens
                completion_tokens = chunk.usage.completion_tokens

        # ── Usage event ────────────────────────────────────────────────────────
        yield f"data: {json.dumps({'type': 'usage', 'prompt_tokens': prompt_tokens, 'completion_tokens': completion_tokens, 'total_tokens': prompt_tokens + completion_tokens, 'retrieval_ms': retrieval_ms})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
