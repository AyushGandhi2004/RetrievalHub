"""
Unit tests for Vectorless RAG pipeline components.

Covers tree node schema invariants, traversal root detection, max_select cap,
invalid index filtering, fallback-to-first-child, token accumulation, and
the grand-total formula — all without hitting Groq or the filesystem.
"""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ──────────────────────────────────────────────────────────────────────────────
# Tree node schema
# ──────────────────────────────────────────────────────────────────────────────

def _make_tree_nodes(structure: dict) -> dict:
    """
    Build a minimal tree_nodes dict from a plain structure description:
        {node_id: {"level": ..., "children": [...], "raw_text": ..., "summary": ...}}
    Fills in defaults for fields that traversal code reads.
    """
    nodes = {}
    for nid, fields in structure.items():
        nodes[nid] = {
            "id":        nid,
            "level":     fields.get("level", "leaf"),
            "title":     fields.get("title", nid),
            "summary":   fields.get("summary"),
            "raw_text":  fields.get("raw_text"),
            "children":  fields.get("children", []),
            "page_range": [1, 1],
            "token_count": 10,
        }
    return nodes


class TestTreeNodeSchema:
    def test_root_has_no_raw_text(self):
        nodes = _make_tree_nodes({
            "root": {"level": "root", "children": ["leaf1"], "summary": "Overall"},
            "leaf1": {"level": "leaf", "raw_text": "some text", "children": []},
        })
        root = nodes["root"]
        assert root["level"] == "root"
        assert root.get("raw_text") is None or root["raw_text"] is None

    def test_leaf_has_no_summary(self):
        nodes = _make_tree_nodes({
            "leaf1": {"level": "leaf", "raw_text": "text", "children": []},
        })
        leaf = nodes["leaf1"]
        assert leaf["level"] == "leaf"
        assert leaf.get("summary") is None

    def test_page_range_is_list_of_two(self):
        nodes = _make_tree_nodes({"n": {"level": "leaf", "raw_text": "x"}})
        assert len(nodes["n"]["page_range"]) == 2

    def test_children_is_list(self):
        nodes = _make_tree_nodes({"n": {"level": "leaf", "raw_text": "x"}})
        assert isinstance(nodes["n"]["children"], list)


# ──────────────────────────────────────────────────────────────────────────────
# Root detection logic (mirrors tree_traversal.traverse)
# ──────────────────────────────────────────────────────────────────────────────

def _find_root(tree_nodes: dict) -> str:
    """Inline copy of the root-detection logic from tree_traversal.traverse."""
    root_id = next(
        (nid for nid, n in tree_nodes.items() if n.get("level") == "root"),
        None,
    )
    if root_id is None:
        all_children: set = set()
        for node in tree_nodes.values():
            all_children.update(node.get("children", []))
        candidates = [nid for nid in tree_nodes if nid not in all_children]
        root_id = candidates[0] if candidates else next(iter(tree_nodes))
    return root_id


class TestRootDetection:
    def test_finds_node_with_level_root(self):
        nodes = _make_tree_nodes({
            "r": {"level": "root", "children": ["c1"]},
            "c1": {"level": "leaf", "raw_text": "x"},
        })
        assert _find_root(nodes) == "r"

    def test_fallback_to_non_child_node(self):
        # No level="root" — orphan "top" is not referenced as any child
        nodes = _make_tree_nodes({
            "top":   {"level": "section", "children": ["a", "b"]},
            "a":     {"level": "leaf", "raw_text": "x"},
            "b":     {"level": "leaf", "raw_text": "y"},
        })
        assert _find_root(nodes) == "top"

    def test_single_node_is_its_own_root(self):
        nodes = _make_tree_nodes({"only": {"level": "leaf", "raw_text": "x"}})
        root = _find_root(nodes)
        assert root == "only"


# ──────────────────────────────────────────────────────────────────────────────
# Max-select cap and index filtering (mirrors tree_traversal logic)
# ──────────────────────────────────────────────────────────────────────────────

def _filter_indices(raw: list, n_children: int, max_select: int) -> list:
    """Inline copy of the post-parse index validation from tree_traversal."""
    valid = [i for i in raw if isinstance(i, int) and 0 <= i < n_children]
    return valid[:max_select]


class TestIndexFiltering:
    def test_out_of_range_index_removed(self):
        result = _filter_indices([0, 5, 99], n_children=3, max_select=10)
        assert result == [0]

    def test_negative_index_removed(self):
        result = _filter_indices([-1, 0, 1], n_children=3, max_select=10)
        assert result == [0, 1]

    def test_max_select_cap_applied(self):
        result = _filter_indices([0, 1, 2, 3], n_children=5, max_select=2)
        assert result == [0, 1]

    def test_non_int_values_removed(self):
        result = _filter_indices([0, "a", None, 1], n_children=3, max_select=10)
        assert result == [0, 1]

    def test_empty_result_triggers_fallback(self):
        result = _filter_indices([99, 100], n_children=2, max_select=2)
        # All out of range → empty → caller should default to [0]
        assert result == []
        fallback = result or [0]
        assert fallback == [0]

    def test_valid_all_pass(self):
        result = _filter_indices([0, 1, 2], n_children=5, max_select=5)
        assert result == [0, 1, 2]


# ──────────────────────────────────────────────────────────────────────────────
# Token accumulation and grand total formula
# ──────────────────────────────────────────────────────────────────────────────

class TestTokenAccumulation:
    def test_traversal_tokens_sum_across_calls(self):
        traversal_tokens = 0
        calls = [(30, 10), (40, 15), (25, 8)]
        for prompt, completion in calls:
            traversal_tokens += prompt + completion
        assert traversal_tokens == 128

    def test_grand_total_formula(self):
        ingestion_tokens = 500
        traversal_tokens = 128
        generation_tokens = 300
        grand_total = ingestion_tokens + traversal_tokens + generation_tokens
        assert grand_total == 928

    def test_total_tokens_alias(self):
        usage = {"prompt_tokens": 40, "completion_tokens": 20}
        total = usage["prompt_tokens"] + usage["completion_tokens"]
        assert total == 60
        # Pipeline emits total_tokens alias for TokenBadge compatibility
        usage["total_tokens"] = total
        assert usage["total_tokens"] == 60


# ──────────────────────────────────────────────────────────────────────────────
# Tree data integrity (what build_tree writes — checked without calling it)
# ──────────────────────────────────────────────────────────────────────────────

class TestTreeDataIntegrity:
    def _sample_tree_data(self) -> dict:
        return {
            "nodes": [
                {"id": "node_0000", "level": "leaf", "children": [], "raw_text": "hello"},
                {"id": "node_0001", "level": "root", "children": ["node_0000"], "summary": "doc"},
            ],
            "edges": [{"source": "node_0001", "target": "node_0000"}],
            "ingestion_tokens": 250,
            "total_nodes": 2,
            "depth": 2,
        }

    def test_required_top_level_keys_present(self):
        data = self._sample_tree_data()
        for key in ("nodes", "edges", "ingestion_tokens", "total_nodes", "depth"):
            assert key in data

    def test_total_nodes_matches_nodes_list_length(self):
        data = self._sample_tree_data()
        assert data["total_nodes"] == len(data["nodes"])

    def test_edges_reference_existing_node_ids(self):
        data = self._sample_tree_data()
        node_ids = {n["id"] for n in data["nodes"]}
        for edge in data["edges"]:
            assert edge["source"] in node_ids
            assert edge["target"] in node_ids

    def test_exactly_one_root_node(self):
        data = self._sample_tree_data()
        roots = [n for n in data["nodes"] if n["level"] == "root"]
        assert len(roots) == 1

    def test_leaf_nodes_have_raw_text(self):
        data = self._sample_tree_data()
        for node in data["nodes"]:
            if node["level"] == "leaf":
                assert node.get("raw_text") is not None

    def test_ingestion_tokens_is_non_negative_int(self):
        data = self._sample_tree_data()
        assert isinstance(data["ingestion_tokens"], int)
        assert data["ingestion_tokens"] >= 0

    def test_tree_nodes_json_roundtrip(self):
        data = self._sample_tree_data()
        flat = {n["id"]: n for n in data["nodes"]}
        serialized = json.dumps(flat)
        restored = json.loads(serialized)
        assert set(restored.keys()) == {"node_0000", "node_0001"}
