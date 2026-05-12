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
  treeLayout:     'TB',
  treeNodeWidth:  220,
  treeNodeHeight: 80,

  // ── BREAKPOINTS ───────────────────────────────────────────────────────────
  breakpoints: { sm: 640, md: 768, lg: 1024, xl: 1280 },
};
