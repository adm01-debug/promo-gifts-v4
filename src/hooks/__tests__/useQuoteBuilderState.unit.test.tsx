import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQuoteBuilderState } from '@/hooks/quotes/useQuoteBuilderState';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import React from 'react';

// Mock dependencies
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
  useParams: vi.fn(() => ({})),
  useSearchParams: vi.fn(() => [new URLSearchParams()]),
  useLocation: vi.fn(() => ({ pathname: '/', state: {} })),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'test-user' } })),
}));

// Mock hooks de @/hooks/quotes (factory unico — multiplos vi.mock no mesmo path se sobrescrevem; so o ultimo vence)
vi.mock('@/hooks/quotes', () => ({
  useSellerDiscountLimits: vi.fn(() => ({ myLimit: 10 })),
  useDiscountApproval: vi.fn(() => ({ requestApproval: vi.fn() })),
  useQuotes: vi.fn(() => ({
    createQuote: vi.fn(),
    updateQuote: vi.fn(),
    fetchQuote: vi.fn(),
    isLoading: false,
  })),
  useQuoteItems: vi.fn(() => ({
    items: [],
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
  })),
  useAutoSaveQuote: vi.fn(() => ({ clearAutoSave: vi.fn() })),
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

describe('useQuoteBuilderState Navigation and Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Resetting body to clear aria-live announcer if needed
    document.body.innerHTML = '<div id="quote-builder-announcer"></div>';
  });

  it('starts at "client" step', () => {
    const { result } = renderHook(() => useQuoteBuilderState(), { wrapper });
    expect(result.current.currentStep).toBe('client');
  });

  it('prevents nextStep if client/contact not selected', () => {
    const { result } = renderHook(() => useQuoteBuilderState(), { wrapper });

    act(() => {
      result.current.nextStep();
    });

    expect(toast.error).toHaveBeenCalledWith('Selecione um cliente');
    expect(result.current.currentStep).toBe('client');
  });

  it('allows nextStep if client/contact are selected', () => {
    const { result } = renderHook(() => useQuoteBuilderState(), { wrapper });

    act(() => {
      result.current.setClientId('company-1');
      result.current.setContactId('contact-1');
    });

    act(() => {
      result.current.nextStep();
    });

    expect(result.current.currentStep).toBe('conditions');
  });

  it('prevents moving to conditions if items are missing when skipping', () => {
    const { result } = renderHook(() => useQuoteBuilderState(), { wrapper });

    act(() => {
      result.current.setClientId('company-1');
      result.current.setContactId('contact-1');
    });

    act(() => {
      result.current.goToStep('items');
    });

    // Validates 'client' and 'conditions'. 'conditions' will fail.
    expect(toast.error).toHaveBeenCalledWith('Selecione a forma de pagamento');
    expect(result.current.currentStep).toBe('client');
  });

  it('allows jumping back to a previous step without validation', () => {
    const { result } = renderHook(() => useQuoteBuilderState(), { wrapper });

    act(() => {
      result.current.setClientId('company-1');
      result.current.setContactId('contact-1');
    });

    // Re-render happens after each act
    expect(result.current.clientId).toBe('company-1');
    expect(result.current.contactId).toBe('contact-1');

    act(() => {
      result.current.nextStep();
    });

    expect(result.current.currentStep).toBe('conditions');

    act(() => {
      result.current.goToStep('client');
    });

    expect(result.current.currentStep).toBe('client');
  });

  it('announces errors for screen readers', () => {
    const { result } = renderHook(() => useQuoteBuilderState(), { wrapper });

    act(() => {
      result.current.nextStep();
    });

    const announcer = document.getElementById('quote-builder-announcer');
    expect(announcer?.textContent).toBe('Erro: Selecione um cliente');
  });
});
