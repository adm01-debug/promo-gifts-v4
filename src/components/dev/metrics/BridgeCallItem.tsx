import { memo } from 'react';
import { type BridgeCallSample } from '@/lib/telemetry/bridgeCallMetrics';
import { bridgeBadge, latencyClass, formatBytes } from './MetricUtils';

interface BridgeCallItemProps {
  sample: BridgeCallSample;
}

export const BridgeCallItem = memo(({ sample }: BridgeCallItemProps) => {
  return (
    <li className="px-3 py-1.5 hover:bg-white/5">
      <div className="flex flex-wrap items-center justify-between gap-1 sm:flex-nowrap sm:gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span
            className={`shrink-0 rounded border px-1 text-[9px] uppercase ${bridgeBadge(sample.bridge)}`}
          >
            {sample.bridge === 'external-db-bridge' ? 'ext' : 'crm'}
          </span>
          <span className="truncate text-zinc-200">{sample.op}</span>
          {sample.target && <span className="truncate text-zinc-500">·{sample.target}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-2 tabular-nums">
          <span className={latencyClass(sample.durationMs)}>{sample.durationMs}ms</span>
          <span className="text-zinc-400">{formatBytes(sample.respBytes)}</span>
          {!sample.ok && (
            <span className="rounded bg-red-500/20 px-1 text-[9px] text-red-300">
              {sample.status ?? 'err'}
            </span>
          )}
        </div>
      </div>
    </li>
  );
});

BridgeCallItem.displayName = 'BridgeCallItem';
