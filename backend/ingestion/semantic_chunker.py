from langchain_experimental.text_splitter import SemanticChunker
from langchain_community.embeddings import HuggingFaceEmbeddings
from config.settings import settings
from loguru import logger

_embeddings: HuggingFaceEmbeddings | None = None
_chunker:    SemanticChunker | None = None


def _get_chunker() -> tuple[SemanticChunker, HuggingFaceEmbeddings]:
    global _embeddings, _chunker
    if _chunker is None:
        _embeddings = HuggingFaceEmbeddings(model_name=settings.local_embed_model)
        _chunker = SemanticChunker(
            _embeddings,
            breakpoint_threshold_type=settings.semantic_breakpoint_type,
            breakpoint_threshold_amount=settings.semantic_breakpoint_threshold,
        )
        logger.info(f"SemanticChunker initialised with local model: {settings.local_embed_model}")
    return _chunker, _embeddings


def chunk_pages(pages: list[dict]) -> list[dict]:
    """
    Semantically chunk all page texts as a single document.
    Maps each chunk back to an approximate page number using character offsets.
    Returns list of chunk dicts: {chunk_index, page_number, char_start, text, session_id, source_url}.
    """
    if not pages:
        return []

    chunker, _ = _get_chunker()
    session_id = pages[0]["session_id"]
    source_url = pages[0]["source_url"]

    # Build offset → page_number map
    page_ranges: list[tuple[int, int, int]] = []
    parts: list[str] = []
    offset = 0
    for p in pages:
        text = p["text"]
        page_ranges.append((offset, offset + len(text), p["page_number"]))
        parts.append(text)
        offset += len(text) + 1  # +1 for the "\n" separator

    full_text = "\n".join(parts)

    def page_for_offset(char: int) -> int:
        for start, end, pnum in page_ranges:
            if start <= char < end:
                return pnum
        return page_ranges[-1][2]

    docs = chunker.create_documents([full_text])
    logger.info(f"SemanticChunker produced {len(docs)} chunks from {len(pages)} pages")

    chunks: list[dict] = []
    search_from = 0
    for i, doc in enumerate(docs):
        idx = full_text.find(doc.page_content, search_from)
        char_start = idx if idx >= 0 else search_from
        search_from = char_start + len(doc.page_content)

        chunks.append({
            "chunk_index": i,
            "page_number": page_for_offset(char_start),
            "char_start":  char_start,
            "text":        doc.page_content,
            "session_id":  session_id,
            "source_url":  source_url,
        })

    return chunks
