export default function Spinner({ size = 'md', className = '' }) {
  const sz = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }[size] ?? 'w-6 h-6';
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`${sz} rounded-full border-2 border-coral-400 border-t-transparent animate-spin ${className}`}
    />
  );
}
