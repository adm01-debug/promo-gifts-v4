import { Zap, MousePointerClick, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';
// EfficiencyGrid displays the trigger/fetch ratio and TTL window stats

interface EfficiencyGridProps {
  triggers: number;
  fetches: number;
  ratio: number;
  byTrigger: Record<string, number>;
  byFetch: Record<string, number>;
  fetchesByTtlWindow: { withinTtl: number; afterTtl: number };
  coalescingByTrigger: Record<string, unknown>;
}

export function EfficiencyGrid({
  triggers,
  fetches,
  ratio,
  byTrigger,
  byFetch,
  fetchesByTtlWindow,
  coalescingByTrigger: _coalescingByTrigger,
}: EfficiencyGridProps) {
  const ttlWithinPct =
    fetches === 0 ? 0 : Math.round((fetchesByTtlWindow.withinTtl / fetches) * 100);

  return (
    <div className="mb-2 rounded border border-border/40 bg-background/60 px-2 py-1.5 font-mono text-muted-foreground">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1">
          <Zap className="h-3 w-3" aria-hidden="true" />
          Trigger / Fetch ratio
        </span>
        <span
          className={cn(
            'font-semibold tabular-nums',
            triggers === 0
              ? 'text-muted-foreground'
              : ratio < 0.3
                ? 'text-primary'
                : ratio < 0.7
                  ? 'text-foreground'
                  : 'text-warning',
          )}
        >
          {triggers === 0 ? '—' : ratio.toFixed(2)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        <span className="inline-flex items-center gap-1">
          <MousePointerClick className="h-2.5 w-2.5" aria-hidden="true" />
          triggers
        </span>
        <span className="text-right tabular-nums text-foreground">{triggers}</span>
        {Object.entries(byTrigger).map(([source, _count]) => (
          <span key={source} className="pl-3.5">
            · {source}
          </span>
        ))}
        {Object.entries(byTrigger).map(([source, count]) => (
          <span key={source + '-val'} className="text-right tabular-nums">
            {count}
          </span>
        ))}

        <span className="mt-0.5 inline-flex items-center gap-1">
          <Wifi className="h-2.5 w-2.5" aria-hidden="true" />
          fetches
        </span>
        <span className="mt-0.5 text-right tabular-nums text-foreground">{fetches}</span>
        {Object.entries(byFetch).map(([type, _count]) => (
          <span key={type} className="pl-3.5">
            · {type}
          </span>
        ))}
        {Object.entries(byFetch).map(([type, count]) => (
          <span key={type + '-val'} className="text-right tabular-nums">
            {count}
          </span>
        ))}

        <span className="mt-0.5 inline-flex items-center gap-1 pl-3.5">
          <Zap className="h-2.5 w-2.5" aria-hidden="true" />
          within TTL (&lt;5s)
        </span>
        <span
          className={cn(
            'mt-0.5 text-right font-semibold tabular-nums',
            fetchesByTtlWindow.withinTtl === 0 ? 'text-muted-foreground' : 'text-warning',
          )}
        >
          {fetchesByTtlWindow.withinTtl} ({ttlWithinPct}%)
        </span>
      </div>
    </div>
  );
}
