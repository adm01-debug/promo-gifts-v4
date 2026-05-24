import { type BridgeCallSample } from '@/lib/telemetry/bridgeCallMetrics';

export function formatBytes(b: number): string {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
  return `${(b / 1024 / 1024).toFixed(2)}MB`;
}

export function latencyClass(ms: number): string {
  if (ms < 200) return 'text-emerald-400';
  if (ms < 600) return 'text-amber-400';
  if (ms < 1500) return 'text-brand-primary-400';
  return 'text-red-400';
}

export function bridgeBadge(b: BridgeCallSample['bridge']): string {
  return b === 'external-db-bridge'
    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
    : 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40';
}
