import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQuoteBuilderState } from '@/hooks/quotes/useQuoteBuilderState';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';

// Mocks
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: undefined }),
    useSearchParams: () => [new URLSearchParams()],
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user-id' } }),
}));

vi.mock('@/hooks/quotes', async () => {
  const actual = await vi.importActual('@/hooks/quotes');
  return {
    ...actual,
    useQuotes: () => ({
      createQuote: vi.fn(async () => ({ id: 'new-id', quote_number: 'ORC-1' })),
      updateQuote: vi.fn(),
      fetchQuote: vi.fn(),
      isLoading: false,
    }),
    useQuoteTemplates: () => ({ templates: [] }),
    useSellerDiscountLimits: () => ({ myLimit: 10 }),
    useDiscountApproval: () => ({ requestApproval: vi.fn() }),
  };
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>{children}</BrowserRouter>
  </QueryClientProvider>
);

describe('QuoteBuilder Full E2E Flow (Logic)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete the full wizard flow logically', async () => {
    const { result } = renderHook(() => useQuoteBuilderState(), { wrapper });

    // 1. Cliente
    act(() => {
      result.current.setClientId('client-1');
      result.current.setContactId('contact-1');
    });
    expect(result.current.completedSteps).toContain('client');

    // 2. Condições
    act(() => {
      result.current.setPaymentMethod('boleto');
      result.current.setPaymentTerms('7_dias');
      result.current.setDeliveryTime('14_dias');
      result.current.setShippingType('cif');
    });
    expect(result.current.completedSteps).toContain('conditions');

    // 3. Itens
    act(() => {
      result.current.setItems([{
        product_id: 'prod-1',
        product_name: 'Caneta',
        quantity: 100,
        unit_price: 10,
        personalizations: []
      }]);
    });
    expect(result.current.completedSteps).toContain('items');

    // 4. Revisão e "Envio" (Validação de Form)
    expect(result.current.isFormValid).toBe(true);
    
    // Testar transição de steps
    act(() => { result.current.goToStep('conditions'); });
    expect(result.current.activeStep).toBe('conditions');
    
    act(() => { result.current.goToStep('review'); });
    expect(result.current.activeStep).toBe('review');
  });
});
