import { X } from 'lucide-react';
import { useTreeStore } from '../../store/treeStore';

const LEVEL_BADGE = {
  root:    'bg-stone-800 text-white',
  chapter: 'bg-stone-600 text-white',
  section: 'bg-stone-200 text-stone-700',
  leaf:    'bg-coral-100 text-coral-700',
};

export default function NodeDrawer() {
  const selectedNode    = useTreeStore((s) => s.selectedNode);
  const setSelectedNode = useTreeStore((s) => s.setSelectedNode);

  if (!selectedNode) return null;

  const badgeClass = LEVEL_BADGE[selectedNode.level] ?? LEVEL_BADGE.section;

  const pageLabel =
    selectedNode.page_range
      ? selectedNode.page_range[0] === selectedNode.page_range[1]
        ? `Page ${selectedNode.page_range[0]}`
        : `Pages ${selectedNode.page_range[0]}–${selectedNode.page_range[1]}`
      : null;

  return (
    <div
      className="fixed right-0 top-14 h-[calc(100vh-3.5rem)] w-96 bg-white shadow-xl border-l border-stone-200 z-40 overflow-y-auto p-5 font-body"
      role="dialog"
      aria-label="Node details"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full uppercase tracking-wider ${badgeClass}`}>
          {selectedNode.level}
        </span>
        <button
          onClick={() => setSelectedNode(null)}
          className="text-stone-400 hover:text-stone-600 transition-colors"
          aria-label="Close node drawer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Title + page range */}
      <h2 className="text-stone-900 font-semibold text-sm mb-1 leading-snug">
        {selectedNode.title}
      </h2>
      {pageLabel && (
        <p className="text-stone-500 text-xs mb-4">{pageLabel}</p>
      )}

      {/* Summary */}
      {selectedNode.summary && (
        <section className="mb-5">
          <h3 className="text-stone-500 text-[10px] font-semibold uppercase tracking-wider mb-1.5">
            Summary
          </h3>
          <p className="text-stone-700 text-sm leading-relaxed">{selectedNode.summary}</p>
        </section>
      )}

      {/* Raw text (leaf nodes) */}
      {selectedNode.raw_text && (
        <section className="mb-5">
          <h3 className="text-stone-500 text-[10px] font-semibold uppercase tracking-wider mb-1.5">
            Content
          </h3>
          <p className="font-mono text-xs text-stone-600 leading-relaxed whitespace-pre-wrap line-clamp-[20]">
            {selectedNode.raw_text}
          </p>
        </section>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {selectedNode.children?.length > 0 && (
          <div className="bg-stone-50 rounded-lg p-3">
            <p className="text-stone-500 text-[10px] uppercase tracking-wider">Children</p>
            <p className="text-stone-800 font-semibold text-sm mt-0.5">
              {selectedNode.children.length}
            </p>
          </div>
        )}
        {selectedNode.token_count != null && (
          <div className="bg-stone-50 rounded-lg p-3">
            <p className="text-stone-500 text-[10px] uppercase tracking-wider">Tokens</p>
            <p className="text-stone-800 font-semibold text-sm mt-0.5">
              {selectedNode.token_count.toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
