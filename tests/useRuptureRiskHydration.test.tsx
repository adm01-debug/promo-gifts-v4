/**
 * useRuptureRiskHydration — re-hidratação assíncrona do filtro de Risco
 * de Ruptura após reload do dashboard.
 *
 * Cenários cobertos:
 *  1. Pref OFF + alertas chegam → não aplica filtro.
 *  2. Pref ON + alertas ausentes → não aplica (espera).
 *  3. Pref ON + alertas chegam DEPOIS do mount → aplica uma única vez
 *     (simula reload com fetch assíncrono do EMA pipeline).
 *  4. Filtro já ativo → não reaplica (idempotente).
 *  5. Roda no máximo UMA vez por sessão mesmo se variantIds mudar.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useRuptureRiskHydration,
  RUPTURE_RISK_ACTIVE_STORAGE_KEY,
} from '@/hooks/stock/useRuptureRiskHydration';

describe('useRuptureRiskHydration', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('1) pref OFF — não aplica filtro mesmo com alertas presentes', () => {
    const apply = vi.fn();
    renderHook(() =>
      useRuptureRiskHydration({
        variantIds: new Set(['v1', 'v2']),
        isActive: false,
        applyFilter: apply,
      }),
    );
    expect(apply).not.toHaveBeenCalled();
  });

  it('2) pref ON + alertas ausentes — aguarda sem aplicar', () => {
    window.localStorage.setItem(RUPTURE_RISK_ACTIVE_STORAGE_KEY, '1');
    const apply = vi.fn();
    renderHook(() =>
      useRuptureRiskHydration({
        variantIds: null,
        isActive: false,
        applyFilter: apply,
      }),
    );
    expect(apply).not.toHaveBeenCalled();
  });

  it('3) pref ON + alertas chegam após mount — aplica exatamente uma vez', () => {
    window.localStorage.setItem(RUPTURE_RISK_ACTIVE_STORAGE_KEY, '1');
    const apply = vi.fn();
    const initialIds: ReadonlySet<string> | null = null;

    const { rerender } = renderHook(
      ({ ids }: { ids: ReadonlySet<string> | null }) =>
        useRuptureRiskHydration({
          variantIds: ids,
          isActive: false,
          applyFilter: apply,
        }),
      { initialProps: { ids: initialIds } },
    );

    expect(apply).not.toHaveBeenCalled();

    // Simula chegada assíncrona dos alertas EMA pós-reload.
    const arrived = new Set(['v1', 'v2', 'v3']);
    rerender({ ids: arrived });

    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith(arrived);
  });

  it('4) filtro já ativo — não reaplica', () => {
    window.localStorage.setItem(RUPTURE_RISK_ACTIVE_STORAGE_KEY, '1');
    const apply = vi.fn();
    renderHook(() =>
      useRuptureRiskHydration({
        variantIds: new Set(['v1']),
        isActive: true,
        applyFilter: apply,
      }),
    );
    expect(apply).not.toHaveBeenCalled();
  });

  it('5) executa no máximo uma vez por sessão (guard via ref)', () => {
    window.localStorage.setItem(RUPTURE_RISK_ACTIVE_STORAGE_KEY, '1');
    const apply = vi.fn();
    const first = new Set(['v1']);
    const second = new Set(['v1', 'v2']);

    const { rerender } = renderHook(
      ({ ids }: { ids: ReadonlySet<string> }) =>
        useRuptureRiskHydration({
          variantIds: ids,
          isActive: false,
          applyFilter: apply,
        }),
      { initialProps: { ids: first } },
    );

    expect(apply).toHaveBeenCalledTimes(1);

    rerender({ ids: second });
    rerender({ ids: new Set(['v3']) });

    // Mesmo com novos sets, hydration roda só na primeira chegada não-vazia.
    expect(apply).toHaveBeenCalledTimes(1);
  });
});
