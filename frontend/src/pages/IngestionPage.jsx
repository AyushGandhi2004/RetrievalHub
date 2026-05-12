import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { useIngestion } from '../hooks/useIngestion';
import ProgressColumn from '../components/ingestion/ProgressColumn';
import { STRINGS } from '../constants/strings';

export default function IngestionPage() {
  const [params]  = useSearchParams();
  const sessionId = params.get('session_id');
  const navigate  = useNavigate();

  const { rag, vectorless, ragDone, vlDone, allDone, sseError } = useIngestion(sessionId);

  return (
    <div className="dot-grid min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Header */}
      <motion.div
        className="text-center mb-8 max-w-lg"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="font-display text-3xl sm:text-4xl text-stone-900 mb-2">
          {STRINGS.INGESTION_HEADING}
        </h1>
        <p className="font-body text-stone-500 text-sm sm:text-base">
          {STRINGS.INGESTION_SUBHEADING}
        </p>
      </motion.div>

      {/* Pipeline columns */}
      <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <ProgressColumn
            pipelineId="rag"
            label={STRINGS.PIPELINE_RAG_LABEL}
            dotClass="bg-rag-DEFAULT"
            state={rag}
            isDone={ragDone}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.08 }}
        >
          <ProgressColumn
            pipelineId="vectorless"
            label={STRINGS.PIPELINE_VECTORLESS_LABEL}
            dotClass="bg-vectorless-DEFAULT"
            state={vectorless}
            isDone={vlDone}
          />
        </motion.div>
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {sseError && (
          <motion.div
            className="w-full max-w-3xl mt-4 flex items-start gap-3 p-4 bg-red-50 border border-error/30 rounded-xl"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <AlertCircle className="w-4 h-4 text-error flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-error text-sm font-body">{sseError}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Continue CTA — shown when both pipelines complete */}
      <AnimatePresence>
        {allDone && !sseError && (
          <motion.div
            className="w-full max-w-3xl mt-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <button
              onClick={() => navigate(`/chat?session_id=${sessionId}`)}
              className="w-full bg-coral-400 hover:bg-coral-500 active:bg-coral-600 text-white rounded-xl py-4 font-semibold shadow-coral font-body transition-colors"
              aria-label={STRINGS.INGESTION_CTA}
            >
              {STRINGS.INGESTION_CTA}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
