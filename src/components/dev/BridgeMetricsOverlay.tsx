import { useBridgeMetrics } from '@/hooks/dev/useBridgeMetrics';
import { BridgeMetricsSummary } from './metrics/BridgeMetricsSummary';

export default function BridgeMetricsOverlay() {
  const { summary, open, setOpen } = useBridgeMetrics();

  if (!open) {
    return (
      <button
        data-testid="bridge-metrics-toggle"
        className="fixed bottom-4 right-4 z-50 rounded-full border border-white/10 bg-zinc-950/90 px-3 py-1.5 text-xs text-zinc-400 shadow-lg backdrop-blur hover:text-zinc-200"
        onClick={() => setOpen(true)}
      >
        Bridge
      </button>
    );
  }

  return (
    <div
      data-testid="bridge-metrics-overlay"
      className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border border-white/10 bg-zinc-950/95 shadow-2xl backdrop-blur"
    >
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-1.5">
        <span className="text-xs font-medium text-zinc-300">Bridge Metrics</span>
        <button
          className="text-xs text-zinc-500 hover:text-zinc-300"
          onClick={() => setOpen(false)}
        >
          X
        </button>
      </div>
      <BridgeMetricsSummary summary={summary} />
    </div>
  );
}
