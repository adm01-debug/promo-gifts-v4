/**
 * CloudStatusContext — provedor singleton de status do backend.
 *
 * PROBLEMA (corrigido 2026-07-17):
 * `CloudStatusBanner` e `CloudStatusDot` eram montados simultaneamente em App.tsx
 * e cada um instanciava `useCloudStatus()` internamente → 2 timers de polling
 * independentes + 2 backoff schedulers independentes.
 * Embora o módulo cloud-status.ts coalesça chamadas HTTP via `inFlight`, os
 * timers rodavam em duplicata — dobrando a frequência de scheduling e consumindo
 * recursos desnecessariamente durante incidentes.
 *
 * SOLUÇÃO:
 * Extrair o hook para um Provider que monta 1× no App.tsx. Os componentes
 * filhos consomem via `useCloudStatusContext()` → zero instâncias adicionais do scheduler.
 *
 * RETROCOMPATIBILIDADE:
 * `useCloudStatus()` continua funcionando fora do provider (fallback para
 * instância isolada) para não quebrar callers em outros contextos.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { useCloudStatus } from '@/hooks/ui/useCloudStatus';
import type { CloudStatus, CloudStatusSnapshot } from '@/lib/cloud-status';

interface CloudStatusContextValue {
  status: CloudStatus;
  snapshot: CloudStatusSnapshot | null;
  retry: () => Promise<void>;
  isChecking: boolean;
}

const CloudStatusContext = createContext<CloudStatusContextValue | null>(null);

/**
 * Wraps children with a single cloud-status scheduler.
 * Place high in the component tree (App.tsx) to cover Banner + Dot.
 */
export function CloudStatusProvider({ children }: { children: ReactNode }) {
  const value = useCloudStatus();
  return <CloudStatusContext.Provider value={value}>{children}</CloudStatusContext.Provider>;
}

/**
 * Consumes cloud status from the nearest `CloudStatusProvider`.
 * Falls back to a fresh `useCloudStatus()` instance if used outside a provider
 * (e.g. in tests, Storybook, or admin pages not wrapped by the provider).
 */
export function useCloudStatusContext(): CloudStatusContextValue {
  const ctx = useContext(CloudStatusContext);
  if (ctx) return ctx;
  // Fallback: hook isolado (mantém retrocompat fora do provider)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useCloudStatus();
}
