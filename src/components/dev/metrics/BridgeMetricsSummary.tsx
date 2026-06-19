import { memo } from 'react';
import { latencyClass, formatBytes } from './MetricUtils';
import { cn } from '@/lib/utils';

interface BridgeMetricsSummaryProps {
  summary: {
    total: number;
    avg: number;
    totalResp: number;
    errors: number;
    last20: number;
  };
}

export const BridgeMetricsSummary = memo(({ summary }: BridgeMetricsSummaryProps) => {
  return (
    <div className="grid grid-cols-2 gap-2 border-b border-white/5 bg-zinc-900/40 px-3 py-2 text-[10px] sm:grid-cols-4">
      <div>
        <div className="text-zinc-400">total</div>
        <div className="font-semibold tabular-nums">{summary.total}</div>
      </div>
      <div>
        <div className="text-zinc-400">avg (last {summary.last20})</div>
        <div className={`font-semibold tabular-nums ${latencyClass(summary.avg)}`}>
          {summary.avg}ms
        </div>
      </div>
      <div>
        <div className="text-zinc-400">resp (last {summary.last20})</div>
        <div className="font-semibold tabular-nums">{formatBytes(summary.totalResp)}</div>
      </div>
      <div>
        <div className="text-zinc-400">errors</div>
        <div className={cn('font-semibold tabular-nums', summary.errors > 0 && 'text-red-400')}>
          {summary.errors}
        </div>
      </div>
    </div>
  );
});

BridgeMetricsSummary.displayName = 'BridgeMetricsSummary';
