import base64
import json
import httpx
from config.settings import settings
from loguru import logger

# v7 REST endpoint (replaces legacy /api/deleteFile)
_DELETE_URL = "https://api.uploadthing.com/v6/deleteFiles"


def _extract_api_key(token: str) -> str:
    """Decode the base64url JWT issued by Uploadthing v7 and return the apiKey.

    The token payload is a JSON object: {"apiKey": "sk_live_...", "appId": "..."}.
    If decoding fails (e.g. plain API key passed directly), the token is returned as-is.
    """
    if not token:
        return token
    try:
        # JWT has three dot-separated parts; the payload is the second
        parts = token.split(".")
        payload_b64 = parts[1] if len(parts) == 3 else parts[0]
        # Add padding so Python's base64 doesn't complain
        padded = payload_b64 + "=" * (-len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded))
        return payload.get("apiKey", token)
    except Exception:
        return token


async def delete_file(file_key: str) -> bool:
    """Delete a file from Uploadthing by its fileKey. Returns True on success."""
    if not file_key:
        return True
    api_key = _extract_api_key(settings.uploadthing_token)
    headers = {"x-uploadthing-api-key": api_key, "content-type": "application/json"}
    payload = {"fileKeys": [file_key]}
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(_DELETE_URL, json=payload, headers=headers, timeout=10)
            resp.raise_for_status()
            return True
    except httpx.HTTPStatusError as exc:
        response_body = exc.response.text.strip()
        logger.error(
            f"Uploadthing delete failed for key {file_key}: {exc}. Response: {response_body or '<empty>'}"
        )
        return False
    except Exception as exc:
        logger.error(f"Uploadthing delete failed for key {file_key}: {exc}")
        return False
