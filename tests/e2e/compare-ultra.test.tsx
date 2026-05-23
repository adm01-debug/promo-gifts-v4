import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ComparePage from '../../src/pages/products/ComparePage';
import { useComparisonStore } from '../../src/stores/useComparisonStore';
import { TooltipProvider } from '../../src/components/ui/tooltip';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

// Mock window.scrollTo
window.scrollTo = vi.fn();

// Mocks consolidados
vi.mock('../../src/components/a11y/AriaLive', () => ({
  useAriaLive: () => ({ announce: vi.fn(), announceStatus: vi.fn() }),
  AriaLiveProvider: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' }, isAuthenticated: true, role: 'agente' }),
  AuthProvider: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../../src/contexts/OnboardingContext', () => ({
  useOnboarding: () => ({ isTourOpen: false }),
  useOnboardingContext: () => ({ isTourOpen: false, startTour: vi.fn(), completeTour: vi.fn() }),
  useOptionalOnboardingContext: () => null,
  OnboardingProvider: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../../src/contexts/SellerCartContext', () => ({
  useSellerCart: () => ({ items: [] }),
  SellerCartProvider: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../../src/integrations/supabase/client', () => {
  const chain = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    then: vi.fn().mockImplementation((cb) => Promise.resolve({ data: [] }).then(cb)),
  };
  return {
    supabase: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
      from: vi.fn().mockReturnValue(chain), rpc: vi.fn().mockResolvedValue({ data: [] }),
    },
  };
});

const mockProducts = [
  { id: 'p1', name: 'Prod 1', price: 10, images: ['i1.jpg'], minQuantity: 1, stock: 10, stockStatus: 'in-stock', colors: [], sku: 'S1', category: { name: 'C1' }, supplier: { name: 'S1' } },
  { id: 'p2', name: 'Prod 2', price: 20, images: ['i2.jpg'], minQuantity: 2, stock: 20, stockStatus: 'in-stock', colors: [], sku: 'S2', category: { name: 'C1' }, supplier: { name: 'S1' } }
];

vi.mock('../../src/contexts/ProductsContext', () => ({
  useProductsContext: () => ({ products: mockProducts, getProductsByIds: (ids: string[]) => mockProducts.filter(p => ids.includes(p.id)) }),
  useProductsContextSafe: () => ({ products: mockProducts, getProductsByIds: (ids: string[]) => mockProducts.filter(p => ids.includes(p.id)) }),
  ProductsContext: { Provider: ({ children }: any) => <div>{children}</div> },
  ProductsProvider: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="recharts-container">{children}</div>,
  Radar: () => <div />, RadarChart: ({ children }: any) => <div>{children}</div>,
  PolarGrid: () => <div />, PolarAngleAxis: () => <div />, PolarRadiusAxis: () => <div />,
  Legend: () => <div />, Tooltip: () => <div />,
  LineChart: ({ children }: any) => <div>{children}</div>, Line: () => <div />,
}));

vi.mock('../../src/components/layout/MainLayout', () => ({
  MainLayout: ({ children }: any) => <div data-testid="main-layout">{children}</div>,
}));

describe('Módulo Comparar - Ultra Avançado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useComparisonStore.setState({
      compareItems: [{ productId: 'p1' }, { productId: 'p2' }],
      compareCount: 2, compareIds: ['p1', 'p2'], isLoaded: true,
    });
  });

  const renderPage = async () => {
    const res = render(
      <QueryClientProvider client={queryClient}>
        <HelmetProvider>
          <BrowserRouter>
            <TooltipProvider>
              <ComparePage />
            </TooltipProvider>
          </BrowserRouter>
        </HelmetProvider>
      </QueryClientProvider>
    );
    await waitFor(() => {});
    return res;
  };

  it('Performance: Renderiza interface principal sob carga simulada', async () => {
    const t0 = performance.now();
    await renderPage();
    const t1 = performance.now();
    console.log(`Render time: ${t1 - t0}ms`);
    expect(await screen.findByText(/Comparador de Produtos/i)).toBeInTheDocument();
    expect(t1 - t0).toBeLessThan(1000); // Assert de performance
  });

  it('Acessibilidade: Elementos críticos possuem rótulos adequados', async () => {
    await renderPage();
    expect(screen.getByLabelText(/Voltar/i)).toBeInTheDocument();
    const duelBtns = await screen.findAllByText(/Modo Duelo/i);
    expect(duelBtns.length).toBeGreaterThan(0);
  });

  it('Resiliência AI: Carrega Advisor AI graciosamente', async () => {
    await renderPage();
    // O componente usa o termo "Conselheiro IA"
    expect(await screen.findByText(/Conselheiro IA/i)).toBeInTheDocument();
    expect(screen.getByText(/Analisar com IA/i)).toBeInTheDocument();
  });
});



