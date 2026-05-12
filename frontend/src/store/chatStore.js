import { create } from 'zustand';
import { APP_CONFIG } from '../config/app.config';

export const useChatStore = create((set, get) => ({
  messages:  [],
  mode:      APP_CONFIG.modes.RAG.id,
  isStreaming: false,

  setMode: (mode) => set({ mode }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  appendToken: (messageId, token) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, content: m.content + token } : m
      ),
    })),

  finalizeMessage: (messageId, updates) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, ...updates, streaming: false } : m
      ),
    })),

  setStreaming: (val) => set({ isStreaming: val }),

  // ── Compare mode helpers ───────────────────────────────────────────────────
  // `panel` is either "rag" or "vl" — the keys on a compare message object.

  appendCompareToken: (messageId, panel, token) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId
          ? { ...m, [panel]: { ...m[panel], content: (m[panel]?.content ?? '') + token } }
          : m
      ),
    })),

  // Merges `updates` into the named panel, then recalculates top-level
  // `streaming`: stays true until BOTH panels have done=true.
  finalizeCompare: (messageId, panel, updates) =>
    set((state) => ({
      messages: state.messages.map((m) => {
        if (m.id !== messageId) return m;
        const updatedPanel = { ...m[panel], ...updates };
        const ragDone = (panel === 'rag' ? updatedPanel : m.rag)?.done ?? false;
        const vlDone  = (panel === 'vl'  ? updatedPanel : m.vl)?.done  ?? false;
        return { ...m, [panel]: updatedPanel, streaming: !(ragDone && vlDone) };
      }),
    })),

  clearMessages: () => set({ messages: [] }),
}));
