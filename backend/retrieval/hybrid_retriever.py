from langchain_community.embeddings import HuggingFaceEmbeddings
from loguru import logger

from config.settings import settings
from ingestion.bm25_indexer import load as load_bm25
from ingestion.pinecone_indexer import _get_index

# k=60 is the empirical smoothing constant from the original RRF paper (Cormack 2009).
# It prevents rank-0 from dominating at score=1/1 and softens differences between
# adjacent ranks — the exact value matters less than keeping it in the 40–80 range.
_K = 60


async def retrieve(query: str, session_id: str) -> list[dict]:
    """
    Hybrid BM25 + Pinecone dense retrieval fused with RRF.

    WHY hybrid: dense (semantic) excels at paraphrase matching; BM25 (lexical)
    excels at exact keyword/entity lookup.  Neither dominates universally, so
    combining both via RRF consistently outperforms either alone.

    WHY RRF instead of score normalisation: individual retriever scores are not
    comparable across systems — BM25 uses TF-IDF weights, Pinecone uses cosine
    similarity.  RRF uses only *rank positions*, which are always comparable.

    alpha = 1  → dense only
    alpha = 0  → BM25 only
    Default alpha=0.7 is dense-heavy because semantic queries dominate in practice,
    but BM25 still contributes 30 % weight to catch exact-match misses.

    Returns top_k_retrieval chunks as dicts with full text from the BM25 pickle.
    """
    bm25, all_chunks = load_bm25(session_id)
    chunk_lookup = {f"{session_id}_{c['chunk_index']}": c for c in all_chunks}

    # ── Dense retrieval ────────────────────────────────────────────────────────
    embed_model = HuggingFaceEmbeddings(model_name=settings.local_embed_model)
    query_vec   = await embed_model.aembed_query(query)
    index      = _get_index()
    dense_resp = index.query(
        vector=query_vec,
        top_k=settings.top_k_retrieval,
        namespace=session_id,
        include_metadata=True,
    )
    # Store rank (0-based position) not score — RRF only uses position
    dense_rank = {m.id: rank for rank, m in enumerate(dense_resp.matches)}
    logger.debug(f"Dense hits: {len(dense_rank)}")

    # ── Sparse retrieval (BM25) ────────────────────────────────────────────────
    bm25_scores   = bm25.get_scores(query.split())
    sparse_indices = sorted(
        range(len(bm25_scores)),
        key=lambda i: -bm25_scores[i],
    )[: settings.top_k_retrieval]
    sparse_rank = {
        f"{session_id}_{all_chunks[i]['chunk_index']}": rank
        for rank, i in enumerate(sparse_indices)
    }
    logger.debug(f"Sparse hits: {len(sparse_rank)}")

    # ── RRF fusion ─────────────────────────────────────────────────────────────
    # score(doc) = Σ weight_i / (k + rank_i)
    # alpha soft-weights dense vs. sparse without hard exclusion of either signal.
    alpha   = settings.hybrid_search_alpha
    all_ids = set(dense_rank) | set(sparse_rank)
    rrf: dict[str, float] = {}
    for id_ in all_ids:
        score = 0.0
        if id_ in dense_rank:
            score += alpha * (1.0 / (_K + dense_rank[id_]))
        if id_ in sparse_rank:
            score += (1 - alpha) * (1.0 / (_K + sparse_rank[id_]))
        rrf[id_] = score

    top_ids = sorted(rrf, key=lambda i: -rrf[i])[: settings.top_k_retrieval]

    # ── Reconstruct full-text chunks ───────────────────────────────────────────
    # Pinecone only stores metadata (chunk_index, page_number), not raw text.
    # Full text lives in the BM25 pickle loaded above — we join on chunk id.
    results: list[dict] = []
    for id_ in top_ids:
        chunk = chunk_lookup.get(id_)
        if chunk:
            results.append({
                "id":          id_,
                "text":        chunk["text"],
                "page_number": chunk["page_number"],
                "chunk_index": chunk["chunk_index"],
                "rrf_score":   rrf[id_],
            })

    return results
