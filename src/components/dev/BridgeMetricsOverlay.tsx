import { useBridgeMetrics } from '@/hooks/dev/useBridgeMetrics';
import { BridgeMetricsSummary } from './metrics/BridgeMetricsSummary';

export default function BridgeMetricsOverlay() {
  const { summary, open } = useBridgeMetrics();

  if (!open) return null;

  return (
    <div
      data-testid="bridge-metrics-overlay"
      className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border border-white/10 bg-zinc-950/95 shadow-2xl backdrop-blur"
    >
      <BridgeMetricsSummary summary={summary} />
    </div>
  );
}
