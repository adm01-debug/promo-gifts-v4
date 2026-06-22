import { cn } from '@/lib/utils';
import type { ConfidenceBand } from '@/lib/inventory/supplier-reliability';

interface ReliabilityBadgeProps {
  band: ConfidenceBand;
  score: number | null;
  size?: 'md' | 'sm';
  className?: string;
}

const BAND_LABEL: Record<ConfidenceBand, string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
  unknown: 'Sem dados',
};

const BAND_STYLE: Record<ConfidenceBand, string> = {
  high: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  medium: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  low: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
  unknown: 'bg-muted text-muted-foreground border-border',
};

export function ReliabilityBadge({ band, score, size = 'md', className }: ReliabilityBadgeProps) {
  return (
    <span
      data-testid={`reliability-badge-${band}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium tabular-nums',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        BAND_STYLE[band],
        className,
      )}
      title={`Confiabilidade ${BAND_LABEL[band]}${score !== null ? ` — score ${score}/100` : ''}`}
    >
      <span
        className={cn(
          'inline-block rounded-full',
          size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2',
          band === 'high' && 'bg-emerald-500',
          band === 'medium' && 'bg-amber-500',
          band === 'low' && 'bg-rose-500',
          band === 'unknown' && 'bg-muted-foreground/50',
        )}
        aria-hidden
      />
      {score !== null ? <span>{score}</span> : <span>—</span>}
      <span className="font-normal opacity-80">{BAND_LABEL[band]}</span>
    </span>
  );
}
