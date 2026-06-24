/* eslint-disable @typescript-eslint/require-await */
/**
 * useQuoteBuilderState — regressão BUG-01: desconto em R$ deve ser clamped antes de enviar ao servidor
 *
 * Bug: discount_amount enviava `discountValue` (bruto) em vez de `discountAmount`
 * (clamped a min(subtotal, discountValue)). Quando o usuário remove itens após
 * digitar um desconto em R$ maior que o novo subtotal, o servidor recebia um valor
 * impossível e disparava "O desconto não pode exceder o subtotal" — mensagem
 * confusa e sem contexto de UX.
 *
 * Fix: linha 984 em useQuoteBuilderState.ts usa `discountAmount` (memoized com clamp).
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useQuoteBuilderState } from '@/hooks/quotes/useQuoteBuilderState';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// vi.hoisted garante que os spies estão inicializados antes da factory de vi.mock
// (que é içada ao topo do arquivo pelo bundler).
const { updateQuoteSpy, createQuoteSpy, requestApprovalSpy, fetchQuoteSpy, VALID_ITEM } =
  vi.hoisted(() => {
    // Orçamento com 10 itens × R$100 = subtotal R$1.000. Updated_at igual ao baseline
    // para NÃO disparar detecção de concorrência durante o save.
    const BASELINE_TS = '2026-01-01T00:00:00.000Z';
    const loadedQuote = {
      id: 'quote-1',
      client_id: 'company-1',
      contact_id: 'contact-1',
      client_name: 'Contato Teste',
      client_company: 'Empresa Teste',
      status: 'pending' as const,
      payment_method: 'boleto',
      payment_terms: '14_dias',
      delivery_time: '14_dias',
      shipping_type: 'cif',
      shipping_cost: 0,
      valid_until: '2026-12-31',
      updated_at: BASELINE_TS,
      items: [],
    };
    return {
      VALID_ITEM: {
        product_id: 'p-1',
        product_name: 'Produto',
        product_sku: 'SKU-1',
        quantity: 10,
        unit_price: 100, // subtotal = 10 × 100 = 1000
        personalizations: [],
      },
      updateQuoteSpy: vi.fn(() => ({ id: 'quote-1' })),
      createQuoteSpy: vi.fn(() => ({ id: 'new-quote' })),
      requestApprovalSpy: vi.fn(() => undefined),
      // Referência estável: a factory de vi.mock('@/hooks/quotes') é içada ao topo do
      // arquivo; vi.hoisted garante que fetchQuoteSpy está inicializado nesse momento.
      fetchQuoteSpy: vi.fn(() => Promise.resolve(loadedQuote)),
    };
  });

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ state: null, pathname: '/orcamentos/quote-1/editar' }),
  useParams: () => ({ id: 'quote-1' }),
  useSearchParams: () => [new URLSearchParams()],
}));

// SEM conflito: retorna o mesmo updated_at do baseline carregado para que o save
// não seja bloqueado pela detecção de concorrência.
vi.mock('@/integrations/supabase/client', async (importActual) => {
  const actual = (await importActual()) as Record<string, unknown> & {
    supabase: Record<string, unknown>;
  };
  return {
    ...actual,
    supabase: {
      ...actual.supabase,
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: { updated_at: '2026-01-01T00:00:00.000Z' } }),
          }),
        }),
      }),
    },
  };
});

vi.mock('@/hooks/quotes', () => ({
  useQuotes: () => ({
    createQuote: createQuoteSpy,
    updateQuote: updateQuoteSpy,
    fetchQuote: fetchQuoteSpy,
    isLoading: false,
  }),
  // myLimit = 100 → evita aprovação mesmo com desconto real de 100%
  useSellerDiscountLimits: () => ({ myLimit: 100 }),
  useDiscountApproval: () => ({ requestApproval: requestApprovalSpy }),
  useQuoteItems: () => ({
    items: [VALID_ITEM],
    setItems: vi.fn(),
    activeItemIndex: 0,
    setActiveItemIndex: vi.fn(),
    expandedItems: new Set(),
    setExpandedItems: vi.fn(),
    toggleExpanded: vi.fn(),
    addProductWithColor: vi.fn(),
    updateItemQuantity: vi.fn(),
    updateItemPrice: vi.fn(),
    removeItem: vi.fn(),
    handlePersonalizationsChange: vi.fn(),
    confirmItemPrice: vi.fn(),
  }),
  useAutoSaveQuote: () => ({ clearAutoSave: vi.fn() }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-123' } }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('useQuoteBuilderState — BUG-01: discount_amount clamp antes de enviar ao servidor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('[REGRESSÃO BUG-01] discountValue > subtotal → discount_amount enviado = subtotal (clamped, não bruto)', async () => {
    const { result } = renderHook(() => useQuoteBuilderState(), { wrapper });

    // Aguarda carregamento do orçamento (subtotal = 10 × R$100 = R$1.000).
    await waitFor(() => expect(result.current.loadingQuote).toBe(false));
    await waitFor(() => expect(result.current.isFormValid).toBe(true));

    // Define desconto em R$ maior que o subtotal (simula "usuário removeu itens
    // após digitar o desconto").
    act(() => {
      result.current.setDiscountType('amount');
      result.current.setDiscountValue(1_200); // R$1.200 > subtotal R$1.000
    });

    // discountAmount deve ser clamped a R$1.000 (= subtotal), não R$1.200.
    expect(result.current.discountAmount).toBe(1_000);

    // Salva o orçamento.
    await act(async () => {
      await result.current.handleSaveQuote('pending');
    });

    // O servidor deve receber o valor clamped, não o bruto.
    expect(updateQuoteSpy).toHaveBeenCalledTimes(1);
    const [, quoteArg] = updateQuoteSpy.mock.calls[0] as unknown as [
      string,
      { discount_amount: number; discount_percent: number },
    ];
    expect(quoteArg.discount_amount).toBe(1_000); // clamped ✅
    expect(quoteArg.discount_percent).toBe(0); // amount mode → percent = 0
  });

  it('discountValue <= subtotal → discount_amount enviado = discountValue (sem clamp)', async () => {
    const { result } = renderHook(() => useQuoteBuilderState(), { wrapper });

    await waitFor(() => expect(result.current.loadingQuote).toBe(false));
    await waitFor(() => expect(result.current.isFormValid).toBe(true));

    act(() => {
      result.current.setDiscountType('amount');
      result.current.setDiscountValue(300); // R$300 < subtotal R$1.000
    });

    expect(result.current.discountAmount).toBe(300); // não precisa de clamp

    await act(async () => {
      await result.current.handleSaveQuote('pending');
    });

    expect(updateQuoteSpy).toHaveBeenCalledTimes(1);
    const [, quoteArg] = updateQuoteSpy.mock.calls[0] as unknown as [
      string,
      { discount_amount: number },
    ];
    expect(quoteArg.discount_amount).toBe(300); // enviado sem alteração ✅
  });

  it('desconto em % não usa discountAmount — discount_percent enviado = discountValue', async () => {
    const { result } = renderHook(() => useQuoteBuilderState(), { wrapper });

    await waitFor(() => expect(result.current.loadingQuote).toBe(false));
    await waitFor(() => expect(result.current.isFormValid).toBe(true));

    act(() => {
      result.current.setDiscountType('percent');
      result.current.setDiscountValue(15); // 15%
    });

    await act(async () => {
      await result.current.handleSaveQuote('pending');
    });

    expect(updateQuoteSpy).toHaveBeenCalledTimes(1);
    const [, quoteArg] = updateQuoteSpy.mock.calls[0] as unknown as [
      string,
      { discount_percent: number; discount_amount: number },
    ];
    expect(quoteArg.discount_percent).toBe(15);
    expect(quoteArg.discount_amount).toBe(0); // percent mode → amount = 0
  });
});
