import { useCallback } from 'react';
import { APP_CONFIG } from '../config/app.config';
import { useChatStore } from '../store/chatStore';
import { useTreeStore } from '../store/treeStore';

/**
 * Submits a query to /query/{mode} via fetch + ReadableStream (POST SSE).
 * EventSource only supports GET; fetch is required for POST endpoints.
 *
 * Single-mode events:  token | sources | path | usage | done | error
 * Compare-mode events: same types, each tagged with a `pipeline` field.
 *
 * Single-mode writes to useChatStore message fields directly.
 * Compare-mode routes each event to the correct panel (rag / vl) via
 * appendCompareToken / finalizeCompare, and path events also update
 * useTreeStore highlights.
 */
export function useQuery() {
  const mode                = useChatStore((s) => s.mode);
  const addMessage          = useChatStore((s) => s.addMessage);
  const appendToken         = useChatStore((s) => s.appendToken);
  const finalizeMessage     = useChatStore((s) => s.finalizeMessage);
  const appendCompareToken  = useChatStore((s) => s.appendCompareToken);
  const finalizeCompare     = useChatStore((s) => s.finalizeCompare);
  const setStreaming         = useChatStore((s) => s.setStreaming);
  const setHighlightedNodes = useTreeStore((s) => s.setHighlightedNodes);

  const submitQuery = useCallback(
    async (question, sessionId) => {
      if (!question.trim() || !sessionId) return;

      const isCompare = mode === APP_CONFIG.modes.COMPARE.id;

      // ── User bubble ─────────────────────────────────────────────────────────
      addMessage({
        id:        crypto.randomUUID(),
        role:      'user',
        content:   question,
        streaming: false,
        sources:   null,
        usage:     null,
        mode,
      });

      // ── Assistant placeholder ────────────────────────────────────────────────
      const assistantId = crypto.randomUUID();
      if (isCompare) {
        addMessage({
          id:        assistantId,
          role:      'assistant',
          mode:      'compare',
          streaming: true,
          content:   '',   // unused in compare; kept for store consistency
          sources:   null,
          usage:     null,
          rag: { content: '', streaming: true, sources: null, usage: null, done: false },
          vl:  { content: '', streaming: true, traversalPath: null, usage: null, done: false },
        });
      } else {
        addMessage({
          id:        assistantId,
          role:      'assistant',
          content:   '',
          streaming: true,
          sources:   null,
          usage:     null,
          mode,
        });
      }
      setStreaming(true);

      try {
        const resp = await fetch(
          `${APP_CONFIG.backendBaseUrl}/query/${mode}`,
          {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ question, session_id: sessionId }),
          },
        );

        if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);

        // ── Stream parsing ───────────────────────────────────────────────────
        const reader  = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer    = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE messages are delimited by "\n\n"
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            for (const line of part.split('\n')) {
              if (!line.startsWith('data: ')) continue;
              let event;
              try { event = JSON.parse(line.slice(6)); } catch { continue; }

              if (isCompare) {
                _handleCompareEvent(
                  event, assistantId,
                  appendCompareToken, finalizeCompare, setHighlightedNodes,
                );
              } else {
                _handleSingleEvent(
                  event, assistantId,
                  appendToken, finalizeMessage, setHighlightedNodes,
                );
              }
            }
          }
        }

        if (!isCompare) finalizeMessage(assistantId, { streaming: false });
      } catch (err) {
        if (isCompare) {
          finalizeCompare(assistantId, 'rag', { content: `Error: ${err.message}`, done: true, streaming: false });
          finalizeCompare(assistantId, 'vl',  { content: `Error: ${err.message}`, done: true, streaming: false });
        } else {
          finalizeMessage(assistantId, { content: `Something went wrong: ${err.message}`, streaming: false });
        }
      } finally {
        setStreaming(false);
      }
    },
    [mode, addMessage, appendToken, finalizeMessage, appendCompareToken, finalizeCompare, setStreaming, setHighlightedNodes],
  );

  return { submitQuery };
}

// ── Single-pipeline event handler ────────────────────────────────────────────

function _handleSingleEvent(event, assistantId, appendToken, finalizeMessage, setHighlightedNodes) {
  if (event.type === 'token') {
    appendToken(assistantId, event.content);
  } else if (event.type === 'sources') {
    finalizeMessage(assistantId, { sources: event.chunks });
  } else if (event.type === 'path') {
    setHighlightedNodes(event.node_ids ?? []);
    finalizeMessage(assistantId, { traversalPath: event });
  } else if (event.type === 'usage') {
    finalizeMessage(assistantId, { usage: event });
  } else if (event.type === 'error') {
    finalizeMessage(assistantId, { content: `Error: ${event.message}`, streaming: false });
  }
  // 'done' is handled by the post-loop finalizeMessage call in the caller
}

// ── Compare-mode event handler ───────────────────────────────────────────────

// Backend tags events with pipeline: "rag" | "vectorless".
// Message panels are keyed "rag" | "vl" to keep the store shape concise.
const _panelKey = (pipeline) => (pipeline === 'vectorless' ? 'vl' : 'rag');

function _handleCompareEvent(event, assistantId, appendCompareToken, finalizeCompare, setHighlightedNodes) {
  const panel = _panelKey(event.pipeline);

  if (event.type === 'token') {
    appendCompareToken(assistantId, panel, event.content);
  } else if (event.type === 'sources') {
    finalizeCompare(assistantId, panel, { sources: event.chunks });
  } else if (event.type === 'path') {
    setHighlightedNodes(event.node_ids ?? []);
    finalizeCompare(assistantId, panel, { traversalPath: event });
  } else if (event.type === 'usage') {
    finalizeCompare(assistantId, panel, { usage: event });
  } else if (event.type === 'done') {
    finalizeCompare(assistantId, panel, { done: true, streaming: false });
  } else if (event.type === 'error') {
    finalizeCompare(assistantId, panel, { content: `Error: ${event.message}`, done: true, streaming: false });
  }
}
