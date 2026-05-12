import { Handle, Position } from '@xyflow/react';
import { useTreeStore } from '../../store/treeStore';

const LEVEL_STYLES = {
  root:    'bg-stone-800 text-white shadow-lifted',
  chapter: 'bg-stone-600 text-white shadow-card',
  section: 'bg-white text-stone-700 border border-stone-300 shadow-card',
  leaf:    'bg-coral-50 text-stone-700 border border-coral-200',
};

export default function TreeNode({ id, data }) {
  const highlightedNodes = useTreeStore((s) => s.highlightedNodes);
  const setSelectedNode  = useTreeStore((s) => s.setSelectedNode);
  const isHighlighted    = highlightedNodes.includes(id);

  const base      = LEVEL_STYLES[data.level] ?? LEVEL_STYLES.section;
  const highlight = isHighlighted ? 'ring-2 ring-coral-400 !bg-coral-100' : '';

  const pageLabel =
    data.page_range
      ? data.page_range[0] === data.page_range[1]
        ? `p.${data.page_range[0]}`
        : `p.${data.page_range[0]}–${data.page_range[1]}`
      : '';

  return (
    <div
      className={`rounded-lg px-3 py-2 cursor-pointer transition-all w-[220px] ${base} ${highlight}`}
      onClick={() => setSelectedNode(data)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && setSelectedNode(data)}
      aria-label={`${data.level} node: ${data.title}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#C5C1BA', border: 'none', width: 6, height: 6 }}
      />

      <p className="font-body text-xs font-semibold truncate leading-snug">{data.title}</p>
      <p className="font-body text-[10px] opacity-60 mt-0.5 truncate">
        {data.level.charAt(0).toUpperCase() + data.level.slice(1)}
        {pageLabel ? ` · ${pageLabel}` : ''}
      </p>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#C5C1BA', border: 'none', width: 6, height: 6 }}
      />
    </div>
  );
}
