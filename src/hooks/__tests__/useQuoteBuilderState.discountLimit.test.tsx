/**
 * useQuoteBuilderState — gate de alçada de desconto (isDiscountExceeded)
 *
 * Garante que o gate de UI (Criar vs. Solicitar Aprovação) usa o DESCONTO REAL
 * (sobre o subtotal real, sem markup) — exatamente a métrica que o trigger
 * server-side `fn_quotes_validate_discount` enforce via `real_discount_percent`.
 *
 * Regressão coberta: com margem de negociação ativa, o desconto aparente podia
 * exceder o limite enquanto o desconto REAL permanecia dentro da alçada. O gate
 * antigo (apparent) empurrava esses orçamentos para aprovação desnecessariamente,
 * anulando o propósito do markup.
 */
import { renderHook, act } from '@testing-library/react';
import { useQuoteBuilderState } from '@/hooks/quotes/useQuoteBuilderState';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ state: null, pathname: '/orcamentos/novo' }),
  useParams: () => ({ id: undefined }),
  useSearchParams: () => [new URLSearchParams()],
}));

// Item fixo: qty 10 × R$100 = R$1000 de subtotal real (sem personalizações).
const FIXED_ITEMS = [
  {
    product_id: 'p-1',
    product_name: 'Produto Teste',
    product_sku: 'SKU-1',
    quantity: 10,
    unit_price: 100,
    personalizations: [],
  },
];

vi.mock('@/hooks/quotes', () => ({
  useQuotes: () => ({
    createQuote: vi.fn(),
    updateQuote: vi.fn(),
    fetchQuote: vi.fn(),
    isLoading: false,
  }),
  useQuoteTemplates: () => ({ templates: [] }),
  useSellerDiscountLimits: () => ({ myLimit: 10 }),
  useDiscountApproval: () => ({ requestApproval: vi.fn() }),
  useQuoteItems: () => ({
    items: FIXED_ITEMS,
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

describe('useQuoteBuilderState — isDiscountExceeded (alçada real)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('sem markup: desconto aparente = desconto real — 15% > limite 10% dispara aprovação', () => {
    const { result } = renderHook(() => useQuoteBuilderState(), { wrapper });

    act(() => {
      result.current.setDiscountType('percent');
      result.current.setDiscountValue(15);
    });

    expect(result.current.realDiscountPercent).toBe(15);
    expect(result.current.isDiscountExceeded).toBe(true);
  });

  it('sem markup: 10% == limite 10% — NÃO excede (boundary inclusiva)', () => {
    const { result } = renderHook(() => useQuoteBuilderState(), { wrapper });

    act(() => {
      result.current.setDiscountValue(10);
    });

    expect(result.current.realDiscountPercent).toBe(10);
    expect(result.current.isDiscountExceeded).toBe(false);
  });

  it('com markup 10%: desconto aparente 12% dilui para ~3,2% real — NÃO dispara aprovação', () => {
    const { result } = renderHook(() => useQuoteBuilderState(), { wrapper });

    act(() => {
      result.current.setNegotiationMarkup(10);
      result.current.setDiscountType('percent');
      result.current.setDiscountValue(12);
    });

    // presented = 1100; desconto = 132; final = 968; real = (1000-968)/1000 = 3,2%
    expect(result.current.realDiscountPercent).toBeCloseTo(3.2, 5);
    // 3,2% <= limite 10% → gate NÃO exige aprovação (markup funcionando como projetado)
    expect(result.current.isDiscountExceeded).toBe(false);
  });

  it('com markup 10%: desconto REAL acima do limite ainda dispara aprovação', () => {
    const { result } = renderHook(() => useQuoteBuilderState(), { wrapper });

    act(() => {
      result.current.setNegotiationMarkup(10);
      result.current.setDiscountType('percent');
      result.current.setDiscountValue(25);
    });

    // presented = 1100; desconto = 275; final = 825; real = (1000-825)/1000 = 17,5%
    expect(result.current.realDiscountPercent).toBeCloseTo(17.5, 5);
    expect(result.current.isDiscountExceeded).toBe(true);
  });

  it('desconto em R$ (amount): gate usa o percentual real, não o aparente', () => {
    const { result } = renderHook(() => useQuoteBuilderState(), { wrapper });

    act(() => {
      result.current.setNegotiationMarkup(10);
      result.current.setDiscountType('amount');
      result.current.setDiscountValue(150); // R$150 sobre presented 1100
    });

    // final = 1100 - 150 = 950; real = (1000-950)/1000 = 5% → dentro do limite 10%
    expect(result.current.realDiscountPercent).toBeCloseTo(5, 5);
    expect(result.current.isDiscountExceeded).toBe(false);
  });
});
