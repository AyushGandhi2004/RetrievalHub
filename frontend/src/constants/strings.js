export const STRINGS = {
  // ── BRAND ─────────────────────────────────────────────────────────────────
  APP_NAME:    'RAGBench',
  APP_TAGLINE: 'Compare RAG paradigms on your own documents',

  // ── LANDING PAGE ──────────────────────────────────────────────────────────
  UPLOAD_HEADING:       'Analyse your document',
  UPLOAD_SUBHEADING:    'Upload a PDF or paste a public link to get started.',
  DROP_ZONE_IDLE:       'Drop your PDF here, or click to browse',
  DROP_ZONE_ACTIVE:     'Release to upload',
  DROP_ZONE_UPLOADING:  'Uploading…',
  URL_INPUT_PLACEHOLDER:'Paste a public PDF URL…',
  UPLOAD_CTA:           'Analyse Document',
  UPLOAD_CAPTION:       'PDF only · Max 25 MB',
  OR_DIVIDER:           'or',

  // ── INGESTION PAGE ────────────────────────────────────────────────────────
  INGESTION_HEADING:         'Processing your document',
  INGESTION_SUBHEADING:      'Both pipelines run in parallel. This usually takes 4-5 minutes.',
  INGESTION_CTA:             'Explore Your Document →',
  PIPELINE_RAG_LABEL:        'Traditional RAG',
  PIPELINE_VECTORLESS_LABEL: 'Vectorless RAG',

  // ── INGESTION STEPS ───────────────────────────────────────────────────────
  STEP_PARSING:       'Parsing PDF',
  STEP_CHUNKING:      'Semantic chunking',
  STEP_EMBEDDING:     'Generating embeddings',
  STEP_INDEXING:      'Indexing into Pinecone',
  STEP_TREE_BUILDING: 'Building summary tree',
  STEP_DONE:          'Complete',
  STEP_ERROR:         'Error',

  // ── CHAT PAGE ─────────────────────────────────────────────────────────────
  CHAT_PLACEHOLDER:    'Ask a question about your document…',
  CHAT_SEND_ARIA:      'Send message',
  SIDEBAR_HEADING:     'Document Structure',
  TREE_STATS_LABEL:    'nodes · {depth} levels',
  TREE_TOKEN_PILL:     '🌿 Tree built using {tokens} tokens',
  SOURCE_TOGGLE_LABEL: '📎 {count} sources retrieved',
  SOURCE_TOGGLE_OPEN:  '📎 {count} sources ▲',
  COMPARE_WINNER:      '🏆',

  // ── TOKEN BADGE ───────────────────────────────────────────────────────────
  TOKEN_TOTAL:        '⚡ {total} tokens',
  TOKEN_PROMPT:       '📥 {prompt} prompt',
  TOKEN_COMPLETION:   '📤 {completion} output',
  TOKEN_LATENCY:      '⏱ {ms}ms',
  TOKEN_INGESTION:    '🌿 +{ingestion} ingestion = {grand} grand total',

  // ── DELETE FLOW ───────────────────────────────────────────────────────────
  DELETE_MODAL_TITLE:  'Delete this session?',
  DELETE_MODAL_BODY:   'This will permanently remove the uploaded PDF, all vectors, and the document tree. This cannot be undone.',
  DELETE_CONFIRM:      'Delete',
  DELETE_CANCEL:       'Cancel',

  // ── TOASTS ────────────────────────────────────────────────────────────────
  TOAST_COLD_START:     '☕ Waking up backend, this may take a moment…',
  TOAST_SESSION_LOST:   'Previous session not found. Please upload a new document.',
  TOAST_DELETE_SUCCESS: 'Session deleted successfully.',
  TOAST_UPLOAD_ERROR:   'Upload failed. Please try again.',

  // ── ERRORS ────────────────────────────────────────────────────────────────
  ERROR_FILE_TYPE:   'Only PDF files are accepted.',
  ERROR_FILE_SIZE:   'File exceeds the 25 MB limit.',
  ERROR_INVALID_URL: 'Please enter a valid PDF URL ending in .pdf',
  ERROR_GENERIC:     'Something went wrong. Please try again.',
};
