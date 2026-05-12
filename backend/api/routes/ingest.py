import asyncio
import json
import time
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from loguru import logger

from api.schemas import IngestRequest, IngestResponse
from core.session_manager import session_manager
from core.uploadthing_client import delete_file
from ingestion import pdf_parser, semantic_chunker, pinecone_indexer, bm25_indexer, tree_builder

router = APIRouter(prefix="/ingest", tags=["ingest"])


# ── Pipeline tasks ────────────────────────────────────────────────────────────

async def _rag_pipeline(session_id: str, file_url: str, q: asyncio.Queue) -> None:
    start = time.monotonic()

    async def emit(step: str, progress: float, message: str, **meta):
        await q.put({
            "pipeline": "rag",
            "step":     step,
            "progress": progress,
            "message":  message,
            "meta":     {"elapsed_ms": int((time.monotonic() - start) * 1000), **meta},
        })

    try:
        # Step 1 — Download + Parse
        await emit("parsing", 0.05, "Downloading PDF…")
        pdf_bytes  = await pdf_parser.download_pdf(file_url)
        pages      = pdf_parser.parse_pdf(pdf_bytes, file_url, session_id)
        page_count = len(pages)
        await emit("parsing", 0.20, f"Parsed {page_count} pages", page_count=page_count)

        # Step 2 — Semantic Chunking
        await emit("chunking", 0.25, "Running semantic chunker…")
        chunks      = semantic_chunker.chunk_pages(pages)
        chunk_count = len(chunks)
        await emit("chunking", 0.45, f"Created {chunk_count} chunks", chunk_count=chunk_count)

        # Step 3 — BM25 Index
        bm25_indexer.build_and_save(chunks, session_id)

        # Step 4 — Local Embed + Pinecone Upsert
        await emit("embedding", 0.50, "Generating embeddings…")

        async def on_embed_progress(done_count: int, total: int):
            pct = 0.50 + (done_count / total) * 0.45
            await emit("indexing", pct, f"Indexed {done_count}/{total} chunks…", chunk_count=done_count)

        await pinecone_indexer.upsert_chunks(chunks, session_id, on_embed_progress)

        # Persist final metadata
        meta = await session_manager.read_meta(session_id)
        meta.update({"chunk_count": chunk_count, "page_count": page_count, "status": "ready"})
        await session_manager.write_meta(session_id, meta)

        await emit("done", 1.0, f"RAG complete — {chunk_count} chunks in Pinecone",
                   chunk_count=chunk_count, page_count=page_count)

    except Exception as exc:
        logger.error(f"RAG ingestion failed [{session_id}]: {exc}")
        await q.put({
            "pipeline": "rag", "step": "error", "progress": 0.0,
            "message":  str(exc),
            "meta":     {"elapsed_ms": int((time.monotonic() - start) * 1000)},
        })


async def _vectorless_pipeline(session_id: str, file_url: str, q: asyncio.Queue) -> None:
    start = time.monotonic()

    async def emit(step: str, progress: float, message: str, **meta):
        await q.put({
            "pipeline": "vectorless",
            "step":     step,
            "progress": progress,
            "message":  message,
            "meta":     {"elapsed_ms": int((time.monotonic() - start) * 1000), **meta},
        })

    try:
        # Step 1 — Download + Parse
        await emit("parsing", 0.05, "Downloading PDF…")
        pdf_bytes  = await pdf_parser.download_pdf(file_url)
        pages      = pdf_parser.parse_pdf(pdf_bytes, file_url, session_id)
        page_count = len(pages)
        await emit("parsing", 0.15, f"Parsed {page_count} pages", page_count=page_count)

        # Step 2 — Build hierarchical summary tree
        await emit("tree_building", 0.20, "Building hierarchical summary tree…")

        async def on_tree_progress(step: str, progress: float, message: str, **meta):
            await emit(step, progress, message, **meta)

        ingestion_tokens = await tree_builder.build_tree(pages, session_id, on_tree_progress)

        # Persist token count into meta.json
        meta = await session_manager.read_meta(session_id)
        meta["vectorless_ingestion_tokens"] = ingestion_tokens
        await session_manager.write_meta(session_id, meta)

        await emit(
            "done", 1.0,
            f"Tree built — {ingestion_tokens} tokens used",
            tokens_used=ingestion_tokens,
        )

    except Exception as exc:
        logger.exception(f"Vectorless ingestion failed [{session_id}]")
        await q.put({
            "pipeline": "vectorless", "step": "error", "progress": 0.0,
            "message":  str(exc),
            "meta":     {"elapsed_ms": int((time.monotonic() - start) * 1000)},
        })


async def _run_ingestion(session_id: str, file_url: str, q: asyncio.Queue) -> None:
    try:
        await asyncio.gather(
            _rag_pipeline(session_id, file_url, q),
            _vectorless_pipeline(session_id, file_url, q),
        )
    except Exception as exc:
        logger.error(f"Ingestion wrapper error [{session_id}]: {exc}")
    finally:
        await q.put(None)  # sentinel — tells SSE generator to close
        # PDF is no longer needed once ingestion finishes (success or failure).
        # Delete it from UploadThing now so storage isn't left with orphaned files,
        # including the case where the user closes the tab mid-ingestion.
        try:
            meta = await session_manager.read_meta(session_id)
            file_key = meta.get("file_key")
            if file_key:
                deleted = await delete_file(file_key)
                if deleted:
                    meta["file_key"] = None
                    await session_manager.write_meta(session_id, meta)
                    logger.info(f"UploadThing file deleted post-ingestion [{session_id}]")
                else:
                    logger.warning(f"UploadThing file cleanup skipped after delete failure [{session_id}]")
        except Exception as exc:
            logger.warning(f"Post-ingestion UploadThing cleanup failed [{session_id}]: {exc}")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("", response_model=IngestResponse, status_code=202)
async def start_ingestion(body: IngestRequest):
    q = session_manager.create_queue(body.session_id)

    meta = {
        "session_id":                  body.session_id,
        "file_url":                    body.file_url,
        "file_key":                    body.file_key,
        "chunk_count":                 0,
        "page_count":                  0,
        "rag_ingestion_tokens":        0,
        "vectorless_ingestion_tokens": 0,
        "created_at":                  datetime.now(timezone.utc).isoformat(),
        "status":                      "pending",
    }
    await session_manager.write_meta(body.session_id, meta)

    asyncio.create_task(_run_ingestion(body.session_id, body.file_url, q))
    logger.info(f"Ingestion started for session {body.session_id}")

    return IngestResponse(session_id=body.session_id)


@router.get("/progress")
async def ingestion_progress(session_id: str):
    q = session_manager.get_queue(session_id)
    if q is None:
        raise HTTPException(status_code=404, detail="No active ingestion for this session")

    async def event_stream():
        try:
            while True:
                try:
                    event = await asyncio.wait_for(q.get(), timeout=30.0)
                    if event is None:
                        session_manager.delete_queue(session_id)
                        break
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"  # keep connection alive
        except asyncio.CancelledError:
            pass  # client disconnected

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
