import { CheckCircle, Circle, Loader, AlertCircle } from 'lucide-react';

const CONFIG = {
  done:    { icon: CheckCircle, cls: 'text-success',               text: 'text-stone-700' },
  active:  { icon: Loader,      cls: 'text-coral-400 animate-spin', text: 'text-stone-800 font-medium' },
  error:   { icon: AlertCircle, cls: 'text-error',                  text: 'text-error' },
  pending: { icon: Circle,      cls: 'text-stone-300',              text: 'text-stone-400' },
};

export default function StepIndicator({ label, status = 'pending' }) {
  const { icon: Icon, cls, text } = CONFIG[status] ?? CONFIG.pending;
  return (
    <li className={`flex items-center gap-3 font-body text-sm ${text}`}>
      {status === 'active' ? (
        <span className="relative flex-shrink-0 w-4 h-4" aria-hidden="true">
          <span className="absolute inset-0 rounded-full bg-coral-400 opacity-30 animate-ping" />
          <Icon className={`relative w-4 h-4 ${cls}`} />
        </span>
      ) : (
        <Icon className={`w-4 h-4 flex-shrink-0 ${cls}`} aria-hidden="true" />
      )}
      {label}
    </li>
  );
}
