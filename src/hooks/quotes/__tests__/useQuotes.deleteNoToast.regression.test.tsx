/**
 * REGRESSION GUARD — Bug do toast duplicado no Desfazer Exclusão.
 *
 * Contexto:
 *   Antes do fix (commit anterior), `useQuotes.deleteMutation.onSuccess`
 *   emitia `toast.success('Orçamento exluído')` (com typo). Esse toast
 *   empilhava com o `showUndoToast` do `useQuotesListPage` e cobria
 *   visualmente o botão "Desfazer".
 *
 * Este teste FALHA se qualquer regressão reintroduzir toast de sucesso
 * dentro da mutation de delete de `useQuotes`. Invariantes:
 *
 *   1) `deleteQuote(id)` NUNCA chama `toast.success` (nem com título,
 *      nem com o typo antigo "exluído").
 *   2) `deleteQuote(id)` invoca `quoteService.deleteQuote(id)`.
 *   3) Em erro, apenas UM `toast.error('Erro ao excluir orçamento')`
 *      é emitido.
 *   4) Fuzz de 500 iterações com desfechos aleatórios (ok/erro) — a
 *      soma total de `toast.success` continua zero.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const toastSuccess = vi.fn();
const toastError = vi.fn();
const toastWarning = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
    warning: (...a: unknown[]) => toastWarning(...a),
  },
}));

const svcDelete = vi.fn<(id: string) => Promise<unknown>>();
vi.mock('@/services/quoteService', () => ({
  quoteService: {
    deleteQuote: (id: string) => svcDelete(id),
    fetchQuotes: vi.fn().mockResolvedValue([]),
    fetchQuote: vi.fn(),
    createQuote: vi.fn(),
    updateQuote: vi.fn(),
    updateQuoteStatus: vi.fn(),
    duplicateQuote: vi.fn(),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' }, session: null, loading: false }),
}));
vi.mock('@/contexts/OrganizationContext', () => ({
  useOrganization: () => ({ currentOrganization: null, currentOrgId: null }),
}));
vi.mock('@/lib/auth/visibility-scope', () => ({
  useSalesScope: () => ({ scope: 'own', canSeeAll: false }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), unsubscribe: () => {} }),
    removeChannel: () => {},
  },
}));

import { useQuotes } from '@/hooks/quotes/useQuotes';

function wrap({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useQuotes.deleteQuote — REGRESSÃO: nenhum toast de sucesso na mutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sucesso: chama service.deleteQuote e NÃO emite toast.success', async () => {
    svcDelete.mockResolvedValueOnce({ ok: true });
    const { result } = renderHook(() => useQuotes(), { wrapper: wrap });

    await act(async () => {
      await result.current.deleteQuote('q1');
    });

    expect(svcDelete).toHaveBeenCalledWith('q1');
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it('erro: emite exatamente 1 toast.error e ZERO toast.success', async () => {
    svcDelete.mockRejectedValueOnce(new Error('db down'));
    const { result } = renderHook(() => useQuotes(), { wrapper: wrap });

    await act(async () => {
      await result.current.deleteQuote('q1');
    });

    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith('Erro ao excluir orçamento');
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('typo "exluído" nunca aparece em nenhum toast', async () => {
    svcDelete.mockResolvedValueOnce({ ok: true });
    const { result } = renderHook(() => useQuotes(), { wrapper: wrap });
    await act(async () => {
      await result.current.deleteQuote('q1');
    });
    const allCalls = [
      ...toastSuccess.mock.calls,
      ...toastError.mock.calls,
      ...toastWarning.mock.calls,
    ].flat();
    for (const arg of allCalls) {
      const s = typeof arg === 'string' ? arg : JSON.stringify(arg);
      expect(s).not.toMatch(/exluí|exclído/i);
    }
  });

  it('fuzz 500 iterações: soma de toast.success permanece 0', async () => {
    const { result } = renderHook(() => useQuotes(), { wrapper: wrap });
    const N = 500;
    let expectedErrors = 0;
    for (let i = 0; i < N; i++) {
      const shouldFail = Math.random() < 0.35;
      if (shouldFail) {
        svcDelete.mockRejectedValueOnce(new Error(`fail-${i}`));
        expectedErrors++;
      } else {
        svcDelete.mockResolvedValueOnce({ ok: true, id: `q${i}` });
      }
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        await result.current.deleteQuote(`q${i}`);
      });
    }

    expect(svcDelete).toHaveBeenCalledTimes(N);
    expect(toastSuccess).toHaveBeenCalledTimes(0); // INVARIANTE PRINCIPAL
    expect(toastError).toHaveBeenCalledTimes(expectedErrors);
  }, 30_000);
});
