from pinecone import Pinecone, ServerlessSpec
from langchain_community.embeddings import HuggingFaceEmbeddings
from config.settings import settings
from loguru import logger
from typing import Callable, Awaitable

_pc:    Pinecone | None = None
_index = None


def _get_index():
    global _pc, _index
    if _index is None:
        _pc = Pinecone(api_key=settings.pinecone_api_key)

        existing_names = [idx.name for idx in _pc.list_indexes().indexes]
        if settings.pinecone_index_name not in existing_names:
            logger.info(f"Creating Pinecone index '{settings.pinecone_index_name}'…")
            _pc.create_index(
                name=settings.pinecone_index_name,
                dimension=settings.local_embed_dim,
                metric="cosine",
                spec=ServerlessSpec(
                    cloud=settings.pinecone_cloud,
                    region=settings.pinecone_region,
                ),
            )
            logger.info("Pinecone index created")
        else:
            idx_info = _pc.describe_index(settings.pinecone_index_name)
            if idx_info.dimension != settings.local_embed_dim:
                raise RuntimeError(
                    f"Pinecone index '{settings.pinecone_index_name}' has dimension "
                    f"{idx_info.dimension} but the local embed model produces "
                    f"{settings.local_embed_dim}-dim vectors. "
                    f"Delete the index at https://app.pinecone.io and restart — "
                    f"it will be recreated automatically with the correct dimension."
                )
            logger.info(f"Pinecone index '{settings.pinecone_index_name}' already exists")

        _index = _pc.Index(settings.pinecone_index_name)
    return _index


async def upsert_chunks(
    chunks: list[dict],
    session_id: str,
    on_progress: Callable[[int, int], Awaitable[None]] | None = None,
) -> int:
    """
    Embed chunks with local SentenceTransformer model (100 per batch) and upsert into Pinecone namespace=session_id.
    Calls on_progress(done_so_far, total) after each batch.
    Returns total vectors upserted.
    """
    index = _get_index()
    embeddings_model = HuggingFaceEmbeddings(model_name=settings.local_embed_model)

    texts      = [c["text"] for c in chunks]
    batch_size = 100
    total      = len(texts)
    done       = 0

    for i in range(0, total, batch_size):
        batch_texts  = texts[i : i + batch_size]
        batch_chunks = chunks[i : i + batch_size]

        vectors = await embeddings_model.aembed_documents(batch_texts)

        records = [
            {
                "id":     f"{session_id}_{c['chunk_index']}",
                "values": vec,
                "metadata": {
                    "page_number": c["page_number"],
                    "chunk_index": c["chunk_index"],
                    "text":        c["text"][:1000],
                    "session_id":  session_id,
                },
            }
            for vec, c in zip(vectors, batch_chunks)
        ]

        index.upsert(vectors=records, namespace=session_id)
        done += len(records)
        logger.info(f"Pinecone upsert batch {i // batch_size + 1}: {done}/{total}")

        if on_progress:
            await on_progress(done, total)

    return done
