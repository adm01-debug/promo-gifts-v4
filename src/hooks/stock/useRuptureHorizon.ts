/**
 * useRuptureHorizon — Estado global leve (singleton + subscribers) para o
 * horizonte de projeção do "Risco de Ruptura" no módulo de Estoque.
 *
 * Persistência (chaves de localStorage):
 *   • Canônica (v1):  `stock-filter:rupture-horizon:v1`
 *   • Legada:         `stock.ruptureHorizon`
 *
 * Estratégia de migração:
 *   • Leitura: tenta a chave v1 primeiro; se ausente, faz fallback para a
 *     chave legada e MIGRA (escreve v1 + remove legada) — uma única vez.
 *   • Escrita: SOMENTE na chave v1. A legada nunca recebe writes novos.
 *
 * Mantém o contrato anterior do hook (mesma assinatura e tipo).
 */
import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_RUPTURE_HORIZON,
  RUPTURE_HORIZON_OPTIONS,
  type RuptureHorizonDays,
} from '@/lib/inventory/rupture-risk';

/** Chave canônica de persistência (padrão `stock-filter:*:v1`). */
export const RUPTURE_HORIZON_STORAGE_KEY = 'stock-filter:rupture-horizon:v1';
/** Chave legada — mantida apenas para leitura/migração. NÃO usar para writes. */
export const RUPTURE_HORIZON_LEGACY_KEY = 'stock.ruptureHorizon';

function isValidHorizon(n: number): n is RuptureHorizonDays {
  return (RUPTURE_HORIZON_OPTIONS as readonly number[]).includes(n);
}

function parseRaw(raw: string | null): RuptureHorizonDays | null {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && isValidHorizon(n) ? n : null;
}

/**
 * Lê o horizonte persistido, aplicando migração da chave legada para a v1
 * se necessário. Exportada para testes unitários.
 */
export function readPersistedRuptureHorizon(): RuptureHorizonDays {
  if (typeof window === 'undefined') return DEFAULT_RUPTURE_HORIZON;
  try {
    const fromV1 = parseRaw(window.localStorage.getItem(RUPTURE_HORIZON_STORAGE_KEY));
    if (fromV1 !== null) return fromV1;

    const fromLegacy = parseRaw(window.localStorage.getItem(RUPTURE_HORIZON_LEGACY_KEY));
    if (fromLegacy !== null) {
      // Migração one-shot: promove valor legado para v1 e limpa o legado.
      try {
        window.localStorage.setItem(RUPTURE_HORIZON_STORAGE_KEY, String(fromLegacy));
        window.localStorage.removeItem(RUPTURE_HORIZON_LEGACY_KEY);
      } catch {
        /* quota/private mode — leitura ainda funciona */
      }
      return fromLegacy;
    }
    return DEFAULT_RUPTURE_HORIZON;
  } catch {
    return DEFAULT_RUPTURE_HORIZON;
  }
}

let current: RuptureHorizonDays = readPersistedRuptureHorizon();
const listeners = new Set<(d: RuptureHorizonDays) => void>();

/** Reset interno — somente para uso em testes (recarregar estado do storage). */
export function __resetRuptureHorizonForTests(): void {
  current = readPersistedRuptureHorizon();
  listeners.forEach((fn) => fn(current));
}

export function useRuptureHorizon(): [RuptureHorizonDays, (d: RuptureHorizonDays) => void] {
  const [value, setValue] = useState<RuptureHorizonDays>(current);

  useEffect(() => {
    listeners.add(setValue);
    if (value !== current) setValue(current);
    return () => {
      listeners.delete(setValue);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = useCallback((d: RuptureHorizonDays) => {
    current = d;
    try {
      window.localStorage.setItem(RUPTURE_HORIZON_STORAGE_KEY, String(d));
    } catch {
      /* storage indisponível — segue só em memória */
    }
    listeners.forEach((fn) => fn(d));
  }, []);

  return [value, set];
}
