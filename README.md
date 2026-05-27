# RetrievalHub

An interactive educational web app that compares **Traditional RAG** against **Vectorless RAG** side-by-side on any PDF you upload.

## What you learn

| Concept | Where it shows up |
|---|---|
| Semantic chunking vs. layout-aware pagination | Ingestion pipeline |
| Local vector embeddings (SentenceTransformers) + Pinecone namespaces | Traditional RAG retrieval |
| BM25 sparse retrieval | Hybrid search |
| Reciprocal Rank Fusion (RRF) | Score fusion |
| Cross-encoder re-ranking | Re-ranking step |
| RAPTOR-style bottom-up tree | Vectorless ingestion |
| LLM-guided tree traversal | Vectorless retrieval |
| Token cost transparency | TokenBadge in every response |

## Architecture

```
┌─────────────────── Frontend (React + Vite) ───────────────────┐
│  LandingPage → IngestionPage → ChatPage                       │
│  DropZone / UrlInput  →  Uploadthing serverless fn (Vercel)   │
│  DocumentTree (@xyflow)  ·  CompareLayout  ·  ModeSelector    │
└───────────────────────────┬───────────────────────────────────┘
                            │ REST + SSE
┌───────────────────────────▼───────────────────────────────────┐
│  Backend (FastAPI / Render)                                    │
│                                                                │
│  POST /ingest ──► pdf_parser ──► semantic_chunker             │
│                           ├──► bm25_indexer (pickle)          │
│                           ├──► pinecone_indexer (embeddings)  │
│                           └──► tree_builder (RAPTOR tree)     │
│                                                                │
│  POST /query/rag        ──► hybrid_retriever (BM25 + dense)   │
│                              reranker (CrossEncoder)           │
│                              context_expander (±1 neighbor)   │
│                              Groq LLM (streaming SSE)         │
│                                                                │
│  POST /query/vectorless ──► tree_traversal (LLM-guided)       │
│                              Groq LLM (streaming SSE)         │
│                                                                │
│  POST /query/compare    ──► both pipelines via asyncio.gather  │
│                              multiplexed SSE tagged pipeline:  │
└────────────────────────────────────────────────────────────────┘
```

## Overview & Purpose

RetrievalHub is an interactive web app designed to compare Traditional RAG (vector-based retrieval) and Vectorless RAG (tree-based, LLM-guided retrieval) side-by-side on any PDF you upload. The goal is educational: to help developers, researchers, and students understand trade-offs between retrieval strategies (accuracy, latency, token cost, and provenance) and to debug or tune retrieval pipelines.

## How it works (high level)

- Ingestion: Uploaded PDFs are parsed and processed by the ingestion pipeline into three primary artifacts: a BM25 sparse index (pickle), a Pinecone dense-embedding namespace (per session), and a RAPTOR-style bottom-up tree JSON for vectorless traversal.
- Querying: The frontend can send queries to `/query/rag` (hybrid retriever: BM25 + dense + cross-encoder re-ranker) or `/query/vectorless` (LLM-guided tree traversal). Responses stream back over SSE so you see the LLM output incrementally.

## Metrics shown in the UI (exact fields)

The frontend displays metrics that are emitted by the backend over SSE. These are the exact field names and their meanings as produced by the RAG and Vectorless pipelines and the ingestion progress stream.

- `prompt_tokens`: Number of tokens in the LLM input (generation prompt) produced for the query/generation step.
- `completion_tokens`: Number of tokens returned by the LLM as output for the generation step.
- `total_tokens`: Sum of `prompt_tokens + completion_tokens`. For RAG this is the model usage for the single generation call.
- `retrieval_ms`: Milliseconds spent in the retrieval phase (BM25/Pinecone retrieval + reranking or tree traversal timing measured before model generation). This is NOT the end-to-end time but the retrieval-only latency.

- Vectorless-specific fields (sent in addition to the above):
    - `traversal_tokens`: Tokens consumed by the LLM during the iterative tree traversal phase (used to build/score summaries while walking the tree).
    - `generation_prompt_tokens` / `generation_completion_tokens`: The generation-phase usage when the final answer is produced (these map to `prompt_tokens`/`completion_tokens` in the UI for Vectorless flows).
    - `total_query_tokens`: Sum of traversal + generation tokens for the query (i.e. how many tokens the query consumed excluding ingestion).
    - `ingestion_tokens`: Tokens consumed during tree-building / ingestion (persisted in `meta.json` as `vectorless_ingestion_tokens`). This reflects cost paid at ingestion time, not per-query.
    - `grand_total_tokens`: `ingestion_tokens + total_query_tokens` — an aggregate that includes ingestion + query usage for Vectorless sessions.

- Ingestion / pipeline progress fields:
    - `elapsed_ms`: Milliseconds elapsed since the ingestion pipeline started (used in ingestion SSE progress events).
    - `tokens_used` (in ingestion messages): A friendly summary number emitted when the tree build completes (same value as `vectorless_ingestion_tokens`).
    - `chunk_count` / `page_count`: Counts emitted during ingestion for visibility into document splitting and indexing.

Notes / mapping to UI components:
- The `TokenBadge` component displays: `total_tokens`, `prompt_tokens`, `completion_tokens`, `retrieval_ms`, and for vectorless flows `ingestion_tokens` and `grand_total_tokens`.
- The RAG pipeline emits a `usage` event with `prompt_tokens`, `completion_tokens`, `total_tokens`, and `retrieval_ms` (see `backend/pipelines/rag_pipeline.py`).
- The Vectorless pipeline emits richer usage with `traversal_tokens`, `generation_*` tokens, `total_query_tokens`, `ingestion_tokens`, `grand_total_tokens`, and `retrieval_ms` (see `backend/pipelines/vectorless_pipeline.py`).
- The ingestion SSE (`/ingest/progress`) emits `meta.elapsed_ms` plus occasional `tokens_used`, `chunk_count`, and `page_count` while building indices/trees (see `backend/api/routes/ingest.py`).

How to interpret these numbers:
- `prompt_tokens` and `completion_tokens` are the canonical per-request model-usage counters (input vs output). `total_tokens` is their sum and maps to any token-cost estimates.
- `retrieval_ms` isolates retrieval latency so you can compare how much time was spent finding evidence vs generating an answer.
- `traversal_tokens` and `total_query_tokens` show how much token budget the Vectorless strategy used during evidence retrieval + final generation; compare `total_query_tokens` across pipelines to judge per-query efficiency.
- `ingestion_tokens` and `grand_total_tokens` are useful for lifecycle cost analysis — ingestion is a one-time cost per document/session, while query tokens are per-query.

If you'd like, I can update the UI tooltips and the Compare layout descriptions to show these exact field names and short definitions inline (e.g., a tooltip for the `TokenBadge`).

## The Document Tree (Vectorless view)

The Vectorless pipeline builds a document tree that captures layout-aware, bottom-up structure (RAPTOR-style). The UI visualizes this tree and provides interaction affordances:

- Nodes represent document chunks or layout blocks and show short text excerpts and token counts.
- Traversal highlights which nodes the LLM inspected when answering a query, making provenance explicit.
- You can expand/collapse branches and inspect node metadata (page, offsets, token counts, and any available scores).

Why the tree matters: it enables focused, layout-aware retrieval without dense vectors, often lowering token usage and improving explainability of retrieved evidence.


## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TailwindCSS v3, Framer Motion, @xyflow/react |
| Backend | FastAPI, Python 3.11, Uvicorn |
| LLM | Groq (`llama3-70b-8192`) |
| Embeddings | Local `sentence-transformers/all-MiniLM-L6-v2` (384-dim, no API key) |
| Vector DB | Pinecone (serverless, one namespace per session) |
| File storage | Uploadthing v7 |
| Deploy | Vercel (frontend) + Render free tier (backend) |

## Setup

### Prerequisites

- Node.js ≥ 18
- Python 3.11
- Accounts with API keys for: Groq, Pinecone, Uploadthing

### Backend

```bash
cd backend
python -m venv venv
# Windows:  venv\Scripts\activate
# macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
GROQ_API_KEY=gsk_...
PINECONE_API_KEY=pcsk_...
PINECONE_INDEX_NAME=ragbench
UPLOADTHING_TOKEN=<base64url JWT from Uploadthing dashboard>
# Embeddings run locally — no API key needed
# LOCAL_EMBED_MODEL=sentence-transformers/all-MiniLM-L6-v2  (this is the default)
```

```bash
cd backend
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
VITE_API_BASE_URL=http://localhost:8000
UPLOADTHING_TOKEN=<same token as backend>
```

Start the Uploadthing dev server (runs on port 3001, proxied by Vite):

```bash
node api/uploadthing.js &
npm run dev
```

Open `http://localhost:5173`.

## Running tests

```bash
cd backend
pytest
```

Tests run fully in-process — no real API keys or network required.

## Deployment

**Frontend → Vercel**

Push the `frontend/` directory. Set environment variables in the Vercel dashboard:

```
VITE_API_BASE_URL=https://<your-render-service>.onrender.com
UPLOADTHING_TOKEN=<token>
```

The `frontend/vercel.json` rewrites handle SPA routing and proxy `/api/uploadthing` to the Vercel serverless function at `frontend/api/uploadthing.js`.

**Backend → Render**

Connect the `backend/` directory. Set environment variables in the Render dashboard (see `backend/render.yaml` for the full list). The free tier cold-starts in ~30 s — the UI shows a toast after 6 s of waiting.

## Known limitations

- **Render cold starts**: First request after inactivity takes ~30 s. The frontend shows a "Waking up backend…" toast.
- **Session storage is ephemeral on Render**: Sessions (BM25 pickle, tree JSON) are lost on service restart. The UI detects this and redirects to the landing page with a warning.
- **Groq rate limits**: Free tier TPM quota may cause 429 errors during ingestion of very large PDFs. The tree builder includes a 300 ms inter-call sleep as a guard.
- **Pinecone free tier**: One index, serverless. All sessions share the index isolated by namespace.
