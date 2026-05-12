import os
import pickle
from rank_bm25 import BM25Okapi
from config.settings import settings
from loguru import logger


def build_and_save(chunks: list[dict], session_id: str) -> str:
    """
    Build BM25Okapi from chunk texts and pickle to sessions/{id}/bm25.pkl.
    Saves both the index and the full chunk list for retrieval.
    Returns the pickle path.
    """
    texts     = [c["text"] for c in chunks]
    tokenized = [t.split() for t in texts]
    bm25      = BM25Okapi(tokenized)

    path = os.path.join(settings.session_storage_path, session_id, "bm25.pkl")
    with open(path, "wb") as f:
        pickle.dump({"bm25": bm25, "chunks": chunks}, f)

    logger.info(f"BM25 index saved → {path}")
    return path


def load(session_id: str) -> tuple:
    """Load and return (bm25, chunks) for a session. Raises FileNotFoundError if absent."""
    path = os.path.join(settings.session_storage_path, session_id, "bm25.pkl")
    with open(path, "rb") as f:
        data = pickle.load(f)
    return data["bm25"], data["chunks"]
