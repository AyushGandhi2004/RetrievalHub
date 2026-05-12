import { AnimatePresence, motion } from 'framer-motion';
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { useToastStore } from '../../store/toastStore';

const ICON = {
  info:    Info,
  success: CheckCircle,
  warning: AlertCircle,
  error:   AlertCircle,
};

const COLOR = {
  info:    'bg-stone-800 text-white',
  success: 'bg-success text-white',
  warning: 'bg-warning text-white',
  error:   'bg-error text-white',
};

export default function Toast() {
  const toasts      = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  return (
    <div
      className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-xs pointer-events-none"
      aria-live="polite"
      aria-label="Notifications"
    >
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon  = ICON[t.type]  ?? Info;
          const color = COLOR[t.type] ?? COLOR.info;
          return (
            <motion.div
              key={t.id}
              role="alert"
              initial={{ opacity: 0, y: -12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0,   scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`${color} rounded-xl px-4 py-3 flex items-start gap-3 shadow-lifted pointer-events-auto`}
            >
              <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span className="font-body text-sm flex-1 leading-snug">{t.message}</span>
              <button
                onClick={() => removeToast(t.id)}
                className="opacity-70 hover:opacity-100 transition-opacity flex-shrink-0 rounded focus:outline-none focus:ring-2 focus:ring-white/50"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
