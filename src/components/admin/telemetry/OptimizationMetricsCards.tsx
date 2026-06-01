/**
 * OptimizationMetricsCards
 * --------------------------------------------------------------
 * Surfaces the impact of Wave-2 optimizations on the admin telemetry page:
 *  - Cache Hit Rate (last 24h) — hits served by the in-memory LRU on
 *    external-db-bridge versus all persisted samples.
 *  - Retries Saved (last 24h) — sum of `retry_count` avoided thanks to the
 *    fail-fast classifier (NON_RETRYABLE_PATTERNS).
 *
 * Pure presentational. Data comes from `useOptimizationMetrics`.
 */
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Gauge, ShieldCheck } from 'lucide-react';
import { useOptimizationMetrics } from '@/pages/admin/telemetry/useOptimizationMetrics';

export function OptimizationMetricsCards() {
  const { metrics, isLoading } = useOptimizationMetrics();

  const hitRateLabel = metrics.cacheHitRate === null ? '—' : `${metrics.cacheHitRate.toFixed(1)}%`;

  const hitRateTone =
    metrics.cacheHitRate === null
      ? 'muted'
      : metrics.cacheHitRate >= 30
        ? 'success'
        : metrics.cacheHitRate >= 10
          ? 'warning'
          : 'muted';

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card
        className={cn(
          'border-[1.5px] transition-colors',
          hitRateTone === 'success' && 'border-success/40 bg-success/5',
          hitRateTone === 'warning' && 'border-warning/40 bg-warning/5',
        )}
      >
        <CardContent className="flex items-center gap-3 p-4">
          <div
            className={cn(
              'rounded-lg p-2.5',
              hitRateTone === 'success' && 'bg-success/15 text-success',
              hitRateTone === 'warning' && 'bg-warning/15 text-warning',
              hitRateTone === 'muted' && 'bg-muted text-muted-foreground',
            )}
          >
            <Gauge className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Cache Hit Rate (24h)
            </p>
            <p className="font-display text-3xl font-bold tabular-nums leading-tight">
              {isLoading ? '—' : hitRateLabel}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {metrics.cacheHits24h.toLocaleString()} hits ·{' '}
              {metrics.totalSamples24h.toLocaleString()} amostras
            </p>
          </div>
        </CardContent>
      </Card>

      <Card
        className={cn(
          'border-[1.5px] transition-colors',
          metrics.retriesSaved24h > 0 && 'border-success/40 bg-success/5',
        )}
      >
        <CardContent className="flex items-center gap-3 p-4">
          <div
            className={cn(
              'rounded-lg p-2.5',
              metrics.retriesSaved24h > 0
                ? 'bg-success/15 text-success'
                : 'bg-muted text-muted-foreground',
            )}
          >
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Retries Evitados (24h)
            </p>
            <p className="font-display text-3xl font-bold tabular-nums leading-tight">
              {isLoading ? '—' : metrics.retriesSaved24h.toLocaleString()}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Tentativas economizadas pelo fail-fast (~700ms cada)
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
