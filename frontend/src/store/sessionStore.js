import { create } from 'zustand';

const LS_KEY = 'ragbench_session_id';

export const useSessionStore = create((set, get) => ({
  sessionId:  localStorage.getItem(LS_KEY) || null,
  fileUrl:    null,
  fileKey:    null,
  fileName:   null,
  pageCount:  null,
  chunkCount: null,
  vectorlessIngestionTokens: null,
  createdAt:  null,

  setSession: ({ sessionId, fileUrl, fileKey, fileName }) => {
    localStorage.setItem(LS_KEY, sessionId);
    set({ sessionId, fileUrl, fileKey, fileName });
  },

  setMeta: (meta) => set({
    pageCount:  meta.page_count,
    chunkCount: meta.chunk_count,
    vectorlessIngestionTokens: meta.vectorless_ingestion_tokens,
    createdAt:  meta.created_at,
  }),

  clearSession: () => {
    localStorage.removeItem(LS_KEY);
    set({
      sessionId: null, fileUrl: null, fileKey: null, fileName: null,
      pageCount: null, chunkCount: null, vectorlessIngestionTokens: null, createdAt: null,
    });
  },
}));
