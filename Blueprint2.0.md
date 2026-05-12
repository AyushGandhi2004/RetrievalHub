# RAG vs Vectorless RAG — Full Project Blueprint

> **Purpose of this file:** This is the single source of truth for the entire RAGBench project. Any LLM, developer, or collaborator working on any layer of this system must reference this file first. It covers architecture, tech stack, data flows, UI/UX specifications, retrieval strategies, token tracking, deployment, configuration conventions, implementation phases, and code standards. Every decision made here must be reflected exactly in code.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack & Tools](#2-tech-stack--tools)
3. [Universal Configuration](#3-universal-configuration)
4. [System Architecture](#4-system-architecture)
5. [Ingestion Phase](#5-ingestion-phase)
6. [Retrieval Pipelines](#6-retrieval-pipelines)
7. [Token Tracking](#7-token-tracking)
8. [LangChain Orchestration](#8-langchain-orchestration)
9. [Frontend Specification](#9-frontend-specification)
10. [PDF Storage](#10-pdf-storage)
11. [Session Management & Delete Flow](#11-session-management--delete-flow)
12. [API Contract](#12-api-contract)
13. [Deployment Guide](#13-deployment-guide)
14. [Implementation Phases](#14-implementation-phases)
15. [Standard Practices & Code Conventions](#15-standard-practices--code-conventions)
16. [Folder Structure](#16-folder-structure)
17. [Environment Variables](#17-environment-variables)
18. [Glossary](#18-glossary)

---

## 1. Project Overview

**Project Name:** `RAGBench` *(changeable in `src/config/app.config.js`)*

**Goal:** An educational and analytical web application that lets a user upload or link a PDF document, then compare two distinct RAG paradigms side-by-side to understand their mechanics, speed, and output quality.

| Mode | Description |
|------|-------------|
| **Traditional RAG** | Semantic chunking → local SentenceTransformer embeddings → Pinecone vector store → Hybrid Search (BM25 + dense, RRF-fused) → cross-encoder re-ranking + contextual window expansion → Groq LLM |
| **Vectorless RAG** | Layout-aware pagination → RAPTOR-inspired hierarchical summarization tree (Groq LLM) → LLM-guided root-to-leaf traversal at query time → Groq LLM |
| **Compare Mode** | Both pipelines run in parallel (`asyncio.gather`); results shown side-by-side with retrieval time and token usage per pipeline |

**Primary Audience:** Developers, ML engineers, students learning RAG architectures.

**Core Principles:**
- 100% free tooling across local dev and cloud deployment
- Every configuration value lives in one dedicated file — never hard-coded
- All pipelines are modular — swapping any component must not break others
- UI is clean, professional, warm, and fully responsive (320px to 4K)
- Token usage is tracked and surfaced everywhere it is meaningful

---

## 2. Tech Stack & Tools

### Frontend
| Layer | Tool | Notes |
|-------|------|-------|
| Framework | React 18 + Vite | Fast HMR in dev, optimised production build |
| Language | JavaScript (ES2022) | No TypeScript for simplicity |
| Styling | **TailwindCSS v3** | Utility-first; all design tokens in `tailwind.config.js` |
| Tree Visualization | React Flow (`@xyflow/react`) | Interactive collapsible tree; custom node components |
| HTTP Client | Axios | Centralised instance with interceptors |
| State Management | Zustand | Lightweight slices, no boilerplate |
| Routing | React Router v6 | `/` → landing, `/ingest` → progress, `/chat` → chatbot |
| Markdown | react-markdown + remark-gfm | Streamed LLM responses rendered as Markdown |
| Animations | Framer Motion | Page transitions, expand/collapse, progress reveals |
| Icons | Lucide React | Consistent, tree-shakable icon set |
| Deployment | **Vercel** | Auto-deploy from `frontend/` on push |

### Backend
| Layer | Tool | Notes |
|-------|------|-------|
| Runtime | Python 3.11+ | |
| Framework | FastAPI | Async-first; SSE support built-in |
| Orchestrator | LangChain 0.2+ (LCEL) | Chains, retrievers, prompt templates |
| LLM | **Groq** free tier | Model: `llama3-70b-8192`; fast inference, generous free quota |
| Embeddings | **SentenceTransformers** (local) | `all-MiniLM-L6-v2`; no API key; 384-dim vectors; runs on CPU |
| Vector DB | **Pinecone** free tier | 2GB storage, 1 serverless index, permanent cloud persistence |
| Sparse Retrieval | `rank_bm25` (BM25Okapi) | Runs in-process; serialised per session as pickle |
| Re-ranker | `cross-encoder/ms-marco-MiniLM-L-6-v2` | ~67MB, ~180MB RAM at inference — fits Render free tier |
| PDF Parsing | `pypdf` + `pdfplumber` | Text + layout-aware extraction with page metadata |
| PDF Storage | **Uploadthing** free tier | Permanent URL + fileKey; file router lives in `frontend/api/uploadthing.js` (Vercel serverless) — FastAPI never handles the upload directly |
| Semantic Chunking | LangChain `SemanticChunker` | Local SentenceTransformer embedding boundary detection |
| Progress Events | Server-Sent Events (SSE) | Real-time ingestion progress to frontend |
| Task Parallelism | `asyncio.gather` | Parallel ingestion of both pipelines |
| File I/O | `aiofiles` | Non-blocking session file reads/writes |
| Logging | `loguru` | Structured, coloured logs |
| Deployment | **Render** free tier | Web Service; auto-deploy on push |

> **Why local SentenceTransformers?** `all-MiniLM-L6-v2` is ~22MB, runs fully on CPU, requires no API key, and has no per-request rate limits — ideal for local demos where multiple users would otherwise exhaust a shared Gemini free-tier quota. It produces 384-dimensional vectors that are strong enough for semantic retrieval.

> **Why Pinecone?** Pinecone's free serverless tier provides a permanent cloud-hosted vector index. ChromaDB local persistence is ephemeral and not suitable for shared use.

> **Why cross-encoder stays local?** At ~67MB and ~180MB RAM during inference, `ms-marco-MiniLM-L-6-v2` fits comfortably for local development.

---

## 3. Universal Configuration

> **RULE:** Every value that could ever change — colours, model names, API endpoints, chunk sizes, tree parameters — MUST live in the relevant config file. Hard-coding anywhere in the codebase is a bug, not a shortcut.

---

### 3.1 Frontend: `tailwind.config.js`

This is the **single source of truth for all design tokens** on the frontend. All Tailwind utility classes reference these tokens. Do not define colours, fonts, or spacing anywhere else.

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {

      // ── BRAND IDENTITY: Warm coral / terracotta ─────────────────────────────
      // The signature colour of RAGBench. Used on primary buttons, active
      // states, highlights, key accents, and the brand logo. Keep it
      // light and approachable — never use shades darker than 600 in UI chrome.
      colors: {
        coral: {
          50:  '#FFF4F0',   // hover backgrounds, subtle fills
          100: '#FFE4D9',   // active tab backgrounds, pill backgrounds
          200: '#FFCAB4',   // borders on focus, inactive chips
          300: '#FF9F7A',   // secondary buttons, icon fills
          400: '#F57C5A',   // PRIMARY — buttons, links, active accents
          500: '#E8623E',   // hover on primary elements
          600: '#C94A28',   // pressed / strong emphasis (use sparingly)
        },

        // Neutral palette — backgrounds, text, borders
        // These replace Tailwind's built-in gray/slate to match the warm tone.
        stone: {
          50:  '#FAFAFA',   // card backgrounds
          100: '#F5F4F2',   // page background (use instead of pure white)
          200: '#EEECE9',   // secondary backgrounds, input fills
          300: '#E0DDD8',   // borders (light)
          400: '#C5C1BA',   // borders (mid), muted icons
          500: '#9A9590',   // placeholder text, muted labels
          600: '#6B6762',   // secondary text
          700: '#4A4744',   // body text
          800: '#2E2C2A',   // primary text
          900: '#1A1917',   // headings
        },

        // Pipeline identity — Compare Mode panel headers
        rag: {
          DEFAULT: '#4F6DF5',   // soft indigo for Traditional RAG panel
          light:   '#EEF1FE',   // RAG panel background tint
          border:  '#C5CEFB',   // RAG panel border
        },
        vectorless: {
          DEFAULT: '#2DAF7F',   // sage green for Vectorless RAG panel
          light:   '#E8F8F3',   // Vectorless panel background tint
          border:  '#A3E2CC',   // Vectorless panel border
        },

        // Status colours
        success: '#2D9E6B',
        warning: '#D97706',
        error:   '#DC2626',
        info:    '#2563EB',
      },

      // ── TYPOGRAPHY ───────────────────────────────────────────────────────────
      fontFamily: {
        display: ['"DM Serif Display"', 'serif'],   // page headings, logo mark
        body:    ['"DM Sans"', 'sans-serif'],        // all UI text (set as default)
        mono:    ['"JetBrains Mono"', 'monospace'],  // chunk text, code blocks
      },

      // ── LAYOUT ───────────────────────────────────────────────────────────────
      maxWidth: {
        content: '1280px',
        chat:    '820px',
      },
      width: {
        sidebar: '320px',
      },

      // ── SHADOWS ──────────────────────────────────────────────────────────────
      boxShadow: {
        card:   '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        lifted: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        coral:  '0 4px 14px rgba(245,124,90,0.30)',  // coral glow for buttons
      },

      // ── BORDER RADIUS ────────────────────────────────────────────────────────
      borderRadius: {
        DEFAULT: '8px',
        lg:      '14px',
        xl:      '20px',
      },

      // ── ANIMATIONS ───────────────────────────────────────────────────────────
      keyframes: {
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.35' },
        },
      },
      animation: {
        'fade-up':   'fade-up 0.3s ease-out',
        'pulse-dot': 'pulse-dot 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
```

---

### 3.2 Frontend: `src/config/app.config.js`

All application-level runtime constants. Import this wherever app behaviour needs to be configured.

```js
export const APP_CONFIG = {
  // ── IDENTITY ──────────────────────────────────────────────────────────────
  appName:    'RAGBench',
  appTagline: 'Compare RAG paradigms on your own documents',
  appVersion: '1.0.0',

  // ── BACKEND ───────────────────────────────────────────────────────────────
  backendBaseUrl: import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000',

  // ── UPLOAD ────────────────────────────────────────────────────────────────
  maxFileSizeMB:     25,
  acceptedMimeTypes: ['application/pdf'],

  // ── QUERY MODES ───────────────────────────────────────────────────────────
  // color values map directly to keys in tailwind.config.js `colors`
  modes: {
    RAG: {
      id:          'rag',
      label:       'Traditional RAG',
      shortLabel:  'RAG',
      description: 'Hybrid vector search with cross-encoder re-ranking',
      color:       'rag',
    },
    VECTORLESS: {
      id:          'vectorless',
      label:       'Vectorless RAG',
      shortLabel:  'Vectorless',
      description: 'Tree traversal — no embeddings at query time',
      color:       'vectorless',
    },
    COMPARE: {
      id:          'compare',
      label:       'Compare',
      shortLabel:  '⚡ Compare',
      description: 'Run both pipelines in parallel and compare',
      color:       'coral',
    },
  },

  // ── CHAT ──────────────────────────────────────────────────────────────────
  maxChunksDisplayed: 5,
  streamingEnabled:   true,

  // ── TREE VISUALIZATION ────────────────────────────────────────────────────
  treeLayout:     'TB',    // 'TB' = top-to-bottom | 'LR' = left-to-right
  treeNodeWidth:  220,
  treeNodeHeight: 80,

  // ── BREAKPOINTS (for JS logic; CSS uses Tailwind sm/md/lg/xl prefixes) ────
  breakpoints: { sm: 640, md: 768, lg: 1024, xl: 1280 },
};
```

---

### 3.3 Backend: `config/settings.py`

All backend configuration via Pydantic Settings. Values loaded from environment variables or `.env`. Nothing is hard-coded in pipeline code.

```python
from pydantic_settings import BaseSettings
from typing import Literal

class Settings(BaseSettings):
    # ── APP ───────────────────────────────────────────────────────────────────
    app_name:    str  = "RAGBench"
    debug:       bool = False
    environment: Literal["local", "production"] = "local"

    # ── GROQ (LLM) ────────────────────────────────────────────────────────────
    groq_api_key:     str
    groq_model:       str   = "llama3-70b-8192"
    groq_temperature: float = 0.2
    groq_max_tokens:  int   = 1024

    # ── LOCAL EMBEDDINGS ─────────────────────────────────────────────────────
    local_embed_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    local_embed_dim:   int = 384

    # ── PINECONE (VECTOR DB) ──────────────────────────────────────────────────
    pinecone_api_key:    str
    pinecone_index_name: str = "ragbench"
    pinecone_cloud:      str = "aws"
    pinecone_region:     str = "us-east-1"
    # Sessions are isolated as Pinecone namespaces: namespace = session_id

    # ── UPLOADTHING (PDF STORAGE) ─────────────────────────────────────────────
    uploadthing_secret: str
    uploadthing_app_id: str

    # ── SEMANTIC CHUNKING ─────────────────────────────────────────────────────
    chunk_strategy:                str   = "semantic"
    semantic_breakpoint_type:      str   = "percentile"
    semantic_breakpoint_threshold: float = 95.0
    chunk_overlap_tokens:          int   = 50

    # ── RETRIEVAL — RAG ───────────────────────────────────────────────────────
    hybrid_search_alpha: float = 0.7   # 0 = BM25 only, 1 = dense only
    top_k_retrieval:     int   = 10    # candidates before re-ranking
    top_k_after_rerank:  int   = 4     # final chunks sent to LLM

    # ── VECTORLESS TREE ───────────────────────────────────────────────────────
    tree_max_depth:            int = 4
    tree_branching_factor:     int = 5
    tree_max_select_per_level: int = 2      # LLM can select up to N branches per level
    pagination_chars_per_page: int = 3000
    tree_summary_max_words:    int = 200

    # ── SESSIONS ──────────────────────────────────────────────────────────────
    session_storage_path: str = "./sessions"

    class Config:
        env_file = ".env"

settings = Settings()
```

---

## 4. System Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        BROWSER  (React + Vite)                           │
│                     Deployed: Vercel (CDN, global)                       │
│                                                                          │
│  /              ──upload──►  /ingest  ──complete──►  /chat               │
│  LandingPage                 IngestionPage           ChatPage             │
│                                                                          │
│  Uploadthing React SDK          SSE progress stream       Zustand state  │
│  (file → permanent URL)         (per pipeline step)                      │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  ChatPage — responsive layout                                    │   │
│  │  ┌────────────────┐  ┌──────────────────────────────────────┐   │   │
│  │  │ Document Tree  │  │  Chat Area                           │   │   │
│  │  │ (React Flow)   │  │  Messages + streamed tokens          │   │   │
│  │  │                │  │  Source chunks ▼ collapsible         │   │   │
│  │  │ Tree stats     │  │  Token badge per response            │   │   │
│  │  │ Ingestion tok  │  │  InputBar + ModeSelector             │   │   │
│  │  │ Traversal path │  │                                      │   │   │
│  │  │ highlighted    │  │                                      │   │   │
│  │  └────────────────┘  └──────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
                     │  REST + SSE
                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                       FASTAPI BACKEND                                    │
│                  Deployed: Render free Web Service                       │
│                                                                          │
│  POST   /ingest              → asyncio.gather(rag_ingest, vl_ingest)     │
│  GET    /ingest/progress     → SSE: step events per pipeline             │
│  GET    /tree                → full tree JSON for React Flow              │
│  GET    /session/{id}/meta   → chunk count, page count, token totals     │
│  POST   /query/rag           → streaming SSE answer                      │
│  POST   /query/vectorless    → streaming SSE answer + path               │
│  POST   /query/compare       → both pipelines, multiplexed SSE           │
│  DELETE /session/{id}        → wipe Pinecone namespace + session files   │
│                                                                          │
│  ┌─────────────────────────┐   ┌──────────────────────────────────────┐ │
│  │  RAG PIPELINE           │   │  VECTORLESS RAG PIPELINE              │ │
│  │  pdfplumber parse       │   │  pdfplumber parse                    │ │
│  │  SemanticChunker+local  │   │  layout-aware page segmentation      │ │
│  │  Pinecone upsert        │   │  bottom-up LLM summarization tree    │ │
│  │  BM25 index build       │   │  tree.json + tree_nodes.json         │ │
│  │  ── query time ──       │   │  ── query time ──                    │ │
│  │  BM25 + Pinecone dense  │   │  LLM root-to-leaf traversal          │ │
│  │  RRF fusion             │   │  raw leaf text as context            │ │
│  │  cross-encoder rerank   │   │  Groq LLM generation                 │ │
│  │  context window expand  │   │  token tracking: ingestion + query   │ │
│  │  Groq LLM generation    │   │                                      │ │
│  │  token tracking: query  │   │                                      │ │
│  └─────────────────────────┘   └──────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
         │                    │                      │
  Pinecone Cloud          sessions/              Uploadthing
  (vectors namespaced     {id}/meta.json         (PDF file
   by session_id)         {id}/bm25.pkl           hosting)
                          {id}/tree.json
                          {id}/tree_nodes.json
```

---

## 5. Ingestion Phase

When the user submits a PDF, both pipelines are triggered in parallel via `asyncio.gather`. Each emits SSE progress events independently. When both emit `done`, the frontend redirects to `/chat`.

### SSE Progress Event Schema
```json
{
  "pipeline":  "rag" | "vectorless",
  "step":      "parsing" | "chunking" | "embedding" | "indexing" | "tree_building" | "done" | "error",
  "progress":  0.65,
  "message":   "Indexed 142 chunks into Pinecone...",
  "meta": {
    "chunk_count":     142,
    "node_count":      31,
    "tokens_used":     4821,
    "elapsed_ms":      3200
  }
}
```

> `tokens_used` in the vectorless pipeline accumulates across all tree-building LLM calls and is included in the final `done` event. This value is persisted in `meta.json` and displayed in the tree sidebar.

---

### 5.1 Traditional RAG Ingestion

**Step 1 — PDF Download & Parsing**
- Download PDF from Uploadthing URL using `httpx.AsyncClient`.
- Parse with `pdfplumber` (layout-aware; preserves tables and columns).
- Fall back to `pypdf` per page if `pdfplumber` fails.
- Each block carries: `{page_number, text, source_url, session_id}`.

**Step 2 — Semantic Chunking**
- Use LangChain `SemanticChunker` with local `sentence-transformers/all-MiniLM-L6-v2`.
- `breakpoint_threshold_type`: `settings.semantic_breakpoint_type` (default: `"percentile"`).
- `breakpoint_threshold_amount`: `settings.semantic_breakpoint_threshold` (default: `95.0`).
- Chunk metadata: `{page_number, chunk_index, char_start, session_id, source_url}`.

**Step 3 — BM25 Index**
- Build `BM25Okapi` from all chunk texts.
- Pickle to `sessions/{session_id}/bm25.pkl`.

**Step 4 — Local Embedding + Pinecone Upsert**
- Batch embed all chunks (100 per batch) using local SentenceTransformer model.
- Upsert to Pinecone namespace = `session_id`.
- Metadata per vector: `{page_number, chunk_index, text, session_id}`.

**Step 5 — Session Metadata**
Write `sessions/{session_id}/meta.json`:
```json
{
  "session_id":                   "...",
  "file_url":                     "...",
  "file_key":                     "...",
  "chunk_count":                  142,
  "page_count":                   28,
  "rag_ingestion_tokens":         0,
  "vectorless_ingestion_tokens":  4821,
  "created_at":                   "2025-01-01T00:00:00Z"
}
```

---

### 5.2 Vectorless RAG Ingestion

No embeddings. No vector database. The pipeline builds a hierarchical summary tree using Groq.

**Step 1 — PDF Download & Parsing** *(shared utility with RAG)*

**Step 2 — Layout-Aware Page Segmentation (Leaf Nodes)**
- Split by actual page breaks from `pdfplumber`.
- Sub-split pages exceeding `settings.pagination_chars_per_page` chars.
- Each page/sub-page = one leaf node.
- Leaf schema: `{id, level: "leaf", page_range: [n,n], raw_text, summary: null, children: [], token_count: N}`.

**Step 3 — Bottom-Up Tree Construction**
```
Level 0 (Leaves)     raw page text nodes
      ↓  group by branching_factor (default 5)
Level 1 (Sections)   LLM summary of N leaves
      ↓  group by branching_factor
Level 2 (Chapters)   LLM summary of N sections
      ↓
Level 3 (Root)       document-level summary
```

For each non-leaf node group:
- Concatenate child summaries (or raw_text for leaves) → Groq summarization call.
- Track `prompt_tokens + completion_tokens` from Groq response `usage` field.
- Accumulate into `TokenCounter.ingestion_total`.

**Summarization Prompt:**
```python
tree_summary_prompt = """You are building a hierarchical retrieval index for a document.
Summarize the following content into one information-dense paragraph.
Preserve all key entities, facts, numbers, dates, and relationships.
Maximum {max_words} words. Output only the summary — no preamble, no labels.

Content:
{content}

Summary:"""
```

**Step 4 — Tree Serialization**
- `sessions/{session_id}/tree.json` — full nested tree.
- `sessions/{session_id}/tree_nodes.json` — flat dict by node ID for O(1) lookup.
- Write `vectorless_ingestion_tokens` to `meta.json`.

**Node Schema:**
```json
{
  "id":         "node_003",
  "level":      "section",
  "title":      "Section 2 (Pages 8–14)",
  "summary":    "...",
  "page_range": [8, 14],
  "children":   ["node_007", "node_008", "node_009"],
  "raw_text":   null,
  "token_count": 312
}
```
*(leaf nodes have `raw_text` set and `children: []`)*

---

## 6. Retrieval Pipelines

### 6.1 Traditional RAG Pipeline

Two layered strategies applied sequentially at query time.

#### Stage 1: Hybrid Retrieval

1. **Dense retrieval** — Embed query with local SentenceTransformer model. Query Pinecone namespace `session_id`, fetch top `settings.top_k_retrieval` by cosine similarity.
2. **Sparse retrieval (BM25)** — Load `bm25.pkl` for session. Score all chunks, return top `settings.top_k_retrieval`.
3. **RRF fusion:**
   ```
   rrf_score(doc) = Σ  1 / (k + rank_in_list_i)    where k = 60
   ```
   `settings.hybrid_search_alpha` soft-weights dense vs sparse before fusion.
4. Deduplicated union trimmed to `settings.top_k_retrieval`.

> Dense retrieval captures semantic intent; BM25 captures exact terminology. Together they handle both concept-level and keyword-level questions well.

#### Stage 2: Contextual Compression + Cross-Encoder Re-ranking

1. Score each `(query, chunk_text)` pair with `cross-encoder/ms-marco-MiniLM-L-6-v2`.
2. Keep top `settings.top_k_after_rerank` by score.
3. **Context window expansion** — Fetch adjacent chunks (chunk_index ± 1) from Pinecone and pad each retained chunk to avoid hard boundary cuts.

#### Stage 3: Generation

```python
rag_answer_prompt = """You are a precise document analyst.
Answer the question using ONLY the provided context sections.
If the context is insufficient, state that explicitly.
When helpful, cite the page number (e.g. "As stated on page 4...").

Context:
{context}

Question: {question}

Answer:"""
```

**SSE response payload:**
- `type: "token"` — streamed answer tokens
- `type: "sources"` — `[{chunk_text, page_number, chunk_index, rerank_score}]`
- `type: "usage"` — `{prompt_tokens, completion_tokens, total_tokens, retrieval_ms}`
- `type: "done"`

---

### 6.2 Vectorless RAG Pipeline

No vector database. No embeddings at query time. Pure LLM-guided tree navigation.

#### Stage 1: Root-to-Leaf Tree Traversal

Starting at root, at each level:
1. Present children summaries (numbered) to Groq.
2. LLM selects up to `settings.tree_max_select_per_level` indices.
3. Descend into selected children.
4. Repeat until leaf nodes reached.
5. Record traversal path (list of visited node IDs).

**Navigation Prompt:**
```python
tree_nav_prompt = """You are navigating a hierarchical document index to find information.
You are at a {level} node. Below are summaries of its child nodes.
Select up to {max_select} children most likely to contain the answer.

Question: {question}

Children (0-indexed):
{children_summaries}

Respond with ONLY a JSON array of selected 0-based indices, e.g. [0, 2].
No explanation. No prose."""
```

Each traversal LLM call's token usage is tracked and summed as `query_traversal_tokens`.

#### Stage 2: Generation

- Concatenate raw text from all reached leaf nodes.
- Call Groq for generation.

```python
vectorless_answer_prompt = """You are answering a question using sections retrieved from a document.
These sections were located by navigating a hierarchical summary tree.

Retrieved sections:
{context}

Question: {question}

Answer:"""
```

**SSE response payload:**
- `type: "token"` — streamed answer tokens
- `type: "path"` — `{node_ids: [...], node_summaries: {id: summary}}`
- `type: "usage"` — `{traversal_tokens, generation_prompt_tokens, generation_completion_tokens, total_query_tokens, ingestion_tokens, grand_total_tokens, retrieval_ms}`
- `type: "done"`

> `grand_total_tokens = ingestion_tokens + total_query_tokens`. This is the true cumulative cost of the vectorless approach for this query and is displayed prominently in the UI.

---

### 6.3 Compare Mode

- `POST /query/compare` runs both pipelines via `asyncio.gather`, multiplexing SSE events tagged with `"pipeline": "rag"` or `"pipeline": "vectorless"`.
- Frontend routes each event to the correct panel in real time.
- Once both pipelines complete, the faster one gets a `🏆` badge next to its time.

---

## 7. Token Tracking

Token tracking is a **first-class feature** of RAGBench. It surfaces the real cost and effort of each paradigm, which is central to the educational goal of the project.

### What is tracked and where

| Metric | Source | UI location |
|--------|--------|-------------|
| Vectorless ingestion tokens | `meta.json → vectorless_ingestion_tokens` | Tree sidebar: "🌿 Tree built using N tokens" |
| RAG query: prompt + completion | Groq `usage` in response | TokenBadge below each RAG message |
| VL query: traversal tokens | Sum of nav LLM call usages | TokenBadge below each VL message |
| VL query: generation tokens | Groq `usage` in response | TokenBadge below each VL message |
| VL query: grand total | ingestion + traversal + generation | TokenBadge extra row |
| Compare mode | Both `usage` objects | Each Compare panel header |

### TokenCounter (backend utility)

```python
# core/token_counter.py
class TokenCounter:
    def __init__(self):
        self.ingestion_total = 0
        self.query_total     = 0

    def add(self, usage, phase: str = "query"):
        tokens = usage.prompt_tokens + usage.completion_tokens
        if phase == "ingestion":
            self.ingestion_total += tokens
        else:
            self.query_total += tokens

    def summary(self) -> dict:
        return {
            "ingestion_tokens": self.ingestion_total,
            "query_tokens":     self.query_total,
            "grand_total":      self.ingestion_total + self.query_total,
        }
```

### TokenBadge UI (frontend component)

Rendered below every assistant message:

```
┌──────────────────────────────────────────────────────────────┐
│  bg-stone-50 border border-stone-200 rounded-lg p-3 text-xs  │
│                                                              │
│  ⚡ 312 tokens  ·  📥 248 prompt  ·  📤 64 output           │
│  ⏱ Retrieved in 1.4s                                        │
│                                                              │
│  [Vectorless only row:]                                      │
│  🌿 +4,821 ingestion = 5,133 grand total tokens              │
└──────────────────────────────────────────────────────────────┘
```

---

## 8. LangChain Orchestration

All pipelines use LCEL (LangChain Expression Language) for composable, readable chains. Both chains support `.astream()` for token-level SSE streaming.

### RAG Chain
```python
rag_chain = (
    {"question": RunnablePassthrough()}
    | hybrid_retriever          # BM25 + Pinecone dense → RRF → top_k_retrieval docs
    | cross_encoder_reranker    # cross-encoder scoring → top_k_after_rerank docs
    | context_window_expander   # fetch ±1 neighbor chunks from Pinecone
    | RunnableParallel(
        answer  = rag_answer_prompt | groq_llm | StrOutputParser(),
        sources = RunnablePassthrough(),
    )
)
```

### Vectorless Chain
```python
vectorless_chain = (
    {"question": RunnablePassthrough()}
    | tree_traversal_runnable   # LLM navigates tree → returns {context, path, traversal_tokens}
    | RunnableParallel(
        answer = vectorless_answer_prompt | groq_llm | StrOutputParser(),
        path   = lambda x: x["path"],
        tokens = lambda x: x["traversal_tokens"],
    )
)
```

---

## 9. Frontend Specification

> All styling uses **TailwindCSS utility classes**. Design tokens defined in `tailwind.config.js` are the only source for colours, fonts, and spacing.
>
> The UI is **fully responsive**: mobile-first design, tested at 320px, 375px, 768px, 1024px, 1280px, and 1920px. No layout should break or overflow at any of these widths.

---

### 9.1 Google Fonts (`index.html`)
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

---

### 9.2 Landing / Upload Page (`/`)

**Desktop:** Full viewport, content vertically and horizontally centred.
**Mobile:** Full-screen scroll, single column, comfortable horizontal padding.

- Background: `bg-stone-100` with subtle dot-grid pattern via CSS (`radial-gradient(circle, #C5C1BA 1px, transparent 1px)` at 28px spacing).
- Top bar: app name `font-display text-stone-900` (left) + GitHub link (right).

**Upload Card:**
- `bg-white rounded-xl shadow-lifted p-8 w-full max-w-md mx-auto mt-12`
- Drop zone: `border-2 border-dashed border-stone-300 rounded-lg py-12 px-6 text-center transition-colors`
  - Idle: `border-stone-300 bg-white`
  - Drag-over: `border-coral-400 bg-coral-50`
  - Upload cloud icon: `text-coral-400 w-10 h-10 mx-auto mb-3`
- `OR` divider: `text-stone-400 text-sm` between two `border-stone-300` horizontal rules
- URL input: `w-full border border-stone-300 rounded-lg px-4 py-3 font-body text-stone-800 focus:outline-none focus:ring-2 focus:ring-coral-300 focus:border-coral-400`
- Primary CTA: `w-full bg-coral-400 hover:bg-coral-500 active:bg-coral-600 text-white font-semibold rounded-lg py-3 shadow-coral transition-colors`
- Caption: `text-stone-500 text-xs mt-3 text-center` — "PDF only · Max 25MB"

**Behaviour:**
- File selected/dropped → Uploadthing SDK uploads → returns `{url, fileKey}`.
- URL pasted → client-side `.pdf` extension check.
- Submit → `POST /ingest` → navigate to `/ingest?session_id=...` with Framer Motion slide-up transition.

---

### 9.3 Ingestion Progress Page (`/ingest`)

**Desktop:** Two columns side-by-side, centred with `max-w-3xl mx-auto`.
**Mobile:** Stacked vertically, full-width cards with `gap-4`.

Each pipeline column:
- `bg-white rounded-xl shadow-card p-6`
- Header: pipeline name `font-semibold text-stone-800` + colour dot (`bg-rag-DEFAULT` or `bg-vectorless-DEFAULT` rounded-full w-2 h-2)
- Step list: animated — pending `○ text-stone-400` → loading `spinner text-coral-400` → done `✓ text-success`
- Elapsed timer: `text-stone-500 font-mono text-xs`
- Vectorless extra line: `text-stone-500 text-xs` — "🌿 Building tree... 12 nodes"

When both `done`: full-width `bg-coral-400 hover:bg-coral-500 text-white rounded-xl py-4 font-semibold shadow-coral animate-fade-up` — "Explore Your Document →"

---

### 9.4 Chatbot Page (`/chat`)

#### Responsive Layout

**≥ 1024px (desktop):** Header + sidebar (320px fixed) + chat area (flex-1), side by side.

**768px – 1023px (tablet):** Sidebar collapses to a 48px icon-only rail. Tap tree icon → overlay drawer slides in from left (`fixed inset-0 z-50 bg-black/20` backdrop + `w-sidebar bg-white shadow-xl`).

**< 768px (mobile):** No sidebar. Floating action button bottom-left: `fixed bottom-20 left-4 z-50 bg-coral-400 text-white rounded-full w-12 h-12 shadow-coral flex items-center justify-center` with tree icon → opens full-screen drawer.

#### Header
`bg-white border-b border-stone-200 sticky top-0 z-40 px-4 h-14 flex items-center justify-between`
- Left: logo + app name `font-display text-stone-900 text-lg`
- Centre: document name pill `bg-coral-50 text-coral-600 border border-coral-200 rounded-full text-sm px-3 py-1 truncate max-w-xs`
- Right: delete button `text-stone-400 hover:text-error transition-colors` (trash icon) → confirmation modal

#### Sidebar — Document Tree
`bg-stone-50 border-r border-stone-200 w-sidebar flex-shrink-0 flex flex-col` (hidden below `lg:`)

- Header row: "Document Structure" `text-stone-700 font-semibold text-sm` + collapse button
- Stats row: `text-stone-500 text-xs` — "31 nodes · 4 levels"
- Token pill: `bg-coral-50 border border-coral-100 rounded-lg p-2 mx-3 mb-2 text-xs text-coral-700` — "🌿 Tree built using 4,821 tokens"
- React Flow canvas: `flex-1 bg-stone-50` with no grid background

**React Flow Node Styles (TreeNode.jsx):**

| Level | Tailwind classes |
|-------|-----------------|
| root | `bg-stone-800 text-white rounded-lg px-3 py-2 shadow-lifted` |
| chapter | `bg-stone-600 text-white rounded-lg px-3 py-2 shadow-card` |
| section | `bg-white text-stone-700 border border-stone-300 rounded-lg px-3 py-2 shadow-card` |
| leaf | `bg-coral-50 text-stone-700 border border-coral-200 rounded-lg px-3 py-2` |

Traversal highlighted nodes: `ring-2 ring-coral-400 bg-coral-100`

**NodeDrawer.jsx** — slides in on node click:
- Desktop: `fixed right-0 top-14 h-[calc(100vh-3.5rem)] w-96 bg-white shadow-xl border-l border-stone-200 z-40 overflow-y-auto p-5`
- Mobile: full-screen `fixed inset-0 z-50 bg-white overflow-y-auto p-5`
- Contents: level badge (coloured pill), page range, full summary, children count, node token count

#### Chat Area

Container: `flex-1 flex flex-col overflow-hidden`

Messages scroll area: `flex-1 overflow-y-auto px-4 py-6 space-y-6`

**User message:** `ml-auto max-w-[80%] sm:max-w-[70%] bg-coral-400 text-white rounded-xl rounded-tr-sm px-4 py-3 font-body text-sm`

**Assistant message:** `mr-auto max-w-[80%] sm:max-w-[70%] bg-white border border-stone-200 rounded-xl rounded-tl-sm px-4 py-3 font-body text-sm text-stone-800`
- Content: `react-markdown` with Tailwind prose classes for headings, lists, and code

**Source Chunks (below each assistant message):**
- Toggle: `text-stone-400 hover:text-coral-500 text-xs cursor-pointer flex items-center gap-1 mt-2`
  - "📎 4 sources retrieved" → "📎 4 sources ▲" when open
- Expanded (Framer Motion `AnimatePresence` + `motion.div` with height animation):
  - Each chunk: `bg-stone-50 border border-stone-200 rounded-lg p-3 mt-1`
    - Page badge: `bg-coral-100 text-coral-700 text-xs rounded-full px-2 py-0.5 mr-2`
    - Rerank score (RAG): `text-stone-400 text-xs`
    - Tree path (VL): `text-stone-400 text-xs` — "root → chapter → leaf"
    - Text: `font-mono text-xs text-stone-600 mt-2 line-clamp-4` with "Show more" toggle

**TokenBadge (below each assistant message):**
`bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 mt-2 text-xs text-stone-500 flex flex-wrap gap-x-4 gap-y-1`
- `⚡ {total} tokens`
- `📥 {prompt} prompt · 📤 {completion} output`
- `⏱ {retrieval_ms}ms`
- Vectorless only: `🌿 +{ingestion_tokens} ingestion = {grand_total} grand total`

#### Mode Selector

**Desktop:** Inline segmented control left of the send button.
```
┌──────────┬─────────────┬──────────┐
│  RAG     │  Vectorless │ ⚡Compare│
└──────────┴─────────────┴──────────┘
```
Active: `bg-coral-400 text-white`
Inactive: `bg-stone-100 text-stone-600 hover:bg-stone-200`

**Mobile:** Compact dropdown button that opens a bottom sheet (`fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-xl shadow-xl p-4`) with the three mode options as large tappable rows.

#### Input Bar
`bg-white border-t border-stone-200 sticky bottom-0 p-3 flex gap-2 items-end`
- Textarea: `flex-1 resize-none rounded-xl border border-stone-300 focus:ring-2 focus:ring-coral-300 focus:border-coral-400 px-4 py-3 font-body text-sm text-stone-800 min-h-[44px] max-h-40 bg-stone-50`
- Send button: `bg-coral-400 hover:bg-coral-500 text-white rounded-xl p-3 shadow-coral transition-colors flex-shrink-0` + `ArrowUp` icon

---

### 9.5 Compare Mode Layout

When mode = `compare`, the chat messages area shows a two-panel split per exchange.

**≥ 768px:** `grid grid-cols-2 gap-4`
**< 768px:** `flex flex-col gap-4` (RAG on top, Vectorless below)

Each panel:
- RAG: `bg-rag-light border-t-2 border-rag-DEFAULT rounded-xl p-4`
- Vectorless: `bg-vectorless-light border-t-2 border-vectorless-DEFAULT rounded-xl p-4`

Panel header:
- Pipeline name + colour dot
- `⏱ {ms}ms · ⚡ {tokens} tokens` — updates live as streaming progresses
- Vectorless: extra line `🌿 +{ingestion} ingestion`
- 🏆 badge (appears on the faster panel when both complete)

Both panels stream simultaneously; sources and token badges appear below each panel when their pipeline finishes.

---

## 10. PDF Storage

**Service: Uploadthing** (`https://uploadthing.com`)

> **Architecture note (updated):** Uploadthing does not provide a Python/FastAPI adapter — it only supports Node.js runtimes. The file router therefore lives in **`frontend/api/uploadthing.js`**, which Vercel automatically serves as a serverless function at `/api/uploadthing`. In local development, a small Express server runs at `localhost:3001` and Vite proxies `/api/uploadthing` to it. FastAPI never handles the file upload — it only receives the permanent URL afterward.

**Upload flow:**
1. User selects PDF in `DropZone.jsx`.
2. `@uploadthing/react` SDK (`useUploadThing`) uploads the file to Uploadthing's CDN via the route handler at `/api/uploadthing`.
3. Uploadthing returns `{ url, fileKey }` in the `onClientUploadComplete` callback.
4. Frontend sends `POST /ingest` with `{ file_url, file_key, session_id }` to FastAPI.
5. FastAPI stores these in `meta.json` and downloads the PDF from the URL using `httpx` during ingestion.

**Key details:**
- Free tier: 2GB storage, no request limits.
- Single `UPLOADTHING_TOKEN` env var (v7 JWT format) — used by the file router. **Not** stored in FastAPI backend env.
- Max file size: 25MB, enforced in the file router config.
- `fileKey` stored in `meta.json` for later deletion via Uploadthing REST API (called from FastAPI).

**URL paste flow:** Backend downloads file directly from the public URL. `fileKey` is `null`; no Uploadthing cleanup needed on session delete.

---

## 11. Session Management & Delete Flow

**Session ID:** `uuid4` generated client-side at upload.
- Stored in `localStorage` under `ragbench_session_id`.
- Sent as JSON body field with every API call.
- Validated as UUID4 on every backend endpoint.

**Session-scoped data:**
- Pinecone: namespace = `session_id`
- Disk: `sessions/{session_id}/` — `meta.json`, `bm25.pkl`, `tree.json`, `tree_nodes.json`

**Delete Flow:**
1. User clicks trash icon → confirmation modal.
2. On confirm → `DELETE /session/{session_id}`:
   - `index.delete(delete_all=True, namespace=session_id)` on Pinecone
   - Delete `sessions/{session_id}/` directory
   - If `file_key` is not null → call Uploadthing delete API
3. Frontend: clear Zustand stores → clear `localStorage` → navigate to `/`.

**Known limitation:** `sessions/` directory on Render's free tier is ephemeral — it resets on deploy/restart. Session tree files and BM25 pickles will be lost on Render restart. Pinecone data is unaffected (cloud). The frontend handles this gracefully by detecting a 404 on `/session/{id}/meta` and redirecting to `/` with a toast: "Previous session not found. Please upload a new document." For a more robust solution, `sessions/` files can be moved to Supabase Storage free tier (1GB).

---

## 12. API Contract

### `POST /ingest`
```json
Request:
{ "file_url": "https://utfs.io/f/abc.pdf", "file_key": "abc", "session_id": "uuid4" }

Response (202 Accepted):
{ "session_id": "uuid4", "status": "ingesting" }
```

### `GET /ingest/progress?session_id={id}`
SSE stream. Events per pipeline as defined in Section 5.

### `GET /tree?session_id={id}`
```json
{
  "nodes": [
    { "id": "node_001", "level": "root", "title": "Document Root",
      "summary": "...", "page_range": [1, 42],
      "children": ["node_002", "node_003"], "raw_text": null, "token_count": 180 }
  ],
  "edges": [{ "source": "node_001", "target": "node_002" }],
  "ingestion_tokens": 4821,
  "total_nodes": 31,
  "depth": 4
}
```

### `GET /session/{id}/meta`
```json
{
  "session_id": "...", "file_url": "...", "chunk_count": 142, "page_count": 28,
  "vectorless_ingestion_tokens": 4821, "created_at": "..."
}
```

### `POST /query/rag`
```
Request: { "question": "...", "session_id": "..." }

SSE Events:
{ "type": "token",   "content": "The paper..." }
{ "type": "sources", "chunks": [{ "text": "...", "page_number": 4, "rerank_score": 0.91 }] }
{ "type": "usage",   "prompt_tokens": 248, "completion_tokens": 64,
                     "total_tokens": 312, "retrieval_ms": 1240 }
{ "type": "done" }
```

### `POST /query/vectorless`
```
Request: { "question": "...", "session_id": "..." }

SSE Events:
{ "type": "token",  "content": "According to..." }
{ "type": "path",   "node_ids": ["node_001", "node_003", "node_009"],
                    "node_summaries": { "node_001": "..." } }
{ "type": "usage",  "traversal_tokens": 120,
                    "generation_prompt_tokens": 210, "generation_completion_tokens": 80,
                    "total_query_tokens": 410, "ingestion_tokens": 4821,
                    "grand_total_tokens": 5231, "retrieval_ms": 890 }
{ "type": "done" }
```

### `POST /query/compare`
```
Request: { "question": "...", "session_id": "..." }

SSE Events (both pipelines multiplexed):
{ "pipeline": "rag",        "type": "token",   "content": "..." }
{ "pipeline": "vectorless", "type": "token",   "content": "..." }
{ "pipeline": "rag",        "type": "usage",   ...rag_usage_fields... }
{ "pipeline": "vectorless", "type": "usage",   ...vectorless_usage_fields... }
{ "pipeline": "rag",        "type": "done" }
{ "pipeline": "vectorless", "type": "done" }
```

### `DELETE /session/{session_id}`
```json
{ "status": "deleted", "session_id": "..." }
```

---

## 13. Deployment Guide

### Architecture Summary
```
GitHub repo
├── frontend/  → Vercel  (CDN-hosted static React app)
└── backend/   → Render  (Python FastAPI web service)
```

### 13.1 Backend — Render

1. **Service type:** Web Service
2. **Root directory:** `backend/`
3. **Build command:** `pip install -r requirements.txt`
4. **Start command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. **Plan:** Free

**`render.yaml`:**
```yaml
services:
  - type: web
    name: ragbench-backend
    runtime: python
    rootDir: backend
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
    plan: free
    envVars:
      - key: ENVIRONMENT
        value: production
      - key: GROQ_API_KEY
        sync: false
      - key: PINECONE_API_KEY
        sync: false
      - key: UPLOADTHING_SECRET
        sync: false
      - key: UPLOADTHING_APP_ID
        sync: false
```

**CORS (`main.py`):**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://your-app.vercel.app",   # update after Vercel deploy
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Cold-start notice:** Render free tier spins down after 15 min inactivity. First request after spin-down takes ~30s. The frontend detects this: if `/ingest` takes > 6s to respond, show a toast: "☕ Waking up backend, this may take a moment..."

---

### 13.2 Frontend — Vercel

1. Import GitHub repo into Vercel.
2. **Root directory:** `frontend/`
3. **Build command:** `npm run build`
4. **Output directory:** `dist`
5. **Environment variable:** `VITE_BACKEND_URL` = Render service URL

**`vercel.json`:**
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

---

### 13.3 Local Development

```bash
# Terminal 1 — Backend
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env    # fill in all keys
uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm install
cp .env.example .env    # set VITE_BACKEND_URL=http://localhost:8000
npm run dev
```

---

## 14. Implementation Phases

Build in this exact order. Each phase has a clear, testable deliverable before moving on. This sequence minimises rework by establishing the lowest layers first.

---

### Phase 0 — Project Scaffolding *(~1 day)*
**Goal:** Both repos boot, connect, and deploy with placeholder pages.

- [ ] Init `frontend/` with `npm create vite@latest` (React + JS template)
- [ ] Install and configure TailwindCSS; populate `tailwind.config.js` with full token set from Section 3.1
- [ ] Add Google Fonts to `index.html`
- [ ] Install all frontend deps: `zustand axios framer-motion lucide-react react-router-dom react-markdown remark-gfm @xyflow/react @uploadthing/react`
- [ ] Create `src/config/app.config.js`, `src/constants/strings.js`
- [ ] Create placeholder pages with routing (`/`, `/ingest`, `/chat`)
- [ ] Init `backend/` with FastAPI + `config/settings.py` + `GET /health → {"status":"ok"}`
- [ ] Install all backend deps and write `requirements.txt`
- [ ] Configure CORS in `main.py`
- [ ] Write `render.yaml` and `vercel.json`
- [ ] Deploy both to Render + Vercel
- [ ] Confirm frontend calls `GET /health` on deployed backend successfully

**✅ Deliverable:** Both services live. Frontend shows placeholder. CORS confirmed working.

---

### Phase 1 — Upload & Session Creation *(~1 day)*
**Goal:** User can upload a PDF or paste a URL and a session is created.

- [ ] Create Uploadthing account; configure file router in backend
- [ ] Build `DropZone.jsx` and `UrlInput.jsx` with drag-and-drop and URL validation
- [ ] Style Landing Page fully per Section 9.2 spec
- [ ] Implement `POST /ingest` endpoint (accept payload, create `meta.json`, return 202 immediately)
- [ ] Implement session ID generation on frontend, persist to `localStorage`
- [ ] Wire Uploadthing React SDK to `DropZone.jsx`
- [ ] Build `useSessionStore` Zustand slice
- [ ] Test: upload PDF → backend creates session → redirect to `/ingest`

**✅ Deliverable:** File upload works end-to-end. Session created. Redirect works.

---

### Phase 2 — RAG Ingestion Pipeline *(~1.5 days)*
**Goal:** Uploaded PDF is parsed, chunked, embedded, and indexed in Pinecone.

- [ ] Implement `pdf_parser.py` (pdfplumber + pypdf fallback, page metadata)
- [ ] Implement `semantic_chunker.py` (SemanticChunker + local SentenceTransformer embeddings)
- [ ] Create Pinecone account; create serverless index (384 dims, cosine, aws/us-east-1)
- [ ] Implement `pinecone_indexer.py` (batched upsert, namespace = session_id)
- [ ] Implement `bm25_indexer.py` (BM25Okapi + pickle)
- [ ] Wire into `asyncio.gather` background task; emit SSE progress events
- [ ] Implement `GET /ingest/progress` SSE endpoint
- [ ] Build `IngestionPage.jsx` with `ProgressColumn.jsx` and `StepIndicator.jsx`
- [ ] Build `useSSE.js` and `useIngestion.js` hooks
- [ ] Test: upload → watch step-by-step RAG progress → Pinecone shows vectors

**✅ Deliverable:** RAG ingestion fully functional. Vectors live in Pinecone.

---

### Phase 3 — Vectorless Ingestion + Tree Visualization *(~1.5 days)*
**Goal:** Document tree is built and interactively visible in the frontend.

- [ ] Implement `tree_builder.py` (bottom-up summarization, Groq calls, token tracking, `asyncio.sleep` between batches to respect Groq rate limits)
- [ ] Implement `TokenCounter` in `core/token_counter.py`
- [ ] Serialize `tree.json` and `tree_nodes.json`; write ingestion tokens to `meta.json`
- [ ] Implement `GET /tree` and `GET /session/{id}/meta` endpoints
- [ ] Build `DocumentTree.jsx` with React Flow (custom `TreeNode` components per level, collapsible)
- [ ] Build `NodeDrawer.jsx` (slides in on node click)
- [ ] Add tree stats header and ingestion token pill in sidebar
- [ ] Wire `useTreeStore` Zustand slice
- [ ] Test: ingestion completes → tree renders in sidebar → nodes expand/collapse → node drawer opens

**✅ Deliverable:** Full interactive document tree working.

---

### Phase 4 — RAG Query Pipeline *(~1.5 days)*
**Goal:** User can ask a question in RAG mode and get a streamed answer with sources.

- [ ] Implement `hybrid_retriever.py` (BM25 + Pinecone dense → RRF fusion)
- [ ] Implement `reranker.py` (cross-encoder scoring, top-k selection)
- [ ] Implement `context_expander.py` (neighbor chunk fetch from Pinecone)
- [ ] Implement `RAGPipeline` class with LCEL chain
- [ ] Implement `POST /query/rag` with SSE streaming (token / sources / usage / done events)
- [ ] Build `ChatArea.jsx`, `MessageBubble.jsx`, `InputBar.jsx`
- [ ] Build `SourceChunks.jsx` (Framer Motion AnimatePresence expand/collapse)
- [ ] Build `TokenBadge.jsx`
- [ ] Build `ModeSelector.jsx` (segmented control; bottom sheet on mobile)
- [ ] Build `useChatStore` and `useQuery.js` hook to consume SSE stream
- [ ] Test: RAG mode → answer streams → sources expand → token badge shows correct counts

**✅ Deliverable:** RAG mode fully functional end-to-end.

---

### Phase 5 — Vectorless Query Pipeline *(~1 day)*
**Goal:** Vectorless mode works and highlights the traversal path in the tree.

- [ ] Implement `tree_traversal.py` (LLM nav prompt, multi-branch descent, token tracking)
- [ ] Implement `VectorlessPipeline` class with LCEL chain
- [ ] Implement `POST /query/vectorless` SSE (token / path / usage / done events)
- [ ] Connect `type: "path"` SSE events to `treeStore` → highlight traversed nodes in React Flow
- [ ] Add grand total row to `TokenBadge` for vectorless responses
- [ ] Test: Vectorless mode → answer streams → correct nodes light up in tree → token grand total shown

**✅ Deliverable:** Vectorless mode fully functional with visual traversal highlighting.

---

### Phase 6 — Compare Mode *(~1 day)*
**Goal:** Both pipelines run in parallel with real-time side-by-side results.

- [ ] Implement `POST /query/compare` (asyncio.gather, multiplexed SSE with `pipeline` tag)
- [ ] Build `CompareLayout.jsx` (CSS grid 2-col on ≥md, stacked on mobile)
- [ ] Route multiplexed SSE events to correct panel in frontend
- [ ] Show retrieval time and token counts per panel, updating live
- [ ] Add 🏆 badge on the faster panel when both complete
- [ ] Test: Compare mode → both panels stream simultaneously → correct metrics per panel

**✅ Deliverable:** Compare mode works with real-time parallel output.

---

### Phase 7 — Responsive Polish & Session Lifecycle *(~1.5 days)*
**Goal:** Production-quality UI across all screen sizes; clean session lifecycle.

- [ ] Implement `DELETE /session/{id}` (Pinecone namespace delete + file cleanup + Uploadthing delete)
- [ ] Build confirmation modal + delete flow on frontend
- [ ] Handle Render ephemeral session loss gracefully (404 on meta → redirect to `/` with toast)
- [ ] Handle Render cold-start delay (timeout detection → "☕ Waking up..." toast)
- [ ] Full responsive audit at 320px, 375px, 768px, 1024px, 1280px, 1920px
- [ ] Mobile: tree as FAB → full-screen drawer
- [ ] Mobile: ModeSelector as bottom sheet
- [ ] Tablet: sidebar as overlay drawer with backdrop
- [ ] Add `ErrorBoundary.jsx` on all three pages
- [ ] Keyboard navigation and `aria-label` on all interactive elements
- [ ] Verify color contrast ratios meet WCAG AA

**✅ Deliverable:** Project is production-ready and polished on all screen sizes.

---

### Phase 8 — Testing & Documentation *(~1 day)*
**Goal:** Verified, documented, shareable project.

- [ ] `tests/test_rag_pipeline.py` — chunker, retriever, reranker unit tests
- [ ] `tests/test_vectorless_pipeline.py` — tree builder, traversal logic unit tests
- [ ] `tests/test_api.py` — integration tests for all endpoints via `httpx.AsyncClient`
- [ ] Final Render + Vercel deployment verified end-to-end with a real PDF
- [ ] Annotate `tree_builder.py` and `hybrid_retriever.py` with educational inline comments
- [ ] `README.md`: setup guide, architecture diagram, phase summary, known limitations, "what you learn" section

**✅ Deliverable:** Tested, documented, deployed project ready to share or demo.

---

## 15. Standard Practices & Code Conventions

### General
- All configuration from config files. Hard-coding is never acceptable.
- All async operations: `async/await` (JS), `async def + await` (Python).
- All API errors return `{ "error": "human message", "code": "SNAKE_CASE_CODE" }`.
- Backend logging via `loguru`; no raw `print()` in production code.

### Frontend
- All styling through Tailwind classes. No separate `.css` files except `index.css` for `@tailwind` directives and React Flow canvas overrides.
- No `style={{}}` inline styles except for dynamic values (e.g., progress bar `width` as a percentage string).
- Zustand slices: `useSessionStore`, `useChatStore`, `useTreeStore`. Each in its own file under `store/`.
- All user-facing strings in `src/constants/strings.js`.
- Every interactive element has `aria-label`. Focus rings must be visible (never `outline-none` without a replacement).
- Data fetching lives in hooks (`useQuery`, `useIngestion`, `useSSE`). Components only receive props.

### Backend
- All request/response schemas as Pydantic models in `api/schemas.py`.
- `RAGPipeline` and `VectorlessPipeline` instantiated once at FastAPI startup via `lifespan` event.
- `SessionManager` singleton manages session-scoped state (BM25 indices, cached metadata).
- No global mutable state outside `SessionManager`.
- All file I/O via `aiofiles`.

### Security
- `session_id` validated as UUID4 on every endpoint.
- File URLs pass an allowlist check (Uploadthing domain only) before backend download.
- No API keys, tokens, or secrets in any SSE response, log line, or error message sent to the client.

---

## 16. Folder Structure

```
ragbench/
├── frontend/
│   ├── public/
│   │   └── favicon.svg
│   ├── src/
│   │   ├── config/
│   │   │   └── app.config.js           ← App identity, backend URL, modes, breakpoints
│   │   ├── constants/
│   │   │   └── strings.js              ← All UI copy (i18n-ready)
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Header.jsx
│   │   │   │   └── Sidebar.jsx         ← Collapsible; overlay on tablet, FAB on mobile
│   │   │   ├── upload/
│   │   │   │   ├── DropZone.jsx
│   │   │   │   └── UrlInput.jsx
│   │   │   ├── ingestion/
│   │   │   │   ├── ProgressColumn.jsx
│   │   │   │   └── StepIndicator.jsx
│   │   │   ├── chat/
│   │   │   │   ├── ChatArea.jsx
│   │   │   │   ├── MessageBubble.jsx
│   │   │   │   ├── SourceChunks.jsx    ← Collapsible chunk viewer
│   │   │   │   ├── TokenBadge.jsx      ← Token + timing metrics display
│   │   │   │   ├── InputBar.jsx
│   │   │   │   └── ModeSelector.jsx    ← Segmented control / bottom sheet on mobile
│   │   │   ├── tree/
│   │   │   │   ├── DocumentTree.jsx    ← React Flow wrapper + layout
│   │   │   │   ├── TreeNode.jsx        ← Custom node per level
│   │   │   │   └── NodeDrawer.jsx      ← Detail panel on node click
│   │   │   ├── compare/
│   │   │   │   └── CompareLayout.jsx   ← 2-col grid (desktop), stacked (mobile)
│   │   │   └── common/
│   │   │       ├── Modal.jsx           ← Reusable confirmation modal
│   │   │       ├── ErrorBoundary.jsx
│   │   │       └── Spinner.jsx
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx
│   │   │   ├── IngestionPage.jsx
│   │   │   └── ChatPage.jsx
│   │   ├── store/
│   │   │   ├── sessionStore.js         ← session_id, file metadata
│   │   │   ├── chatStore.js            ← messages, streaming state, mode
│   │   │   └── treeStore.js            ← tree data, highlighted node IDs
│   │   ├── hooks/
│   │   │   ├── useSSE.js               ← Generic EventSource wrapper hook
│   │   │   ├── useIngestion.js         ← Ingestion SSE consumer
│   │   │   └── useQuery.js             ← Query SSE consumer (all 3 modes)
│   │   ├── utils/
│   │   │   ├── api.js                  ← Axios instance with base URL + interceptors
│   │   │   └── treeTransform.js        ← Convert API tree JSON → React Flow nodes/edges
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── api/
│   │   └── uploadthing.js              ← Uploadthing file router (Vercel serverless fn / dev Express)
│   ├── index.html                      ← Google Fonts preload + link tags here
│   ├── tailwind.config.js              ← SINGLE SOURCE OF TRUTH for all design tokens
│   ├── vite.config.js                  ← Vite config; proxies /api/uploadthing → localhost:3001 in dev
│   ├── vercel.json
│   ├── .env.example
│   └── package.json
│
├── backend/
│   ├── config/
│   │   └── settings.py                 ← ALL backend config (pydantic-settings)
│   ├── pipelines/
│   │   ├── rag_pipeline.py             ← RAGPipeline class (LCEL chain)
│   │   └── vectorless_pipeline.py      ← VectorlessPipeline class (LCEL chain)
│   ├── ingestion/
│   │   ├── pdf_parser.py               ← pdfplumber + pypdf fallback
│   │   ├── semantic_chunker.py         ← LangChain SemanticChunker + local embeddings
│   │   ├── bm25_indexer.py             ← BM25Okapi build + pickle
│   │   ├── pinecone_indexer.py         ← local embed batches + Pinecone upsert
│   │   └── tree_builder.py             ← RAPTOR-style tree + token counter
│   ├── retrieval/
│   │   ├── hybrid_retriever.py         ← BM25 + Pinecone dense → RRF fusion
│   │   ├── reranker.py                 ← cross-encoder scoring + top-k selection
│   │   ├── context_expander.py         ← neighbor chunk window expansion
│   │   └── tree_traversal.py           ← LLM-guided root-to-leaf traversal
│   ├── api/
│   │   ├── routes/
│   │   │   ├── ingest.py
│   │   │   ├── query.py
│   │   │   ├── session.py
│   │   │   └── tree.py
│   │   └── schemas.py                  ← All Pydantic request/response models
│   ├── core/
│   │   ├── session_manager.py          ← SessionManager singleton
│   │   ├── token_counter.py            ← TokenCounter utility class
│   │   └── uploadthing_client.py       ← Uploadthing file delete helper
│   ├── tests/
│   │   ├── test_rag_pipeline.py
│   │   ├── test_vectorless_pipeline.py
│   │   └── test_api.py
│   ├── sessions/                       ← Runtime: meta.json, bm25.pkl, tree files per session
│   ├── main.py                         ← FastAPI app, lifespan, CORS, router registration
│   ├── requirements.txt
│   ├── render.yaml
│   ├── .env.example
│   └── .env                            ← Git-ignored
│
└── README.md
```

---

## 17. Environment Variables

### Backend `.env`
```env
# App
ENVIRONMENT=local
DEBUG=true

# Groq (LLM)
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama3-70b-8192

# Local Embeddings (no API key needed — model downloads automatically on first run)
LOCAL_EMBED_MODEL=sentence-transformers/all-MiniLM-L6-v2

# Pinecone (Vector DB)
PINECONE_API_KEY=pcsk_...
PINECONE_INDEX_NAME=ragbench
PINECONE_CLOUD=aws
PINECONE_REGION=us-east-1

# Uploadthing (PDF Storage)
UPLOADTHING_SECRET=sk_live_...
UPLOADTHING_APP_ID=your_app_id

# Chunking
SEMANTIC_BREAKPOINT_THRESHOLD=95.0
CHUNK_OVERLAP_TOKENS=50

# Retrieval — RAG
HYBRID_SEARCH_ALPHA=0.7
TOP_K_RETRIEVAL=10
TOP_K_AFTER_RERANK=4

# Vectorless Tree
TREE_MAX_DEPTH=4
TREE_BRANCHING_FACTOR=5
TREE_MAX_SELECT_PER_LEVEL=2
PAGINATION_CHARS_PER_PAGE=3000
TREE_SUMMARY_MAX_WORDS=200

# Sessions
SESSION_STORAGE_PATH=./sessions
```

### Backend `.env` — Uploadthing note
```env
# UPLOADTHING_TOKEN is NOT needed in the backend .env.
# The Uploadthing file router lives in frontend/api/uploadthing.js.
# FastAPI only receives the resulting file URL; it uses UPLOADTHING_TOKEN
# only for the file-delete helper (core/uploadthing_client.py) in Phase 7.
```

### Frontend `.env` (local development)
```env
VITE_BACKEND_URL=http://localhost:8000
UPLOADTHING_TOKEN=eyJhcGlLZXkiOiJza19saXZlX...   # used by api/uploadthing.js Express dev server
```

### Frontend (Vercel dashboard — set as environment variables)
```
VITE_BACKEND_URL=https://ragbench-backend.onrender.com
UPLOADTHING_TOKEN=eyJhcGlLZXkiOiJza19saXZlX...   # used by the Vercel serverless function
```

> **Dev workflow:** Run `npm run dev:all` in the `frontend/` directory. This starts Vite on port 5173 and the Uploadthing Express handler on port 3001 concurrently. Vite proxies `/api/uploadthing` to `localhost:3001`.

---

## 18. Glossary

| Term | Definition |
|------|------------|
| **RAG** | Retrieval-Augmented Generation — enhancing LLM responses with retrieved document chunks |
| **Vectorless RAG** | RAG without a vector database; uses document structure and LLM reasoning to navigate a hierarchical tree |
| **RAPTOR** | Recursive Abstractive Processing for Tree-Organized Retrieval — academic inspiration for the vectorless tree strategy |
| **Hybrid Search** | Combining dense (vector cosine) and sparse (BM25 keyword) retrieval for improved recall |
| **RRF** | Reciprocal Rank Fusion — algorithm to merge multiple ranked lists without requiring score normalisation |
| **Cross-encoder** | Model that scores (query, document) pairs jointly — more accurate than bi-encoder dot-product |
| **Contextual Compression** | Expanding retained chunks with adjacent chunks (±1) to avoid information loss at boundaries |
| **Semantic Chunking** | Splitting text at semantically meaningful boundaries detected by embedding similarity drops |
| **BM25** | Best Match 25 — probabilistic sparse retrieval based on term frequency and document length normalisation |
| **Local Embeddings** | `sentence-transformers/all-MiniLM-L6-v2` — no API key, 384-dimensional, runs on CPU |
| **Pinecone** | Cloud-hosted vector database; free serverless tier (2GB, 1 index); sessions isolated as namespaces |
| **SSE** | Server-Sent Events — one-way server-to-client streaming protocol over HTTP |
| **LCEL** | LangChain Expression Language — pipe-operator declarative chain composition |
| **Session** | One user's isolated document context; all data scoped to a UUID4 per upload |
| **Ingestion** | Parsing, chunking, embedding, and indexing a document before any queries are made |
| **Tree Traversal** | Vectorless retrieval: LLM navigates root-to-leaf through summarized nodes to find relevant content |
| **Branching Factor** | Maximum number of children per node in the vectorless document tree |
| **Grand Total Tokens** | Vectorless only: ingestion tokens + traversal tokens + generation tokens for a given query |
| **TokenBadge** | Frontend component displaying token counts and latency metrics below each assistant message |
| **TokenCounter** | Backend utility class tracking prompt + completion tokens across ingestion and query phases |
| **Render** | Cloud platform hosting the FastAPI backend on its free Web Service tier |
| **Vercel** | Cloud platform hosting the React frontend as a CDN-distributed static site |
| **Uploadthing** | Developer-first file hosting service; free tier provides permanent URLs for uploaded PDFs |
| **Coral** | The brand identity colour of RAGBench — a warm terracotta/coral used on primary buttons and key accents |

---

*End of Blueprint — RAGBench v2.0*
*Single source of truth. All implementation decisions must trace back to a section here.*
*Updated: TailwindCSS · Local SentenceTransformer Embeddings · Pinecone · Token tracking · Responsive UI · Coral brand identity · 8-phase implementation plan · No rate limiting*
