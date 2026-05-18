/**
 * Wrapper que monta o BridgeMetricsOverlay APENAS quando o gate SSOT
 * aprova acesso técnico de infra.
 *
 * SRP: Responsável apenas pela injeção condicional do componente dev.
 */
import { Suspense } from 'react';
import { useDevGate } from '@/hooks/useDevGate';
import { lazyWithRetry } from '@/lib/lazyWithRetry';

const Overlay = lazyWithRetry(() => import('./BridgeMetricsOverlay'));

export function DevOnlyBridgeOverlay() {
  // Restrito EXCLUSIVAMENTE a usuários com role `dev` — admin/supervisor não veem.
  const { isDev } = useDevGate();

  if (!isDev) return null;

  return (
    <Suspense fallback={null}>
      <Overlay />
    </Suspense>
  );
}

