import { lazy, Suspense } from 'react';
import { useDevGate } from '@/hooks/admin';

const BridgeMetricsOverlay = lazy(() => import('./BridgeMetricsOverlay'));

export function DevOnlyBridgeOverlay() {
  const { isDev } = useDevGate();

  if (!isDev) return null;

  return (
    <Suspense fallback={null}>
      <BridgeMetricsOverlay />
    </Suspense>
  );
}
