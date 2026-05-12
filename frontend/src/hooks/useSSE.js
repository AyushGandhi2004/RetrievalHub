import { useEffect, useRef, useCallback } from 'react';

/**
 * Generic EventSource wrapper.
 * Opens a connection to `url` and calls `onMessage(parsedData)` for every SSE message.
 * Automatically closes on unmount or when `url` changes.
 */
export function useSSE(url, onMessage) {
  const esRef  = useRef(null);
  const cbRef  = useRef(onMessage);
  cbRef.current = onMessage;

  const close = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!url) return;

    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (e) => {
      // SSE comments (": heartbeat") arrive as empty data — skip them
      if (!e.data || e.data.startsWith(':')) return;
      try {
        cbRef.current(JSON.parse(e.data));
      } catch {
        /* malformed JSON — ignore */
      }
    };

    es.onerror = () => close();

    return close;
  }, [url, close]);

  return { close };
}
