import { cn } from '@/lib/utils';

export function LatencyBadge({ ms, className }: { ms: number | null; className?: string }) {
  if (ms === null) return <span className={cn('text-xs text-muted-foreground', className)}>—</span>;
  const cls =
    ms < 500
      ? 'bg-green-500/10 text-green-700 border-green-500/30 dark:text-green-400'
      : ms < 2000
        ? 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400'
        : 'bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium tabular-nums',
        cls,
        className,
      )}
    >
      {ms}ms
    </span>
  );
}
