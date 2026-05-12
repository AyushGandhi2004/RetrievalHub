import json
import aiofiles
from pathlib import Path

from groq import AsyncGroq
from loguru import logger

from config.settings import settings

_NAV_PROMPT = """You are navigating a hierarchical document index to find information.
You are at a {level} node. Below are summaries of its child nodes.
Select up to {max_select} children most likely to contain the answer.

Question: {question}

Children (0-indexed):
{children_summaries}

Respond with ONLY a JSON array of selected 0-based indices, e.g. [0, 2].
No explanation. No prose."""


async def _load_tree_nodes(session_id: str) -> dict:
    path = Path(settings.session_storage_path) / session_id / "tree_nodes.json"
    async with aiofiles.open(path, "r", encoding="utf-8") as f:
        content = await f.read()
    return json.loads(content)


async def traverse(question: str, session_id: str) -> dict:
    """
    LLM-guided root-to-leaf tree traversal.

    Returns:
        {
            "context":          str,           # concatenated leaf raw_text
            "node_ids":         list[str],     # all visited node IDs in traversal order
            "node_summaries":   dict[str,str], # id → summary for every visited node
            "traversal_tokens": int,           # tokens consumed by navigation LLM calls
        }
    """
    tree_nodes = await _load_tree_nodes(session_id)
    client = AsyncGroq(api_key=settings.groq_api_key)

    # Locate root — prefer level=="root", fall back to node not referenced as any child
    root_id = next(
        (nid for nid, n in tree_nodes.items() if n.get("level") == "root"),
        None,
    )
    if root_id is None:
        all_children: set[str] = set()
        for node in tree_nodes.values():
            all_children.update(node.get("children", []))
        candidates = [nid for nid in tree_nodes if nid not in all_children]
        root_id = candidates[0] if candidates else next(iter(tree_nodes))

    visited_ids: list[str] = []
    node_summaries: dict[str, str] = {}
    leaf_texts: list[str] = []
    traversal_tokens = 0

    async def descend(node_id: str) -> None:
        nonlocal traversal_tokens

        node = tree_nodes.get(node_id)
        if not node:
            logger.warning(f"Node {node_id} not found in tree_nodes for session {session_id}")
            return

        visited_ids.append(node_id)
        node_summaries[node_id] = node.get("summary") or (node.get("raw_text") or "")[:200]

        children_ids: list[str] = node.get("children", [])

        # Leaf: collect raw text
        if not children_ids:
            raw = node.get("raw_text")
            if raw:
                leaf_texts.append(raw)
            return

        # Build numbered children summary list for the nav prompt
        summary_lines: list[str] = []
        for i, child_id in enumerate(children_ids):
            child = tree_nodes.get(child_id, {})
            child_summary = child.get("summary") or (child.get("raw_text") or "")[:200]
            child_title = child.get("title", f"Node {i}")
            summary_lines.append(f"{i}. [{child_title}] {child_summary}")

        prompt = _NAV_PROMPT.format(
            level=node.get("level", "node"),
            max_select=settings.tree_max_select_per_level,
            question=question,
            children_summaries="\n".join(summary_lines),
        )

        selected_indices: list[int] = []
        try:
            response = await client.chat.completions.create(
                model=settings.groq_model,
                temperature=0.0,
                max_tokens=64,
                messages=[{"role": "user", "content": prompt}],
                stream=False,
            )
            if response.usage:
                traversal_tokens += (
                    response.usage.prompt_tokens + response.usage.completion_tokens
                )

            raw_content = response.choices[0].message.content.strip()
            parsed = json.loads(raw_content)
            if isinstance(parsed, list):
                selected_indices = parsed
            elif isinstance(parsed, int):
                selected_indices = [parsed]

            # Keep only valid, in-range indices; honour max_select cap
            selected_indices = [
                i for i in selected_indices
                if isinstance(i, int) and 0 <= i < len(children_ids)
            ][: settings.tree_max_select_per_level]

        except Exception as exc:
            logger.warning(
                f"Nav LLM failed at node {node_id} (session {session_id}): {exc} — "
                "defaulting to first child"
            )

        if not selected_indices:
            selected_indices = [0]

        for idx in selected_indices:
            await descend(children_ids[idx])

    await descend(root_id)

    context = "\n\n---\n\n".join(leaf_texts)

    logger.info(
        f"Tree traversal [{session_id}]: {len(visited_ids)} nodes visited, "
        f"{len(leaf_texts)} leaves reached, {traversal_tokens} traversal tokens"
    )

    return {
        "context":          context,
        "node_ids":         visited_ids,
        "node_summaries":   node_summaries,
        "traversal_tokens": traversal_tokens,
    }
