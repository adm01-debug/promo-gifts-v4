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
  const { isAllowed } = useDevGate();
  
  // O componente Overlay deve ser instanciado de forma estável ou 
  // ser retornado apenas após o gate, mas para evitar "Rendered more hooks" 
  // se o overlay interno for montado/desmontado bruscamente em um 
  // contexto de re-render de Auth, garantimos que o gate seja estável.
  if (!isAllowed) return null;
  
  return (
    <Suspense fallback={null}>
      <Overlay />
    </Suspense>
  );
}

