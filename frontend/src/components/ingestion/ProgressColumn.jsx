import { CheckCircle } from 'lucide-react';
import StepIndicator from './StepIndicator';

const STEP_LABELS = {
  parsing:       'Parsing PDF',
  chunking:      'Semantic chunking',
  embedding:     'Generating embeddings',
  indexing:      'Indexing into Pinecone',
  tree_building: 'Building summary tree',
};

const PIPELINE_STEPS = {
  rag:        ['parsing', 'chunking', 'embedding', 'indexing'],
  vectorless: ['parsing', 'tree_building'],
};

function stepStatus(key, currentStep, completedSteps) {
  if (completedSteps?.[key]) return 'done';
  if (currentStep === key)   return 'active';
  return 'pending';
}

export default function ProgressColumn({ pipelineId, label, dotClass, state, isDone }) {
  const steps    = PIPELINE_STEPS[pipelineId] ?? PIPELINE_STEPS.rag;
  const elapsed  = state?.meta?.elapsed_ms != null
    ? `${(state.meta.elapsed_ms / 1000).toFixed(1)}s elapsed`
    : null;

  return (
    <div className="bg-white rounded-xl shadow-card p-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`} aria-hidden="true" />
          <span className="font-semibold text-stone-800 font-body text-sm">{label}</span>
        </div>
        {isDone && (
          <CheckCircle className="w-4 h-4 text-success" aria-label="Pipeline complete" />
        )}
      </div>

      {/* Steps */}
      <ul className="space-y-3" aria-label={`${label} steps`}>
        {steps.map((key) => (
          <StepIndicator
            key={key}
            label={STEP_LABELS[key] ?? key}
            status={stepStatus(key, state?.step, state?.steps)}
          />
        ))}
      </ul>

      {/* Message */}
      {state?.message && (
        <p className="text-stone-500 font-body text-xs mt-3 leading-relaxed line-clamp-2">
          {state.message}
        </p>
      )}

      {/* Timer */}
      {elapsed && (
        <p className="text-stone-400 font-mono text-xs mt-2">{elapsed}</p>
      )}
    </div>
  );
}
