import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SourceChunks from './SourceChunks';
import TokenBadge from './TokenBadge';
import Spinner from '../common/Spinner';
import CompareLayout from '../compare/CompareLayout';

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="ml-auto max-w-[80%] sm:max-w-[70%] bg-coral-400 text-white rounded-xl rounded-tr-sm px-4 py-3 font-body text-sm">
          {message.content}
        </div>
      </div>
    );
  }

  // Compare mode: full-width two-panel layout
  if (message.mode === 'compare') {
    return (
      <div className="w-full">
        <CompareLayout message={message} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start">
      <div className="mr-auto max-w-[80%] sm:max-w-[70%] bg-white border border-stone-200 rounded-xl rounded-tl-sm px-4 py-3 font-body text-sm text-stone-800">
        {message.content ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p:  ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
              ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
              code: ({ children }) => (
                <code className="bg-stone-100 text-stone-700 font-mono text-xs px-1 py-0.5 rounded">
                  {children}
                </code>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        ) : message.streaming ? (
          <span className="flex items-center gap-2 text-stone-400">
            <Spinner className="w-3 h-3" /> Thinking…
          </span>
        ) : null}
      </div>

      {/* Sources + token badge below assistant messages */}
      <div className="mr-auto max-w-[80%] sm:max-w-[70%] w-full">
        <SourceChunks sources={message.sources} />
        <TokenBadge usage={message.usage} mode={message.mode} />
      </div>
    </div>
  );
}
