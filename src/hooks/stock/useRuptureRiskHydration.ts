/**
 * useRuptureRiskHydration — Re-hidratação assíncrona do filtro
 * "Risco de Ruptura" após reload.
 *
 * Os alertas EMA (`ruptureByVariantId`) chegam de forma assíncrona após o
 * mount do dashboard. Se o usuário deixou o filtro LIGADO antes do reload,
 * precisamos reaplicá-lo automaticamente assim que o conjunto de IDs ficar
 * disponível — caso contrário, o Switch volta como OFF e a tabela mostra
 * o universo completo, contradizendo a UI persistida.
 *
 * Contrato:
 *   • Roda no máximo UMA vez por sessão (guard via ref).
 *   • Só age quando `variantIds` tem ao menos 1 ID E a pref é "1".
 *   • Não interfere se o filtro já está ativo (idempotente).
 *
 * Extraído como hook próprio para ser unit-testável sem montar o
 * StockDashboard inteiro — ver `tests/useRuptureRiskHydration.test.tsx`.
 */
import { useEffect, useRef } from 'react';

export const RUPTURE_RISK_ACTIVE_STORAGE_KEY = 'stock-filter:rupture-risk-active:v1';

export interface UseRuptureRiskHydrationArgs {
  /** Conjunto de variantIds em risco — `null` enquanto os alertas EMA não chegam. */
  variantIds: ReadonlySet<string> | null;
  /** Se o filtro já está ativo (em `filters.ruptureRiskVariantIds`). */
  isActive: boolean;
  /** Callback que aplica o filtro no estado do dashboard. */
  applyFilter: (ids: ReadonlySet<string>) => void;
  /** Chave de leitura — override apenas para testes. */
  storageKey?: string;
}

export function useRuptureRiskHydration({
  variantIds,
  isActive,
  applyFilter,
  storageKey = RUPTURE_RISK_ACTIVE_STORAGE_KEY,
}: UseRuptureRiskHydrationArgs): void {
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current) return;
    if (!variantIds || variantIds.size === 0) return;

    let pref: string | null = null;
    try {
      pref = window.localStorage.getItem(storageKey);
    } catch {
      /* ignore */
    }
    if (pref === '1' && !isActive) {
      applyFilter(variantIds);
    }
    hydratedRef.current = true;
  }, [variantIds, isActive, applyFilter, storageKey]);
}

/** Persiste a pref de ativação. Silencia erros de quota/private mode. */
export function writeRuptureRiskActivePref(
  active: boolean,
  storageKey: string = RUPTURE_RISK_ACTIVE_STORAGE_KEY,
): void {
  try {
    window.localStorage.setItem(storageKey, active ? '1' : '0');
  } catch {
    /* ignore */
  }
}
