import io
import httpx
import pdfplumber
from pypdf import PdfReader
from loguru import logger


async def download_pdf(url: str) -> bytes:
    """Download PDF from URL using async HTTP. Raises on non-200 or non-PDF content."""
    async with httpx.AsyncClient(follow_redirects=True, timeout=60) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.content


def parse_pdf(pdf_bytes: bytes, source_url: str, session_id: str) -> list[dict]:
    """
    Parse PDF with pdfplumber (layout-aware); fall back to pypdf per page.
    Returns list of {page_number, text, source_url, session_id}.
    Empty pages are excluded.
    """
    pages = []
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for i, page in enumerate(pdf.pages):
                text = page.extract_text() or ""
                if not text.strip():
                    text = _pypdf_single_page(pdf_bytes, i)
                pages.append({
                    "page_number": i + 1,
                    "text": text,
                    "source_url": source_url,
                    "session_id": session_id,
                })
    except Exception as exc:
        logger.warning(f"pdfplumber failed ({exc}), falling back to full pypdf parse")
        pages = _pypdf_all_pages(pdf_bytes, source_url, session_id)

    return [p for p in pages if p["text"].strip()]


def _pypdf_single_page(pdf_bytes: bytes, page_index: int) -> str:
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        return reader.pages[page_index].extract_text() or ""
    except Exception:
        return ""


def _pypdf_all_pages(pdf_bytes: bytes, source_url: str, session_id: str) -> list[dict]:
    pages = []
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        for i, page in enumerate(reader.pages):
            pages.append({
                "page_number": i + 1,
                "text": page.extract_text() or "",
                "source_url": source_url,
                "session_id": session_id,
            })
    except Exception as exc:
        logger.error(f"pypdf fallback also failed: {exc}")
    return pages
