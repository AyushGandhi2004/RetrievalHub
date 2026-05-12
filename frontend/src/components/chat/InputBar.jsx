import { useRef, useCallback } from 'react';
import { ArrowUp } from 'lucide-react';
import { STRINGS } from '../../constants/strings';
import ModeSelector from './ModeSelector';

export default function InputBar({ onSubmit, disabled }) {
  const textareaRef = useRef(null);

  const handleSubmit = useCallback(() => {
    const value = textareaRef.current?.value.trim();
    if (!value || disabled) return;
    onSubmit(value);
    textareaRef.current.value = '';
    textareaRef.current.style.height = 'auto';
  }, [onSubmit, disabled]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const handleInput = useCallback((e) => {
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  }, []);

  return (
    <div className="bg-white border-t border-stone-200 px-3 py-3 flex gap-2 items-end">
      <ModeSelector disabled={disabled} />

      <textarea
        ref={textareaRef}
        rows={1}
        placeholder={STRINGS.CHAT_PLACEHOLDER}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        disabled={disabled}
        className="flex-1 resize-none rounded-xl border border-stone-300 focus:ring-2 focus:ring-coral-300 focus:border-coral-400 px-4 py-3 font-body text-sm text-stone-800 min-h-[44px] max-h-40 bg-stone-50 outline-none disabled:opacity-60"
        aria-label={STRINGS.CHAT_PLACEHOLDER}
      />

      <button
        onClick={handleSubmit}
        disabled={disabled}
        className="bg-coral-400 hover:bg-coral-500 active:bg-coral-600 text-white rounded-xl p-3 shadow-coral transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={STRINGS.CHAT_SEND_ARIA}
      >
        <ArrowUp className="w-4 h-4" />
      </button>
    </div>
  );
}
