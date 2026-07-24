import { renderHook, act } from '@testing-library/react';
import { useQuoteBuilderState } from '@/hooks/quotes/useQuoteBuilderState';
import { toast } from 'sonner';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock dependências externas
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ state: null }),
  useParams: () => ({ id: undefined }),
  useSearchParams: () => [new URLSearchParams()],
}));

// Mock dos hooks customizados
// Mock dos hooks @/hooks/quotes (factory unico — multiplos vi.mock no mesmo path se sobrescrevem)
vi.mock('@/hooks/quotes', () => ({
  useQuotes: () => ({
    createQuote: vi.fn(),
    updateQuote: vi.fn(),
    fetchQuote: vi.fn(),
    isLoading: false,
  }),
  useSellerDiscountLimits: () => ({ myLimit: 50 }),
  useDiscountApproval: () => ({ requestApproval: vi.fn() }),
  useQuoteItems: () => ({
    items: [],
    setItems: vi.fn(),
    activeItemIndex: null,
    setActiveItemIndex: vi.fn(),
    expandedItems: new Set(),
    setExpandedItems: vi.fn(),
    toggleExpanded: vi.fn(),
    updateItemQuantity: vi.fn(),
    updateItemPrice: vi.fn(),
    removeItem: vi.fn(),
    handlePersonalizationsChange: vi.fn(),
    confirmItemPrice: vi.fn(),
  }),
  useAutoSaveQuote: () => ({ clearAutoSave: vi.fn() }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-123' },
  }),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useQuoteBuilderState - Shipping Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should validate shipping requirement in conditions step', () => {
    const { result } = renderHook(() => useQuoteBuilderState(), { wrapper });

    // Configura estado inicial válido para etapa de cliente + outros campos de condições
    act(() => {
      result.current.setClientId('client-123');
      result.current.setContactId('contact-456');
      result.current.setPaymentMethod('boleto');
      result.current.setPaymentTerms('7_dias');
      result.current.setDeliveryTime('7_dias');
    });

    let isValid = false;
    act(() => {
      isValid = result.current.validateStep('conditions');
    });

    expect(isValid).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Selecione a modalidade de frete');
  });

  it('should require shipping cost for fob_pre mode', () => {
    const { result } = renderHook(() => useQuoteBuilderState(), { wrapper });

    act(() => {
      result.current.setClientId('client-123');
      result.current.setContactId('contact-456');
      result.current.setPaymentMethod('boleto');
      result.current.setPaymentTerms('7_dias');
      result.current.setDeliveryTime('7_dias');
      result.current.setShippingType('fob_pre');
      result.current.setShippingCost(0); // Valor zerado/vazio
    });

    let isValid = false;
    act(() => {
      isValid = result.current.validateStep('conditions');
    });

    expect(isValid).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Informe o valor do frete pré-negociado');
  });

  it('should reset shipping cost when switching from fob_pre to cif', () => {
    const { result } = renderHook(() => useQuoteBuilderState(), { wrapper });

    act(() => {
      result.current.setShippingType('fob_pre');
      result.current.setShippingCost(150);
    });

    expect(result.current.shippingCost).toBe(150);

    act(() => {
      result.current.setShippingType('cif');
    });

    expect(result.current.shippingType).toBe('cif');
    expect(result.current.shippingCost).toBe(0);
  });
});
