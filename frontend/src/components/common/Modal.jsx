import { AnimatePresence, motion } from 'framer-motion';

export default function Modal({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  onConfirm,
  onCancel,
  loading      = false,
  destructive  = false,
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <motion.div
            className="bg-white rounded-xl shadow-lifted p-6 w-full max-w-sm mx-4"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <h2 id="modal-title" className="font-display text-stone-900 text-lg mb-2">
              {title}
            </h2>
            <p className="text-stone-600 text-sm font-body mb-6 leading-relaxed">
              {body}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={onCancel}
                disabled={loading}
                className="px-4 py-2 text-sm font-body font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-stone-400"
                aria-label={cancelLabel}
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className={`px-4 py-2 text-sm font-body font-medium text-white rounded-lg transition-colors disabled:opacity-60 focus:outline-none focus:ring-2
                  ${destructive
                    ? 'bg-error hover:bg-red-700 focus:ring-error'
                    : 'bg-coral-400 hover:bg-coral-500 focus:ring-coral-400'}`}
                aria-label={confirmLabel}
              >
                {loading ? 'Please wait…' : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
