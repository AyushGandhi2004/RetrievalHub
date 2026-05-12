import os
import stat
import shutil
import json
import aiofiles
from fastapi import APIRouter, HTTPException
from loguru import logger

from api.schemas import DeleteResponse, _must_be_uuid4
from config.settings import settings
from core.uploadthing_client import delete_file

router = APIRouter(prefix="/session", tags=["session"])


@router.get("/{session_id}/meta")
async def get_session_meta(session_id: str):
    try:
        _must_be_uuid4(session_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="session_id must be a valid UUID4")

    meta_path = os.path.join(settings.session_storage_path, session_id, "meta.json")
    if not os.path.exists(meta_path):
        raise HTTPException(status_code=404, detail="Session not found")

    async with aiofiles.open(meta_path) as f:
        return json.loads(await f.read())


@router.delete("/{session_id}", response_model=DeleteResponse)
async def delete_session(session_id: str):
    try:
        _must_be_uuid4(session_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="session_id must be a valid UUID4")

    # Read meta to get file_key before deleting files
    meta_path = os.path.join(settings.session_storage_path, session_id, "meta.json")
    file_key = None
    if os.path.exists(meta_path):
        try:
            async with aiofiles.open(meta_path) as f:
                meta = json.loads(await f.read())
                file_key = meta.get("file_key")
        except Exception as exc:
            logger.warning(f"Could not read meta for session {session_id}: {exc}")

    # Delete Pinecone namespace — all vectors for this session
    try:
        from pinecone import Pinecone
        pc    = Pinecone(api_key=settings.pinecone_api_key)
        index = pc.Index(settings.pinecone_index_name)
        index.delete(delete_all=True, namespace=session_id)
        logger.info(f"Deleted Pinecone namespace for session {session_id}")
    except Exception as exc:
        logger.warning(f"Pinecone namespace delete failed for {session_id}: {exc}")

    # Delete local session directory (meta.json, bm25.pkl, tree files)
    # onerror: on Windows, directories/files can have read-only bits set; grant
    # write permission and retry before giving up.
    def _force_rm(func, path, _exc):
        os.chmod(path, stat.S_IWRITE)
        func(path)

    session_dir = os.path.join(settings.session_storage_path, session_id)
    if os.path.exists(session_dir):
        try:
            shutil.rmtree(session_dir, onerror=_force_rm)
            logger.info(f"Deleted session directory for {session_id}")
        except Exception as exc:
            logger.warning(f"Could not remove session directory {session_id}: {exc}")

    # Delete Uploadthing file if file_key is present (URL-pasted docs have no key)
    if file_key:
        await delete_file(file_key)

    return DeleteResponse(session_id=session_id)
