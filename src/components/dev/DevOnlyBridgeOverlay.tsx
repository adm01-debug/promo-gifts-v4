/**
 * Wrapper que monta o BridgeMetricsOverlay APENAS quando o gate SSOT
 * aprova acesso técnico de infra.
 *
 * SRP: Responsável apenas pela injeção condicional do componente dev.
 */
import { Suspense } from 'react';
import { DevOnly } from '@/components/dev/DevOnly';
import { lazyWithRetry } from '@/lib/lazyWithRetry';

const Overlay = lazyWithRetry(() => import('./BridgeMetricsOverlay'));

export function DevOnlyBridgeOverlay() {
  // Restrito EXCLUSIVAMENTE a usuários com role `dev` real — admin/supervisor não veem.
  return (
    <DevOnly strict>
      <Suspense fallback={null}>
        <Overlay />
      </Suspense>
    </DevOnly>
  );
}
