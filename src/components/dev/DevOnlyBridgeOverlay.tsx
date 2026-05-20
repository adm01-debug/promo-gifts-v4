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
  // Gate SSOT (isAllowed): role dev OU override de env/localStorage. Permite
  // habilitar o overlay de infra fora do papel dev quando o gate SSOT autoriza.
  return (
    <DevOnly>
      <Suspense fallback={null}>
        <Overlay />
      </Suspense>
    </DevOnly>
  );
}
