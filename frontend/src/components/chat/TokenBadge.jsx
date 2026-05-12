export default function TokenBadge({ usage, mode }) {
  if (!usage) return null;

  const {
    total_tokens, prompt_tokens, completion_tokens,
    retrieval_ms,
    ingestion_tokens, grand_total_tokens,
  } = usage;

  return (
    <div className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 mt-2 text-xs text-stone-500 flex flex-wrap gap-x-4 gap-y-1 font-body">
      {total_tokens != null && (
        <span>⚡ {total_tokens.toLocaleString()} tokens</span>
      )}
      {prompt_tokens != null && (
        <span>📥 {prompt_tokens.toLocaleString()} prompt · 📤 {completion_tokens?.toLocaleString()} output</span>
      )}
      {retrieval_ms != null && (
        <span>⏱ {retrieval_ms}ms</span>
      )}
      {mode === 'vectorless' && ingestion_tokens != null && (
        <span className="w-full text-coral-600">
          🌿 +{ingestion_tokens.toLocaleString()} ingestion = {grand_total_tokens?.toLocaleString()} grand total
        </span>
      )}
    </div>
  );
}
