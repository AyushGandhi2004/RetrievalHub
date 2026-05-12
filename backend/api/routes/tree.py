import json
import os

import aiofiles
from fastapi import APIRouter, HTTPException

from api.schemas import _must_be_uuid4
from config.settings import settings

router = APIRouter(prefix="/tree", tags=["tree"])


@router.get("")
async def get_tree(session_id: str):
    try:
        _must_be_uuid4(session_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="session_id must be a valid UUID4")

    tree_path = os.path.join(settings.session_storage_path, session_id, "tree.json")
    if not os.path.exists(tree_path):
        raise HTTPException(status_code=404, detail="Tree not found for this session")

    async with aiofiles.open(tree_path) as f:
        return json.loads(await f.read())
