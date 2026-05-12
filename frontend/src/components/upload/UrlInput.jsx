import { useState } from 'react';
import { Link, AlertCircle } from 'lucide-react';
import { useSessionStore } from '../../store/sessionStore';
import { useToastStore } from '../../store/toastStore';
import { STRINGS } from '../../constants/strings';
import api from '../../utils/api';

const COLD_START_MS = 6000;

export default function UrlInput({ onSuccess, disabled }) {
  const [url, setUrl]         = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const setSession = useSessionStore((s) => s.setSession);
  const addToast   = useToastStore((s) => s.addToast);

  function validate(val) {
    const trimmed = val.trim();
    if (!trimmed) return false;
    try {
      const parsed = new URL(trimmed);
      if (!parsed.pathname.toLowerCase().endsWith('.pdf')) {
        setError(STRINGS.ERROR_INVALID_URL);
        return false;
      }
    } catch {
      setError(STRINGS.ERROR_INVALID_URL);
      return false;
    }
    setError('');
    return true;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate(url) || loading || disabled) return;

    setLoading(true);
    const sessionId = crypto.randomUUID();
    const fileName  = url.split('/').pop() || 'document.pdf';
    setSession({ sessionId, fileUrl: url.trim(), fileKey: null, fileName });

    // Show cold-start toast if /ingest hasn't responded after 6 seconds
    const coldTimer = setTimeout(
      () => addToast({ message: STRINGS.TOAST_COLD_START, type: 'info', duration: 10000 }),
      COLD_START_MS,
    );
    try {
      await api.post('/ingest', { file_url: url.trim(), file_key: null, session_id: sessionId });
      onSuccess(sessionId);
    } catch {
      setError(STRINGS.ERROR_GENERIC);
    } finally {
      clearTimeout(coldTimer);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="relative">
        <Link
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(''); }}
          placeholder={STRINGS.URL_INPUT_PLACEHOLDER}
          disabled={loading || disabled}
          className="w-full border border-stone-300 rounded-lg pl-9 pr-4 py-3 font-body text-stone-800 text-sm
            focus:outline-none focus:ring-2 focus:ring-coral-300 focus:border-coral-400
            bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="PDF URL input"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 mt-2 text-error text-xs font-body" role="alert">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {url.trim() && !error && (
        <button
          type="submit"
          disabled={loading || disabled}
          className="w-full mt-3 bg-stone-700 hover:bg-stone-800 active:bg-stone-900 text-white font-semibold
            rounded-lg py-2.5 text-sm font-body transition-colors disabled:opacity-50 disabled:cursor-not-allowed
            focus:outline-none focus:ring-2 focus:ring-stone-400"
          aria-label="Analyse PDF from URL"
        >
          {loading ? 'Starting…' : 'Use This URL'}
        </button>
      )}
    </form>
  );
}
