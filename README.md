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
