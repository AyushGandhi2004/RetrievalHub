import { useState } from 'react';
import { ChevronUp } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { APP_CONFIG } from '../../config/app.config';
import { useChatStore } from '../../store/chatStore';

const MODE_ORDER = ['rag', 'vectorless', 'compare'];

export default function ModeSelector({ disabled }) {
  const mode    = useChatStore((s) => s.mode);
  const setMode = useChatStore((s) => s.setMode);
  const [sheetOpen, setSheetOpen] = useState(false);

  const activeMode = Object.values(APP_CONFIG.modes).find((m) => m.id === mode);

  function select(id) {
    if (!disabled) {
      setMode(id);
      setSheetOpen(false);
    }
  }

  return (
    <>
      {/* ── Desktop: segmented control (≥ md) ─────────────────────────────── */}
      <div
        className="hidden md:flex rounded-lg overflow-hidden border border-stone-300 flex-shrink-0"
        role="group"
        aria-label="Query mode selector"
      >
        {MODE_ORDER.map((id) => {
          const m      = Object.values(APP_CONFIG.modes).find((x) => x.id === id);
          if (!m) return null;
          const active = mode === id;
          return (
            <button
              key={id}
              onClick={() => !disabled && setMode(id)}
              disabled={disabled}
              className={`px-3 py-2 text-xs font-body font-medium transition-colors
                ${active
                  ? 'bg-coral-400 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}
                first:rounded-l-lg last:rounded-r-lg disabled:opacity-50 disabled:cursor-not-allowed
                focus:outline-none focus:ring-2 focus:ring-inset focus:ring-coral-300`}
              aria-pressed={active}
              aria-label={m.label}
            >
              {m.shortLabel}
            </button>
          );
        })}
      </div>

      {/* ── Mobile: compact trigger button (< md) ─────────────────────────── */}
      <button
        onClick={() => !disabled && setSheetOpen(true)}
        disabled={disabled}
        className="md:hidden flex items-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg px-3 py-2 text-xs font-body font-medium flex-shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-coral-300"
        aria-label={`Query mode: ${activeMode?.label ?? mode}. Tap to change.`}
        aria-haspopup="listbox"
        aria-expanded={sheetOpen}
      >
        <span>{activeMode?.shortLabel ?? mode}</span>
        <ChevronUp className="w-3 h-3" aria-hidden="true" />
      </button>

      {/* ── Mobile: bottom sheet (< md) ───────────────────────────────────── */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/20 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSheetOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-xl shadow-xl p-4 md:hidden"
              role="listbox"
              aria-label="Select query mode"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              <div className="w-10 h-1 bg-stone-300 rounded-full mx-auto mb-4" aria-hidden="true" />
              <p className="font-body font-semibold text-stone-700 text-sm mb-3 px-1">
                Select query mode
              </p>
              {MODE_ORDER.map((id) => {
                const m      = Object.values(APP_CONFIG.modes).find((x) => x.id === id);
                if (!m) return null;
                const active = mode === id;
                return (
                  <button
                    key={id}
                    role="option"
                    aria-selected={active}
                    onClick={() => select(id)}
                    className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl mb-1 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-coral-300
                      ${active ? 'bg-coral-50 text-coral-700' : 'text-stone-700 hover:bg-stone-50'}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${active ? 'bg-coral-400' : 'bg-stone-300'}`}
                      aria-hidden="true"
                    />
                    <div>
                      <p className="font-body font-medium text-sm">{m.label}</p>
                      <p className="font-body text-xs text-stone-500 mt-0.5">{m.description}</p>
                    </div>
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
