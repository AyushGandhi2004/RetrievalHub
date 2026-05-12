import json
import time
from typing import AsyncGenerator

from groq import AsyncGroq
from loguru import logger

from config.settings import settings
from retrieval.hybrid_retriever import retrieve
from retrieval.reranker import rerank
from retrieval.context_expander import expand

_ANSWER_PROMPT = """You are a precise document analyst.
Answer the question using ONLY the provided context sections.
If the context is insufficient, state that explicitly.
When helpful, cite the page number (e.g. "As stated on page 4...").

Context:
{context}

Question: {question}

Answer:"""


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
        context = "\n\n---\n\n".join(
            f"[Page {c['page_number']}]\n{c['text']}" for c in expanded
        )
        prompt   = _ANSWER_PROMPT.format(context=context, question=question)
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
