import { useState, useCallback } from 'react';
import { useSSE } from './useSSE';
import { APP_CONFIG } from '../config/app.config';

const INIT_PIPELINE = {
  step:     null,
  progress: 0,
  message:  '',
  meta:     {},
  steps:    {},   // completed step keys → true
};

/**
 * Consumes the GET /ingest/progress SSE stream for `sessionId`.
 * Returns per-pipeline state, done flags, and an overall allDone indicator.
 */
export function useIngestion(sessionId) {
  const [rag,        setRag]        = useState(INIT_PIPELINE);
  const [vectorless, setVectorless] = useState(INIT_PIPELINE);
  const [ragDone,    setRagDone]    = useState(false);
  const [vlDone,     setVlDone]     = useState(false);
  const [sseError,   setSseError]   = useState(null);

  const url = sessionId
    ? `${APP_CONFIG.backendBaseUrl}/ingest/progress?session_id=${sessionId}`
    : null;

  const handleEvent = useCallback((data) => {
    const { pipeline, step, progress, message, meta } = data;
    if (!pipeline) return;   // heartbeat or unknown event type

    const updater = (prev) => ({
      ...prev,
      step:     step,
      progress: progress ?? prev.progress,
      message:  message  ?? prev.message,
      meta:     meta     ?? prev.meta,
      steps:    step && step !== 'done' && step !== 'error'
        ? { ...prev.steps, [step]: true }
        : prev.steps,
    });

    if (pipeline === 'rag') {
      setRag(updater);
      if (step === 'done')  setRagDone(true);
      if (step === 'error') setSseError(`RAG pipeline: ${message}`);
    } else if (pipeline === 'vectorless') {
      setVectorless(updater);
      if (step === 'done')  setVlDone(true);
      if (step === 'error') setSseError(`Vectorless pipeline: ${message}`);
    }
  }, []);

  const { close } = useSSE(url, handleEvent);

  return {
    rag,
    vectorless,
    ragDone,
    vlDone,
    allDone: ragDone && vlDone,
    sseError,
    close,
  };
}
