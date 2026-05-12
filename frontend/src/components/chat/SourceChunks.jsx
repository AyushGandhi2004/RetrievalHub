import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SourceChunks({ sources }) {
  const [open, setOpen] = useState(false);

  if (!sources?.length) return null;

  const label = open
    ? `📎 ${sources.length} sources ▲`
    : `📎 ${sources.length} sources retrieved`;

  return (
    <div className="mt-2 font-body">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-stone-400 hover:text-coral-500 text-xs cursor-pointer flex items-center gap-1 transition-colors"
        aria-expanded={open}
        aria-label={label}
      >
        {label}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-2">
              {sources.map((chunk, i) => (
                <SourceChunk key={i} chunk={chunk} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SourceChunk({ chunk }) {
  const [expanded, setExpanded] = useState(false);
  const text = chunk.text || '';
  const preview = text.length > 200 ? text.slice(0, 200) + '…' : text;

  return (
    <div className="bg-stone-50 border border-stone-200 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="bg-coral-100 text-coral-700 text-xs rounded-full px-2 py-0.5">
          p.{chunk.page_number}
        </span>
        {chunk.rerank_score != null && (
          <span className="text-stone-400 text-xs">
            score {chunk.rerank_score.toFixed(2)}
          </span>
        )}
      </div>
      <p className="font-mono text-xs text-stone-600 leading-relaxed">
        {expanded ? text : preview}
      </p>
      {text.length > 200 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-coral-500 text-xs mt-1 hover:underline"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}
