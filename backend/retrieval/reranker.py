import asyncio
from functools import lru_cache

from sentence_transformers import CrossEncoder
from loguru import logger

from config.settings import settings

_MODEL_NAME = "cross-encoder/ms-marco-MiniLM-L-6-v2"


@lru_cache(maxsize=1)
def _get_model() -> CrossEncoder:
    logger.info(f"Loading cross-encoder: {_MODEL_NAME}")
    return CrossEncoder(_MODEL_NAME)


async def rerank(query: str, chunks: list[dict]) -> list[dict]:
    """
    Score each (query, chunk_text) pair with the cross-encoder.
    Returns top_k_after_rerank chunks sorted by score, with 'rerank_score' added.
    Runs the synchronous model.predict in a thread-pool executor to stay non-blocking.
    """
    if not chunks:
        return []

    model = _get_model()
    pairs = [[query, c["text"]] for c in chunks]

    loop   = asyncio.get_event_loop()
    scores = await loop.run_in_executor(None, model.predict, pairs)

    for chunk, score in zip(chunks, scores):
        chunk["rerank_score"] = float(score)

    ranked = sorted(chunks, key=lambda c: -c["rerank_score"])
    return ranked[: settings.top_k_after_rerank]
