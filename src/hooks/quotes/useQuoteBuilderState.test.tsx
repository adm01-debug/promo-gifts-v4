/* eslint-disable @typescript-eslint/require-await */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQuoteBuilderState } from './useQuoteBuilderState';
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

vi.mock('@/hooks/quotes', () => {
  return {
    useQuotes: () => ({
      createQuote: vi.fn(),
      updateQuote: vi.fn(),
      fetchQuote: vi.fn(),
      isLoading: false,
    }),
    useQuoteTemplates: () => ({ templates: [] }),
    useSellerDiscountLimits: () => ({ myLimit: 10 }),
    useDiscountApproval: () => ({ requestApproval: vi.fn() }),
    useAutoSaveQuote: () => ({ clearAutoSave: vi.fn() }),
    useQuoteItems: () => ({
      items: [],
      setItems: vi.fn(),
      addProductWithColor: vi.fn(),
      updateItemQuantity: vi.fn(),
      updateItemPrice: vi.fn(),
      removeItem: vi.fn(),
      handlePersonalizationsChange: vi.fn(),
      confirmItemPrice: vi.fn(),
    }),
  };
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>{children}</BrowserRouter>
  </QueryClientProvider>
);

describe('useQuoteBuilderState E2E Logic', () => {
  it('should initialize with default state', () => {
    const { result } = renderHook(() => useQuoteBuilderState(), { wrapper });

    expect(result.current.activeStep).toBe('client');
    expect(result.current.clientId).toBe('');
    expect(result.current.items).toEqual([]);
  });

  it('should validate steps correctly', () => {
    const { result } = renderHook(() => useQuoteBuilderState(), { wrapper });

    // Step 1: Client
    act(() => {
      result.current.setClientId('client-1');
      result.current.setContactId('contact-1');
    });

    expect(result.current.completedSteps).toContain('client');

    // Step 2: Conditions
    act(() => {
      result.current.setPaymentMethod('boleto');
      result.current.setPaymentTerms('7_dias');
      result.current.setDeliveryTime('10 dias');
      result.current.setShippingType('cif');
    });

    expect(result.current.completedSteps).toContain('conditions');
  });

  it('should handle navigation between steps', () => {
    const { result } = renderHook(() => useQuoteBuilderState(), { wrapper });

    // Initial step is 'client'
    expect(result.current.activeStep).toBe('client');

    // Fill client info
    act(() => {
      result.current.setClientId('client-1');
      result.current.setContactId('contact-1');
    });

    // Move to next step
    act(() => {
      result.current.nextStep();
    });

    expect(result.current.activeStep).toBe('conditions');
  });
});
