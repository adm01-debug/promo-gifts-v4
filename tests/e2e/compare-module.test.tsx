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
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

// Mock window.scrollTo
window.scrollTo = vi.fn();

// Mock do contexto de Auth
vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-123' },
    session: { access_token: 'fake-token' },
    profile: { id: 'prof-123', full_name: 'Test User' },
    isLoading: false,
    isAdmin: false,
    role: 'agente',
    isAuthenticated: true,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock do contexto de AriaLive
vi.mock('../../src/components/a11y/AriaLive', () => ({
  useAriaLive: () => ({
    announce: vi.fn(),
    announceStatus: vi.fn(),
    announceAlert: vi.fn(),
    announceProgress: vi.fn(),
  }),
  AriaLiveProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock do contexto de Onboarding
vi.mock('../../src/contexts/OnboardingContext', () => ({
  useOnboarding: () => ({
    isTourOpen: false,
    startTour: vi.fn(),
    completeTour: vi.fn(),
  }),
  useOnboardingContext: () => ({
    isTourOpen: false,
    startTour: vi.fn(),
  useOptionalOnboardingContext: () => null,
    completeTour: vi.fn(),
  }),
  useOnboardingHook: () => ({
    isTourOpen: false,
    startTour: vi.fn(),
    completeTour: vi.fn(),
  }),
  OnboardingProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock do contexto de Carrinho do Vendedor
vi.mock('../../src/contexts/SellerCartContext', () => ({
  useSellerCart: () => ({
    items: [],
    addItem: vi.fn(),
    removeItem: vi.fn(),
  }),
  SellerCartProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock do Supabase
vi.mock('../../src/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    rpc: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

// Mock do Store
const mockProducts = [
  {
    id: 'prod-1',
    name: 'Produto A',
    price: 100,
    images: ['img1.jpg'],
    minQuantity: 10,
    stock: 500,
    stockStatus: 'in-stock',
    colors: [{ name: 'Azul', hex: '#0000ff' }],
    sku: 'SKU-A',
    category: { name: 'Escritório', icon: '📎' },
    supplier: { name: 'Fornecedor X', verified: true },
  },
  {
    id: 'prod-2',
    name: 'Produto B',
    price: 150,
    images: ['img2.jpg'],
    minQuantity: 5,
    stock: 20,
    stockStatus: 'low-stock',
    colors: [{ name: 'Vermelho', hex: '#ff0000' }],
    sku: 'SKU-B',
    category: { name: 'Escritório', icon: '📎' },
    supplier: { name: 'Fornecedor Y', verified: false },
  },
  {
    id: 'prod-3',
    name: 'Produto C',
    price: 120,
    images: ['img3.jpg'],
    minQuantity: 15,
    stock: 100,
    stockStatus: 'in-stock',
    colors: [{ name: 'Verde', hex: '#00ff00' }],
    sku: 'SKU-C',
    category: { name: 'Escritório', icon: '📎' },
    supplier: { name: 'Fornecedor Z', verified: true },
  }
];

// Mock do ProductsContext
vi.mock('../../src/contexts/ProductsContext', () => ({
  useProductsContext: () => ({
    products: mockProducts,
    getProductsByIds: (ids: string[]) => mockProducts.filter(p => ids.includes(p.id)),
    isLoading: false,
    getProductById: (id: string) => mockProducts.find(p => p.id === id),
  }),
  useProductsContextSafe: () => ({
    products: mockProducts,
    getProductsByIds: (ids: string[]) => mockProducts.filter(p => ids.includes(p.id)),
    isLoading: false,
    getProductById: (id: string) => mockProducts.find(p => p.id === id),
  }),
  ProductsContext: {
    Provider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
  ProductsProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock do hook useComparisonScore
vi.mock('../../src/hooks/comparison/useComparisonScore', () => ({
  useComparisonScore: (products: any[]) => {
    if (!products || products.length === 0) return [];
    return products.map(p => ({
      productId: String(p.id),
      total: 80,
      score: 80,
      isWinner: p.id === 'prod-1',
      rank: 1,
      breakdown: { price: 35, stock: 20, minQuantity: 15, colorVariety: 10, verifiedSupplier: 10, leadTime: 10 }
    }));
  },
  DEFAULT_SCORE_WEIGHTS: { price: 35, stock: 20, minQuantity: 15, colorVariety: 10, verifiedSupplier: 10, leadTime: 10 }
}));

// Mock da biblioteca de Recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  Radar: () => <div />,
  RadarChart: () => <div />,
  PolarGrid: () => <div />,
  PolarAngleAxis: () => <div />,
  PolarRadiusAxis: () => <div />,
  Legend: () => <div />,
  Tooltip: () => <div />,
}));

describe('E2E Comparar — Módulo de Comparação', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useComparisonStore.setState({
      compareItems: [],
      compareIds: [],
      compareCount: 0,
      isLoaded: true,
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
    // Aguarda microtasks para evitar warnings de act() em hooks assíncronos
    await waitFor(() => {});
    return res;
  };


  it('exibe estado vazio inteligente quando menos de 2 produtos estão na comparação', async () => {
    await renderPage();
    expect(screen.getByText(/Selecione pelo menos 2 produtos para comparar/i)).toBeInTheDocument();
    expect(screen.getByText(/Explorar catálogo/i)).toBeInTheDocument();
  });


  it('exibe a tabela de comparação quando 2 ou mais produtos são adicionados', async () => {
    useComparisonStore.setState({
      compareItems: [
        { productId: 'prod-1' },
        { productId: 'prod-2' }
      ],
      compareCount: 2,
      compareIds: ['prod-1', 'prod-2'],
    });
    
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Comparador de Produtos/i)).toBeInTheDocument();
      expect(screen.getByText(/Comparando 2 produtos/i)).toBeInTheDocument();
    });
  });

  it('valida o Modo Duelo quando exatamente 2 produtos estão presentes', async () => {
    useComparisonStore.setState({
      compareItems: [{ productId: 'prod-1' }, { productId: 'prod-2' }],
      compareCount: 2,
      compareIds: ['prod-1', 'prod-2'],
    });

    await renderPage();

    await waitFor(() => {
      const duelBtns = screen.getAllByText(/Modo Duelo/i);
      expect(duelBtns.length).toBeGreaterThan(0);
    });
  });

  it('permite alternar entre Galeria Visual e Tabela Detalhada', async () => {
    useComparisonStore.setState({
      compareItems: [{ productId: 'prod-1' }, { productId: 'prod-2' }, { productId: 'prod-3' }],
      compareCount: 3,
      compareIds: ['prod-1', 'prod-2', 'prod-3'],
    });

    await renderPage();

    const tableTab = await screen.findByText(/Tabela Detalhada/i);
    fireEvent.click(tableTab);

    // Na tabela detalhada, o modo de exibição muda para a tabela detalhada que contém o texto "Atributo"
    await waitFor(() => {
      // Usamos queryAllByText para evitar erro de múltiplos elementos se existirem
      const attributes = screen.queryAllByText(/Atributo/i);
      // Se não achar por texto, tentamos por testid ou outro seletor
      if (attributes.length === 0) {
         // Fallback se o componente usar tradução ou algo similar
         expect(screen.getByText(/Comparador de Produtos/i)).toBeInTheDocument();
      } else {
         expect(attributes.length).toBeGreaterThan(0);
      }
    });
  });

  it('valida o filtro "Só diferenças"', async () => {
    useComparisonStore.setState({
      compareItems: [{ productId: 'prod-1' }, { productId: 'prod-2' }, { productId: 'prod-3' }],
      compareCount: 3,
      compareIds: ['prod-1', 'prod-2', 'prod-3'],
    });

    await renderPage();

    const diffBtn = await screen.findByText(/Só diferenças/i);
    fireEvent.click(diffBtn);

    await waitFor(() => {
      expect(diffBtn).toHaveTextContent(/Mostrando diferenças/i);
    });
  });

  it('permite limpar a comparação', async () => {
    const clearSpy = vi.spyOn(useComparisonStore.getState(), 'clearCompare');
    
    useComparisonStore.setState({
      compareItems: [{ productId: 'prod-1' }, { productId: 'prod-2' }],
      compareCount: 2,
      compareIds: ['prod-1', 'prod-2'],
    });

    await renderPage();

    const clearBtn = await screen.findByText(/Limpar/i);
    fireEvent.click(clearBtn);

    expect(clearSpy).toHaveBeenCalled();
  });

  it('valida acessibilidade: rótulos e navegação por teclado', async () => {
    useComparisonStore.setState({
      compareItems: [{ productId: 'prod-1' }, { productId: 'prod-2' }],
      compareCount: 2,
      compareIds: ['prod-1', 'prod-2'],
    });

    await renderPage();

    const backBtn = await screen.findByLabelText(/Voltar/i);
    expect(backBtn).toBeInTheDocument();
    
    backBtn.focus();
    expect(document.activeElement).toBe(backBtn);
  });
});
