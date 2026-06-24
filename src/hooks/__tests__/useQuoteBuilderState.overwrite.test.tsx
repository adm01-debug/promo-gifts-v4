/* eslint-disable @typescript-eslint/require-await */
/**
 * useQuoteBuilderState — overwrite consciente preserva o status do save
 *
 * Quando um conflito de edição simultânea é detectado durante uma finalização
 * (status 'pending'), o "sobrescrever mesmo assim" deve manter o status que o
 * usuário tentou salvar — e NÃO rebaixar silenciosamente para rascunho.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useQuoteBuilderState } from '@/hooks/quotes/useQuoteBuilderState';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Spies e fixtures em vi.hoisted: a factory de vi.mock('@/hooks/quotes') é içada
// ao topo do arquivo e avaliada ao resolver useQuoteBuilderState; declarar estes
// valores via vi.hoisted garante que estejam inicializados antes disso, evitando
// um ReferenceError de TDZ (createQuoteSpy/updateQuoteSpy/fetchQuoteSpy/VALID_ITEM).
const { updateQuoteSpy, createQuoteSpy, requestApprovalSpy, fetchQuoteSpy, VALID_ITEM } =
  vi.hoisted(() => {
    // Orçamento completo e válido, salvo no passado (baseline antigo).
    const loadedQuote = {
      id: 'quote-1',
      client_id: 'company-1',
      contact_id: 'contact-1',
      client_name: 'Contato Teste',
      client_company: 'Empresa Teste',
      status: 'pending',
      payment_method: 'boleto',
      payment_terms: '14_dias',
      delivery_time: '14_dias',
      shipping_type: 'cif',
      shipping_cost: 0,
      valid_until: '2026-12-31',
      updated_at: '2026-01-01T00:00:00.000Z',
      items: [],
    };
    return {
      VALID_ITEM: {
        product_id: 'p-1',
        product_name: 'Produto',
        product_sku: 'SKU-1',
        quantity: 10,
        unit_price: 100,
        personalizations: [],
      },
      updateQuoteSpy: vi.fn(() => ({ id: 'quote-1' })),
      createQuoteSpy: vi.fn(() => ({ id: 'quote-1' })),
      requestApprovalSpy: vi.fn(() => undefined),
      // Referência estável: o efeito de load do hook depende de `fetchQuote`; um
      // spy recriado a cada render reentraria no efeito em loop.
      fetchQuoteSpy: vi.fn(() => loadedQuote),
    };
  });

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ state: null, pathname: '/orcamentos/quote-1/editar' }),
  useParams: () => ({ id: 'quote-1' }),
  useSearchParams: () => [new URLSearchParams()],
}));

// Conflito: o banco tem updated_at MAIS NOVO que o baseline carregado.
// Preserva os demais exports reais do módulo (SUPABASE_URL, etc.) e sobrescreve
// apenas `supabase.from` para a checagem de concorrência.
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
            single: () => Promise.resolve({ data: { updated_at: '2026-02-01T00:00:00.000Z' } }),
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
  useSellerDiscountLimits: () => ({ myLimit: 50 }),
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

describe('useQuoteBuilderState — overwrite preserva status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('save "pending" com conflito não persiste; overwrite mantém "pending" (não rebaixa p/ draft)', async () => {
    const { result } = renderHook(() => useQuoteBuilderState(), { wrapper });

    // Aguarda o carregamento do orçamento (fetchQuote) preencher o estado.
    await waitFor(() => expect(result.current.loadingQuote).toBe(false));
    await waitFor(() => expect(result.current.isFormValid).toBe(true));

    // 1) Tenta finalizar como 'pending' → conflito detectado, save bloqueado.
    await act(async () => {
      await result.current.handleSaveQuote('pending');
    });
    expect(result.current.conflictInfo).not.toBeNull();
    expect(updateQuoteSpy).not.toHaveBeenCalled();

    // 2) Sobrescrever mesmo assim (sem argumento) → mantém 'pending'.
    await act(async () => {
      await result.current.overwriteAndSave();
    });

    expect(updateQuoteSpy).toHaveBeenCalledTimes(1);
    const [, quoteArg] = updateQuoteSpy.mock.calls[0] as unknown as [string, { status: string }];
    expect(quoteArg.status).toBe('pending');
  });

  it('overwrite de "pending_approval" preserva a justificativa do vendedor no requestApproval', async () => {
    const { result } = renderHook(() => useQuoteBuilderState(), { wrapper });

    await waitFor(() => expect(result.current.loadingQuote).toBe(false));
    await waitFor(() => expect(result.current.isFormValid).toBe(true));

    const justification = 'Cliente estratégico — volume alto';

    // 1) Solicita aprovação com justificativa → conflito detectado, save bloqueado.
    await act(async () => {
      await result.current.handleSaveQuote('pending_approval', justification);
    });
    expect(result.current.conflictInfo).not.toBeNull();
    expect(requestApprovalSpy).not.toHaveBeenCalled();

    // 2) Sobrescrever mesmo assim → mantém 'pending_approval' E a justificativa.
    await act(async () => {
      await result.current.overwriteAndSave();
    });

    expect(updateQuoteSpy).toHaveBeenCalledTimes(1);
    const [, quoteArg] = updateQuoteSpy.mock.calls[0] as unknown as [string, { status: string }];
    expect(quoteArg.status).toBe('pending_approval');
    expect(requestApprovalSpy).toHaveBeenCalledTimes(1);
    // requestApproval(quoteId, realDiscountPercent, maxDiscountPercent, sellerNotes)
    const approvalArgs = requestApprovalSpy.mock.calls[0] as unknown as unknown[];
    expect(approvalArgs[3]).toBe(justification);
  });
});
