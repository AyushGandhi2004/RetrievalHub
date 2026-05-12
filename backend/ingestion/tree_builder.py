"""
RAPTOR-style hierarchical summary tree builder.

RAPTOR (Recursive Abstractive Processing for Tree-Organized Retrieval, Sarthi et al. 2024)
builds a tree of progressively coarser summaries over a document's leaf chunks.
At query time, an LLM navigates the tree top-down rather than doing a flat vector
search — this is the "Vectorless RAG" half of RAGBench.

WHY bottom-up: leaf nodes contain the ground-truth text.  Summarising upward lets
each parent capture the theme of its children while the raw text stays accessible
at the leaves.  A query descending the tree selects relevant branches and lands on
exact source text — no retrieval gap.

WHY asyncio.sleep(0.3) after every LLM call: Groq's free tier enforces a
tokens-per-minute quota.  A brief yield between calls prevents 429 errors during
large document ingestion without needing retry logic.

WHY token tracking is central: RAGBench's educational goal is to make the *cost*
of each pipeline transparent.  Tree ingestion pre-spends tokens; Vectorless queries
spend traversal tokens.  The UI shows both so users can compare total cost vs.
retrieval quality against Traditional RAG.
"""
import asyncio
import json
import os

import aiofiles
from groq import AsyncGroq
from loguru import logger

from config.settings import settings
from core.token_counter import TokenCounter

_SUMMARY_PROMPT = """You are building a hierarchical retrieval index for a document.
Summarize the following content into one information-dense paragraph.
Preserve all key entities, facts, numbers, dates, and relationships.
Maximum {max_words} words. Output only the summary — no preamble, no labels.

Content:
{content}

Summary:"""

_LEVEL_NAMES = {1: "section", 2: "chapter"}


def _get_level(depth: int) -> str:
    return _LEVEL_NAMES.get(depth, f"level_{depth}")


async def _summarize(
    client: AsyncGroq,
    content: str,
    counter: TokenCounter,
    max_words: int,
) -> str:
    prompt = _SUMMARY_PROMPT.format(
        max_words=max_words,
        content=content[: settings.tree_ingestion_content_chars],
    )
    resp = await client.chat.completions.create(
        model=settings.tree_ingestion_model or settings.groq_model,
        temperature=settings.groq_temperature,
        max_tokens=settings.tree_ingestion_max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    counter.add(resp.usage, phase="ingestion")
    return resp.choices[0].message.content.strip()


async def build_tree(
    pages: list[dict],
    session_id: str,
    on_progress=None,
) -> int:
    """
    Build a RAPTOR-style bottom-up hierarchical summary tree from parsed pages.

    Returns vectorless_ingestion_tokens (int).
    Writes tree.json and tree_nodes.json to sessions/{session_id}/.
    """
    client = AsyncGroq(api_key=settings.groq_api_key)
    counter = TokenCounter()
    all_nodes: dict[str, dict] = {}
    all_edges: list[dict] = []
    node_idx = 0

    def _new_id() -> str:
        nonlocal node_idx
        nid = f"node_{node_idx:04d}"
        node_idx += 1
        return nid

    # ── Step 1: leaf nodes (one per page / sub-page chunk) ────────────────────
    # Pages longer than pagination_chars_per_page are split so no single leaf
    # overwhelms the LLM context window during parent summarisation.
    page_chunk_chars = settings.pagination_chars_per_page
    branching_factor = settings.tree_branching_factor
    summary_max_words = settings.tree_summary_max_words

    # Large documents can exceed daily token budgets quickly; adapt tree settings
    # to reduce both summarization calls and prompt size while preserving coverage.
    if len(pages) >= 300:
        page_chunk_chars = max(page_chunk_chars, 6000)
        branching_factor = max(branching_factor, 12)
        summary_max_words = min(summary_max_words, 100)

    leaves: list[str] = []
    for page in pages:
        text     = page["text"]
        page_num = page["page_number"]
        remaining = text
        while remaining:
            chunk     = remaining[: page_chunk_chars]
            remaining = remaining[page_chunk_chars :]
            nid = _new_id()
            all_nodes[nid] = {
                "id":         nid,
                "level":      "leaf",
                "title":      f"Page {page_num}",
                "summary":    None,
                "page_range": [page_num, page_num],
                "children":   [],
                "raw_text":   chunk,
                "token_count": len(chunk.split()),
            }
            leaves.append(nid)

    if on_progress:
        await on_progress(
            "tree_building", 0.10,
            f"Created {len(leaves)} leaf nodes",
            node_count=len(leaves), tokens_used=0,
        )

    # ── Step 2: bottom-up aggregation ─────────────────────────────────────────
    # Each round groups `tree_branching_factor` sibling nodes and replaces them
    # with a single parent whose summary condenses all children.  This mirrors
    # the RAPTOR paper's clustering + summarisation loop, simplified to fixed-
    # width grouping (no Gaussian Mixture clustering needed for the demo).
    current_level = leaves
    tree_depth    = 0

    while len(current_level) > 1 and tree_depth < settings.tree_max_depth - 1:
        tree_depth += 1
        groups: list[list[str]] = [
            current_level[i : i + branching_factor]
            for i in range(0, len(current_level), branching_factor)
        ]
        next_level: list[str] = []

        for group in groups:
            parent_id   = _new_id()
            child_nodes = [all_nodes[cid] for cid in group]

            content = "\n\n".join(
                cn["summary"] if cn.get("summary") else (cn.get("raw_text") or "")
                for cn in child_nodes
            )
            summary = await _summarize(client, content, counter, summary_max_words)

            ranges   = [all_nodes[cid]["page_range"] for cid in group]
            min_page = min(r[0] for r in ranges)
            max_page = max(r[1] for r in ranges)
            lv       = _get_level(tree_depth)

            all_nodes[parent_id] = {
                "id":         parent_id,
                "level":      lv,
                "title":      f"{lv.capitalize()} (Pages {min_page}–{max_page})",
                "summary":    summary,
                "page_range": [min_page, max_page],
                "children":   list(group),
                "raw_text":   None,
                "token_count": len(summary.split()),
            }
            for cid in group:
                all_edges.append({"source": parent_id, "target": cid})
            next_level.append(parent_id)

            # Brief pause between Groq calls to stay within the free-tier TPM quota
            await asyncio.sleep(0.3)

        current_level = next_level

        if on_progress:
            pct = 0.10 + (tree_depth / settings.tree_max_depth) * 0.80
            await on_progress(
                "tree_building", pct,
                f"Built depth {tree_depth}: {len(next_level)} nodes",
                node_count=len(all_nodes), tokens_used=counter.ingestion_total,
            )

    # ── Step 3: ensure single root ────────────────────────────────────────────
    if len(current_level) > 1:
        root_id     = _new_id()
        child_nodes = [all_nodes[cid] for cid in current_level]
        content     = "\n\n".join(
            cn.get("summary") or cn.get("raw_text") or "" for cn in child_nodes
        )
        summary  = await _summarize(client, content, counter, summary_max_words)
        ranges   = [all_nodes[cid]["page_range"] for cid in current_level]
        min_page = min(r[0] for r in ranges)
        max_page = max(r[1] for r in ranges)

        all_nodes[root_id] = {
            "id":         root_id,
            "level":      "root",
            "title":      "Document Root",
            "summary":    summary,
            "page_range": [min_page, max_page],
            "children":   list(current_level),
            "raw_text":   None,
            "token_count": len(summary.split()),
        }
        for cid in current_level:
            all_edges.append({"source": root_id, "target": cid})
        tree_depth += 1
    else:
        root_id = current_level[0]
        all_nodes[root_id]["level"] = "root"
        all_nodes[root_id]["title"] = "Document Root"

    # ── Step 4: serialize ─────────────────────────────────────────────────────
    nodes_list = list(all_nodes.values())
    tree_data  = {
        "nodes":            nodes_list,
        "edges":            all_edges,
        "ingestion_tokens": counter.ingestion_total,
        "total_nodes":      len(nodes_list),
        "depth":            tree_depth + 1,
    }

    session_dir = os.path.join(settings.session_storage_path, session_id)
    os.makedirs(session_dir, exist_ok=True)

    async with aiofiles.open(os.path.join(session_dir, "tree.json"), "w") as f:
        await f.write(json.dumps(tree_data))

    tree_nodes_flat = {n["id"]: n for n in nodes_list}
    async with aiofiles.open(os.path.join(session_dir, "tree_nodes.json"), "w") as f:
        await f.write(json.dumps(tree_nodes_flat))

    logger.info(
        f"Tree built [{session_id}]: {len(nodes_list)} nodes, "
        f"depth={tree_depth + 1}, tokens={counter.ingestion_total}"
    )
    return counter.ingestion_total
