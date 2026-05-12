import { useEffect, useState } from 'react';
import { GitBranch, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import DocumentTree from '../tree/DocumentTree';
import { STRINGS } from '../../constants/strings';

export default function Sidebar({ sessionId, totalNodes, treeDepth, ingestionTokens }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const treeContent = (
    <>
      <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between flex-shrink-0 bg-stone-50/95 backdrop-blur-sm">
        <span className="font-semibold text-stone-700 font-body text-sm">
          {STRINGS.SIDEBAR_HEADING}
        </span>
        <button
          onClick={() => setIsOpen(false)}
          className="text-stone-400 hover:text-stone-600 transition-colors rounded focus:outline-none focus:ring-2 focus:ring-coral-300"
          aria-label="Collapse sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tree stats */}
      {totalNodes > 0 && (
        <div className="px-4 py-2 border-b border-stone-200 flex-shrink-0">
          <p className="text-stone-500 text-xs font-body">
            {totalNodes} nodes · {treeDepth} levels
          </p>
        </div>
      )}

      {/* Ingestion token pill */}
      {ingestionTokens > 0 && (
        <div className="mx-3 mt-2 mb-1 bg-coral-50 border border-coral-100 rounded-lg p-2 flex-shrink-0">
          <p className="text-xs text-coral-700 font-body">
            🌿 Tree built using {ingestionTokens.toLocaleString()} tokens
          </p>
        </div>
      )}

      {/* React Flow tree */}
      <DocumentTree sessionId={sessionId} />
    </>
  );

  return (
    <>
      {!isOpen && (
        <aside
          className="w-14 shrink-0 bg-stone-50/95 backdrop-blur-sm border-r border-stone-200 flex flex-col items-center py-3 shadow-sm"
          aria-label="Sidebar navigation"
        >
          <button
            onClick={() => setIsOpen(true)}
            className="w-9 h-9 flex items-center justify-center text-stone-500 hover:text-coral-500 hover:bg-coral-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-coral-300"
            aria-label="Open document tree"
            aria-expanded={isOpen}
          >
            <GitBranch className="w-4 h-4" />
          </button>
        </aside>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.aside
            className="fixed inset-0 z-50 flex flex-col bg-white shadow-2xl overflow-hidden"
            role="dialog"
            aria-label="Document tree"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            {treeContent}
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
