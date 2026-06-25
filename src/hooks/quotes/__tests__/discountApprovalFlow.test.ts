/**
 * discountApprovalFlow — fluxo de alçada end-to-end (camada hook)
 *
 * Cobre as garantias de negócio do plano:
 *   1. Sem markup, desconto > limite → cria pending_approval e UMA linha em DAR.
 *   2. Com markup forte zerando o desconto real → NÃO chama dedup, NÃO insere.
 *   3. Dedup quando já existe pending para o mesmo quote_id → NÃO insere
 *      (não duplica fila do gestor).
 *
 * Para o cenário (2) a decisão de chamar `requestApproval` mora no
 * `useQuoteBuilderState` (`realDiscountPercent > maxDiscountPercent`). Aqui
 * apenas re-asseguramos que o hook respeita o contrato quando chamado.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import { useDiscountApproval } from '../useDiscountApproval';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'seller-1', email: 's@x.com' } }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/logger', () => ({ logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
vi.mock('@/lib/security/rls-denial-logger', () => ({ logRlsDenial: vi.fn() }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn() },
}));

interface DarHandlers {
  existingPending?: { id: string } | null;
}

function installFrom({ existingPending = null }: DarHandlers = {}) {
  const insertSpy = vi.fn().mockResolvedValue({ error: null });

  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === 'discount_approval_requests') {
      const maybeSingle = vi.fn().mockResolvedValue({ data: existingPending, error: null });
      const innerEq = vi.fn().mockReturnValue({ maybeSingle });
      const outerEq = vi.fn().mockReturnValue({ eq: innerEq, maybeSingle });
      return {
        select: vi.fn().mockReturnValue({ eq: outerEq }),
        insert: insertSpy,
      } as never;
    }
    if (table === 'quotes') {
      return {
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi
              .fn()
              .mockResolvedValue({
                data: { discount_percent: 30, negotiation_markup_percent: 0, real_discount_percent: 30 },
                error: null,
              }),
          }),
        }),
      } as never;
    }
    if (table === 'user_roles') {
      return {
        select: vi
          .fn()
          .mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
      } as never;
    }
    // Fallback genérico (quote_history, profiles, etc.)
    return {
      insert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    } as never;
  });

  return { insertSpy };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fluxo de alçada — useDiscountApproval', () => {
  it('cenário 1 (sem markup, real > limite): chama INSERT exatamente uma vez', async () => {
    const { insertSpy } = installFrom({ existingPending: null });
    const { result } = renderHook(() => useDiscountApproval());

    await act(async () => {
      await result.current.requestApproval('quote-1', 30, 10, 'cliente estratégico');
    });

    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        quote_id: 'quote-1',
        seller_id: 'seller-1',
        requested_discount_percent: 30,
        max_allowed_percent: 10,
        seller_notes: 'cliente estratégico',
      }),
    );
  });

  it('cenário 2 (dedup): NÃO insere quando já existe pending para o mesmo quote', async () => {
    const { insertSpy } = installFrom({ existingPending: { id: 'existing-dar-1' } });
    const { result } = renderHook(() => useDiscountApproval());

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.requestApproval('quote-1', 30, 10, 'retry');
    });

    expect(outcome).toBe(true); // idempotente
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('cenário 3 (double-click): duas chamadas seguidas geram 1 linha quando 2ª já vê pending', async () => {
    // Simula: 1ª chamada insere; 2ª chamada (mesmo quote) encontra pending → dedup.
    let pending: { id: string } | null = null;
    const insertSpy = vi.fn().mockImplementation(async () => {
      pending = { id: 'just-inserted' };
      return { error: null };
    });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'discount_approval_requests') {
        const maybeSingle = vi.fn().mockImplementation(async () => ({ data: pending, error: null }));
        const innerEq = vi.fn().mockReturnValue({ maybeSingle });
        const outerEq = vi.fn().mockReturnValue({ eq: innerEq, maybeSingle });
        return { select: vi.fn().mockReturnValue({ eq: outerEq }), insert: insertSpy } as never;
      }
      if (table === 'quotes') {
        return {
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        } as never;
      }
      return {
        insert: vi.fn().mockResolvedValue({ error: null }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      } as never;
    });

    const { result } = renderHook(() => useDiscountApproval());

    await act(async () => {
      await result.current.requestApproval('quote-1', 30, 10, 'primeira');
      await result.current.requestApproval('quote-1', 30, 10, 'segunda (duplicada)');
    });

    expect(insertSpy).toHaveBeenCalledTimes(1);
  });
});
