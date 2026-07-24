/* eslint-disable @typescript-eslint/require-await */
/**
 * useRuptureAlerts — testes do hardening:
 * - flag off ⇒ não dispara query
 * - dedup por variant_id preservando o pior (menor cobertura)
 * - erro propaga sem crash
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { setFeatureFlag } from '@/lib/feature-flags';

const limitMock = vi.fn();
// Cadeia espelha o hook: from().select().eq().neq().order().order().limit()
// (o .neq('nivel_alerta','OK') + 2º .order() foram adicionados no fix de 2026-06-22).
const orderInnerMock = vi.fn(() => ({ limit: limitMock }));
const orderOuterMock = vi.fn(() => ({ order: orderInnerMock }));
const neqMock = vi.fn(() => ({ order: orderOuterMock }));
const eqMock = vi.fn(() => ({ neq: neqMock }));
const selectMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ select: selectMock }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...a: unknown[]) => fromMock(...a) },
}));

// import depois do mock
import { useRuptureAlerts } from '../useRuptureAlerts';

function wrap(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setFeatureFlag('useEmaRupture', false);
});

describe('useRuptureAlerts', () => {
  it('não dispara query quando feature flag está desligada', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useRuptureAlerts(), { wrapper: wrap(qc) });
    expect(result.current.alerts).toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('dedupe por variant_id mantendo a menor cobertura (cenário 2 preferidos)', async () => {
    setFeatureFlag('useEmaRupture', true);
    limitMock.mockResolvedValueOnce({
      data: [
        {
          variant_id: 'v1',
          supplier_id: 's1',
          supplier_name: 'A',
          nivel_alerta: 'ALERTA',
          cobertura_dias: 12,
          lead_time_efetivo: 5,
          ema_diaria: 1,
          current_stock: 12,
          prioridade: 3,
          is_preferred: true,
        },
        {
          variant_id: 'v1',
          supplier_id: 's2',
          supplier_name: 'B',
          nivel_alerta: 'CRÍTICO',
          cobertura_dias: 2,
          lead_time_efetivo: 5,
          ema_diaria: 1,
          current_stock: 2,
          prioridade: 1,
          is_preferred: true,
        },
      ],
      error: null,
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useRuptureAlerts(), { wrapper: wrap(qc) });
    await waitFor(() => expect(result.current.alerts.length).toBe(2));
    const dedup = result.current.byVariantId.get('v1');
    expect(dedup?.supplier_id).toBe('s2');
    expect(dedup?.cobertura_dias).toBe(2);
  });

  it('lista vazia em caso de erro, sem crash', async () => {
    setFeatureFlag('useEmaRupture', true);
    limitMock.mockResolvedValue({ data: null, error: new Error('view não existe') });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useRuptureAlerts(), { wrapper: wrap(qc) });
    await waitFor(() => expect(result.current.error).not.toBeNull(), { timeout: 5000 });
    expect(result.current.alerts).toEqual([]);
  });
});
