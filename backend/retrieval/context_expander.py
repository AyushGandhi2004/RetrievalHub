from ingestion.bm25_indexer import load as load_bm25


async def expand(chunks: list[dict], session_id: str) -> list[dict]:
    """
    For each chunk, prepend/append its adjacent neighbors (chunk_index ± 1)
    to reduce hard boundary cuts.  Returns new dicts — originals are not mutated.
    """
    _, all_chunks = load_bm25(session_id)
    by_index = {c["chunk_index"]: c for c in all_chunks}

    expanded: list[dict] = []
    for chunk in chunks:
        idx   = chunk["chunk_index"]
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
