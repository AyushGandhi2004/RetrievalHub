from pydantic_settings import BaseSettings
from pydantic import AliasChoices, Field
from typing import Literal


class Settings(BaseSettings):
    # ── APP ───────────────────────────────────────────────────────────────────
    app_name:    str  = "RAGBench"
    debug:       bool = False
    environment: Literal["local", "production"] = "local"

    # ── GROQ (LLM) ────────────────────────────────────────────────────────────
    groq_api_key:     str = ""
    groq_model:       str   = "llama3-70b-8192"
    groq_temperature: float = 0.2
    groq_max_tokens:  int   = 1024

    # ── LOCAL EMBEDDINGS ─────────────────────────────────────────────────────
    local_embed_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    local_embed_dim:   int = 384

    # ── PINECONE (VECTOR DB) ──────────────────────────────────────────────────
    pinecone_api_key:    str = ""
    pinecone_index_name: str = "ragbench"
    pinecone_cloud:      str = "aws"
    pinecone_region:     str = "us-east-1"

    # ── UPLOADTHING (PDF STORAGE) ─────────────────────────────────────────────
    # v7 token — single JWT that encodes app ID + API key
    uploadthing_token: str = Field(
        default="",
        validation_alias=AliasChoices("UPLOADTHING_TOKEN", "UPLOADTHING_SECRET"),
    )

    # ── SEMANTIC CHUNKING ─────────────────────────────────────────────────────
    chunk_strategy:                str   = "semantic"
    semantic_breakpoint_type:      str   = "percentile"
    semantic_breakpoint_threshold: float = 95.0
    chunk_overlap_tokens:          int   = 50

    # ── RETRIEVAL — RAG ───────────────────────────────────────────────────────
    hybrid_search_alpha: float = 0.7
    top_k_retrieval:     int   = 10
    top_k_after_rerank:  int   = 4
    rag_context_token_budget: int = 8000
    rag_chunk_char_budget:    int = 1800

    # ── VECTORLESS TREE ───────────────────────────────────────────────────────
    tree_max_depth:            int = 4
    tree_branching_factor:     int = 5
    tree_max_select_per_level: int = 2
    pagination_chars_per_page: int = 3000
    tree_summary_max_words:    int = 200
    tree_ingestion_model:      str = "llama-3.3-70b-versatile"
    tree_ingestion_max_tokens: int = 192
    tree_ingestion_content_chars: int = 2500

    # ── SESSIONS ──────────────────────────────────────────────────────────────
    session_storage_path: str = "./sessions"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
