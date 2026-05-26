import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GitFork } from 'lucide-react';
import DropZone from '../components/upload/DropZone';
import UrlInput from '../components/upload/UrlInput';
import { APP_CONFIG } from '../config/app.config';
import { STRINGS } from '../constants/strings';

export default function LandingPage() {
  const navigate = useNavigate();

  function handleSuccess(sessionId) {
    navigate(`/ingest?session_id=${sessionId}`);
  }

  return (
    <div className="dot-grid min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-stone-100/80 backdrop-blur-sm border-b border-stone-200">
        <div className="max-w-content mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-display text-stone-900 text-xl select-none">
            {APP_CONFIG.appName}
          </span>
          <a
            href="https://github.com/AyushGandhi2004/RetrievalHub"
            target="_blank"
            rel="noreferrer"
            className="text-stone-500 hover:text-stone-800 transition-colors flex items-center gap-1.5 text-sm font-body"
            aria-label="View source on GitHub"
          >
            <GitFork className="w-4 h-4" aria-hidden="true" />
            GitHub
          </a>
        </div>
      </header>

      {/* Hero + card */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Hero text */}
        <motion.div
          className="text-center mb-8 max-w-lg"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          <h1 className="font-display text-4xl sm:text-5xl text-stone-900 mb-3 leading-tight">
            {STRINGS.UPLOAD_HEADING}
          </h1>
          <p className="font-body text-stone-500 text-base sm:text-lg">
            {STRINGS.UPLOAD_SUBHEADING}
          </p>
        </motion.div>

        {/* Upload card */}
        <motion.div
          className="bg-white rounded-xl shadow-lifted p-8 w-full max-w-md"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut', delay: 0.08 }}
        >
          {/* Drop zone */}
          <DropZone onSuccess={handleSuccess} />

          {/* OR divider */}
          <div className="flex items-center gap-3 my-5">
            <hr className="flex-1 border-stone-300" />
            <span className="text-stone-400 text-sm font-body select-none">{STRINGS.OR_DIVIDER}</span>
            <hr className="flex-1 border-stone-300" />
          </div>

          {/* URL input */}
          <UrlInput onSuccess={handleSuccess} />

          <p className="text-stone-400 text-xs mt-5 text-center font-body select-none">
            {STRINGS.UPLOAD_CAPTION}
          </p>
        </motion.div>

        {/* Pipeline badges */}
        <motion.div
          className="flex flex-wrap gap-2 justify-center mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          {Object.values(APP_CONFIG.modes).slice(0, 2).map((m) => (
            <span
              key={m.id}
              className="bg-white border border-stone-200 rounded-full px-3 py-1 text-xs font-body text-stone-600 shadow-card"
            >
              {m.label}
            </span>
          ))}
          <span className="bg-coral-50 border border-coral-200 rounded-full px-3 py-1 text-xs font-body text-coral-600 shadow-card">
            {APP_CONFIG.modes.COMPARE.shortLabel} mode
          </span>
        </motion.div>
      </main>
    </div>
  );
}
