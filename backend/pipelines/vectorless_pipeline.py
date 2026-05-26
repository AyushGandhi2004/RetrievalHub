import json
import time
import aiofiles
from pathlib import Path
from typing import AsyncGenerator

from groq import AsyncGroq
from loguru import logger

from config.settings import settings
from pipelines.rag_prompt import ANSWER_PROMPT
from retrieval.tree_traversal import traverse

_INSUFFICIENT_CONTEXT_REPLY = "Retrieved data is not enough to answer this question."


class VectorlessPipeline:
    def __init__(self):
        self._client = AsyncGroq(api_key=settings.groq_api_key)

    async def run(
        self, question: str, session_id: str
    ) -> AsyncGenerator[str, None]:
        """
        Async generator — yields raw SSE data strings ready to forward to the client.
        Event sequence: path → token* → usage → done
        """
        t_start = time.monotonic()

        # ── Tree traversal ─────────────────────────────────────────────────────
        result           = await traverse(question, session_id)
        context          = result["context"]
        node_ids         = result["node_ids"]
        node_summaries   = result["node_summaries"]
        traversal_tokens = result["traversal_tokens"]

        retrieval_ms = int((time.monotonic() - t_start) * 1000)

        # ── Ingestion tokens from meta.json ────────────────────────────────────
        ingestion_tokens = 0
        meta_path = Path(settings.session_storage_path) / session_id / "meta.json"
        try:
            async with aiofiles.open(meta_path, "r", encoding="utf-8") as f:
                meta = json.loads(await f.read())
            ingestion_tokens = meta.get("vectorless_ingestion_tokens", 0)
        except Exception as exc:
            logger.warning(f"Could not read meta.json for session {session_id}: {exc}")

        # ── Path event (also triggers tree highlight on frontend) ──────────────
        yield (
            f"data: {json.dumps({'type': 'path', 'node_ids': node_ids, 'node_summaries': node_summaries})}\n\n"
        )

        # ── Build generation prompt ────────────────────────────────────────────
        if not context.strip():
            yield f"data: {json.dumps({'type': 'token', 'content': _INSUFFICIENT_CONTEXT_REPLY})}\n\n"

            total_query_tokens = traversal_tokens
            grand_total_tokens = ingestion_tokens + total_query_tokens
            yield (
                f"data: {json.dumps({'type': 'usage', 'traversal_tokens': traversal_tokens, 'generation_prompt_tokens': 0, 'generation_completion_tokens': 0, 'total_query_tokens': total_query_tokens, 'total_tokens': total_query_tokens, 'prompt_tokens': 0, 'completion_tokens': 0, 'ingestion_tokens': ingestion_tokens, 'grand_total_tokens': grand_total_tokens, 'retrieval_ms': retrieval_ms})}\n\n"
            )
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            return

        prompt   = ANSWER_PROMPT.format(context=context, question=question)
        messages = [{"role": "user", "content": prompt}]

        # ── Streaming generation ───────────────────────────────────────────────
        generation_prompt_tokens     = 0
        generation_completion_tokens = 0

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
                generation_prompt_tokens     = chunk.usage.prompt_tokens
                generation_completion_tokens = chunk.usage.completion_tokens

        # ── Usage event ────────────────────────────────────────────────────────
        total_query_tokens = (
            traversal_tokens
            + generation_prompt_tokens
            + generation_completion_tokens
        )
        grand_total_tokens = ingestion_tokens + total_query_tokens

        logger.debug(
            f"Vectorless usage [{session_id}]: traversal={traversal_tokens}, "
            f"gen_prompt={generation_prompt_tokens}, gen_completion={generation_completion_tokens}, "
            f"total_query={total_query_tokens}, ingestion={ingestion_tokens}, "
            f"grand_total={grand_total_tokens}, retrieval_ms={retrieval_ms}"
        )

        yield (
            f"data: {json.dumps({'type': 'usage', 'traversal_tokens': traversal_tokens, 'generation_prompt_tokens': generation_prompt_tokens, 'generation_completion_tokens': generation_completion_tokens, 'total_query_tokens': total_query_tokens, 'total_tokens': total_query_tokens, 'prompt_tokens': generation_prompt_tokens, 'completion_tokens': generation_completion_tokens, 'ingestion_tokens': ingestion_tokens, 'grand_total_tokens': grand_total_tokens, 'retrieval_ms': retrieval_ms})}\n\n"
        )
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
