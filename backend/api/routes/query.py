import asyncio
import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from loguru import logger

from api.schemas import QueryRequest
from pipelines.rag_pipeline import RAGPipeline
from pipelines.vectorless_pipeline import VectorlessPipeline

router = APIRouter(prefix="/query", tags=["query"])

# Instantiated once at import time; heavy models load lazily on first request
_rag        = RAGPipeline()
_vectorless = VectorlessPipeline()


@router.post("/rag")
async def query_rag(body: QueryRequest):
    async def event_stream():
        try:
            async for chunk in _rag.run(body.question, body.session_id):
                yield chunk
        except Exception as exc:
            logger.error(f"RAG query error [{body.session_id}]: {exc}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/vectorless")
async def query_vectorless(body: QueryRequest):
    async def event_stream():
        try:
            async for chunk in _vectorless.run(body.question, body.session_id):
                yield chunk
        except Exception as exc:
            logger.error(f"Vectorless query error [{body.session_id}]: {exc}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/compare")
async def query_compare(body: QueryRequest):
    async def event_stream():
        # Each pipeline pushes tagged SSE strings into this queue.
        # None is the sentinel signalling that pipeline is finished.
        queue: asyncio.Queue[str | None] = asyncio.Queue()

        async def tag_and_enqueue(gen, pipeline: str) -> None:
            try:
                async for raw in gen:
                    # raw = "data: {...}\n\n"  — parse, tag, re-serialise
                    for line in raw.split("\n"):
                        if not line.startswith("data: "):
                            continue
                        try:
                            event = json.loads(line[6:])
                        except json.JSONDecodeError:
                            continue
                        event["pipeline"] = pipeline
                        await queue.put(f"data: {json.dumps(event)}\n\n")
            except Exception as exc:
                logger.error(f"Compare {pipeline} error [{body.session_id}]: {exc}")
                err = {"pipeline": pipeline, "type": "error", "message": str(exc)}
                await queue.put(f"data: {json.dumps(err)}\n\n")
            finally:
                await queue.put(None)  # sentinel for this pipeline

        rag_gen = _rag.run(body.question, body.session_id)
        vl_gen  = _vectorless.run(body.question, body.session_id)

        tasks = [
            asyncio.create_task(tag_and_enqueue(rag_gen, "rag")),
            asyncio.create_task(tag_and_enqueue(vl_gen, "vectorless")),
        ]

        # Yield events until both pipelines have sent their sentinels
        done = 0
        while done < 2:
            item = await queue.get()
            if item is None:
                done += 1
            else:
                yield item

        await asyncio.gather(*tasks, return_exceptions=True)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
