import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SourceChunks from '../chat/SourceChunks';
import TokenBadge from '../chat/TokenBadge';
import Spinner from '../common/Spinner';

/**
 * Renders a side-by-side (desktop) or stacked (mobile) two-panel layout
 * for compare-mode responses. Receives the full compare message object
 * with `rag` and `vl` panel slices.
 */
export default function CompareLayout({ message }) {
  const { rag, vl } = message;

  const ragDone  = rag?.done ?? false;
  const vlDone   = vl?.done  ?? false;
  const bothDone = ragDone && vlDone;

  // 🏆 goes to the pipeline that finished retrieval faster
  let ragWins = false;
  let vlWins  = false;
  if (bothDone) {
    const ragMs = rag?.usage?.retrieval_ms;
    const vlMs  = vl?.usage?.retrieval_ms;
    if (ragMs != null && vlMs != null) {
      ragWins = ragMs <= vlMs;
      vlWins  = !ragWins;
    }
  }

  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
      <Panel
        label="Traditional RAG"
        panelBg="bg-rag-light"
        borderColor="border-rag-DEFAULT"
        dotColor="bg-rag-DEFAULT"
        panel={rag}
        mode="rag"
        isWinner={ragWins}
      />
      <Panel
        label="Vectorless RAG"
        panelBg="bg-vectorless-light"
        borderColor="border-vectorless-DEFAULT"
        dotColor="bg-vectorless-DEFAULT"
        panel={vl}
        mode="vectorless"
        isWinner={vlWins}
      />
    </div>
  );
}

function Panel({ label, panelBg, borderColor, dotColor, panel, mode, isWinner }) {
  const content    = panel?.content    ?? '';
  const isStreaming = panel?.streaming ?? true;

  // Normalise token field: RAG sends total_tokens, VL sends total_query_tokens
  const totalTokens =
    panel?.usage?.total_tokens ??
    panel?.usage?.total_query_tokens ??
    null;

  return (
    <div className={`border-t-2 rounded-xl p-4 ${panelBg} ${borderColor}`}>

      {/* ── Panel header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} aria-hidden="true" />
          <span className="font-body font-semibold text-stone-800 text-sm">{label}</span>
          {isWinner && (
            <span className="text-sm" role="img" aria-label="Fastest pipeline">🏆</span>
          )}
        </div>

        {/* Live stats — appear once usage event arrives */}
        {panel?.usage && (
          <span className="text-xs text-stone-500 font-body whitespace-nowrap">
            ⏱ {panel.usage.retrieval_ms}ms
            {totalTokens != null && ` · ⚡ ${totalTokens.toLocaleString()} tokens`}
          </span>
        )}
      </div>

      {/* ── Streamed answer ─────────────────────────────────────────────────── */}
      <div className="font-body text-sm text-stone-800 mb-2">
        {content ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p:    ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
              ul:   ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
              ol:   ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
              code: ({ children }) => (
                <code className="bg-stone-100 text-stone-700 font-mono text-xs px-1 py-0.5 rounded">
                  {children}
                </code>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        ) : isStreaming ? (
          <span className="flex items-center gap-2 text-stone-400">
            <Spinner className="w-3 h-3" />
            Thinking…
          </span>
        ) : null}
      </div>

      {/* ── Sources (RAG) / token badge ─────────────────────────────────────── */}
      {panel?.sources    && <SourceChunks sources={panel.sources} />}
      {panel?.usage      && <TokenBadge   usage={panel.usage} mode={mode} />}
    </div>
  );
}
