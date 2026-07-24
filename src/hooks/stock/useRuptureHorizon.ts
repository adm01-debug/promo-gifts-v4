/**
 * useRuptureHorizon — Estado global leve (singleton + subscribers) para o
 * horizonte de projeção do "Risco de Ruptura" no módulo de Estoque.
 *
 * Compartilhado entre `StockFilterToolbar` (controle UI na barra superior) e
 * `VariantStockTable` (que consome o valor para recalcular a coluna de risco),
 * sem precisar prop-drillar pelo `StockDashboard`. Persiste em localStorage
 * usando a mesma chave já testada pelo E2E `stock-rupture-horizon.spec.ts`
 * (`stock.ruptureHorizon`).
 */
import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_RUPTURE_HORIZON,
  RUPTURE_HORIZON_OPTIONS,
  type RuptureHorizonDays,
} from '@/lib/inventory/rupture-risk';

const STORAGE_KEY = 'stock.ruptureHorizon';

function readInitial(): RuptureHorizonDays {
  if (typeof window === 'undefined') return DEFAULT_RUPTURE_HORIZON;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const n = raw ? (parseInt(raw, 10) as RuptureHorizonDays) : DEFAULT_RUPTURE_HORIZON;
    return (RUPTURE_HORIZON_OPTIONS as readonly number[]).includes(n)
      ? n
      : DEFAULT_RUPTURE_HORIZON;
  } catch {
    return DEFAULT_RUPTURE_HORIZON;
  }
}

let current: RuptureHorizonDays = readInitial();
const listeners = new Set<(d: RuptureHorizonDays) => void>();

export function useRuptureHorizon(): [RuptureHorizonDays, (d: RuptureHorizonDays) => void] {
  const [value, setValue] = useState<RuptureHorizonDays>(current);

  useEffect(() => {
    listeners.add(setValue);
    // Sincroniza caso outro componente tenha alterado antes do mount.
    if (value !== current) setValue(current);
    return () => {
      listeners.delete(setValue);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = useCallback((d: RuptureHorizonDays) => {
    current = d;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(d));
    } catch {
      /* storage indisponível — segue só em memória */
    }
    listeners.forEach((fn) => fn(d));
  }, []);

  return [value, set];
}
