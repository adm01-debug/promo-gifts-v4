import { STOCK_THRESHOLD_RULES } from '@/lib/inventory/health-score';
import { cn } from '@/lib/utils';

const BAND_COLOR: Record<(typeof STOCK_THRESHOLD_RULES)[number]['key'], string> = {
  healthy: 'border-success/30 bg-success/10 text-success',
  low: 'border-warning/30 bg-warning/10 text-warning',
  critical: 'border-destructive/30 bg-destructive/10 text-destructive',
  out: 'border-muted-foreground/30 bg-muted text-muted-foreground',
};

interface Props {
  className?: string;
  compact?: boolean;
}

export function StockThresholdsLegend({ className, compact = false }: Props) {
  return (
    <div
      data-testid="stock-thresholds-legend"
      className={cn('flex flex-wrap items-center gap-1.5 text-xs', className)}
    >
      {!compact && (
        <span className="text-muted-foreground">Faixas de classificação:</span>
      )}
      {STOCK_THRESHOLD_RULES.map((t) => (
        <span
          key={t.key}
          data-testid={`stock-threshold-chip-${t.key}`}
          title={t.rule}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium',
            BAND_COLOR[t.key],
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
          {t.label}
        </span>
      ))}
    </div>
  );
}
