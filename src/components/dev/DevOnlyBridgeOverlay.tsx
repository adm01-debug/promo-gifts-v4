import { lazy, Suspense } from 'react';

const BridgeMetricsOverlay = lazy(() => import('./BridgeMetricsOverlay'));

export function DevOnlyBridgeOverlay() {
  return (
    <Suspense fallback={null}>
      <BridgeMetricsOverlay />
    </Suspense>
  );
}
