/**
 * Regressão — backward-compat da URL `?minStock=N`:
 *   1. link antigo continua aplicando o filtro consolidado de estoque mínimo
 *   2. `handleReset` zera o estado para `defaultFilters` (minStock = 0)
 *   3. múltiplas variantes/cores: produto entra se PELO MENOS UMA variação
 *      satisfizer o mínimo, e o estoque consolidado (sum) permanece íntegro
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import { useFiltersPageState } from '../useFiltersPageState';

// URL com ?minStock=300 — simula link antigo compartilhado.
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams('minStock=300'), vi.fn()],
  };
});

vi.mock('@/hooks/products/useProductsLightweight', () => ({
  useProductsCatalog: vi.fn(() => ({
    data: {
      pages: [
        {
          products: [
            // produto com 3 variantes — total 600, mas só Verde (500) >= 300
            {
              id: 'p1',
              name: 'Caneta Multi-Cor',
              price: 10,
              stock: 600,
              variations: [
                { id: 'v-azul', stock: 50 },
                { id: 'v-verde', stock: 500 },
                { id: 'v-vermelho', stock: 50 },
              ],
            },
            // produto cujo total agregado é alto mas nenhuma variante atinge 300
            {
              id: 'p2',
              name: 'Caderno Mini',
              price: 5,
              stock: 400,
              variations: [
                { id: 'v-a', stock: 100 },
                { id: 'v-b', stock: 100 },
                { id: 'v-c', stock: 200 },
              ],
            },
            // sem variantes, stock consolidado >= 300 → passa via fallback
            { id: 'p3', name: 'Mochila Solo', price: 50, stock: 350, variations: [] },
          ],
          totalEstimate: 3,
        },
      ],
    },
    isLoading: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    isFetchingNextPage: false,
  })),
}));

vi.mock('@/hooks/products/useProductsByCategory', () => ({
  useProductsByCategory: () => ({ productIds: new Set(), hasFilter: false, isLoading: false }),
}));
vi.mock('@/hooks/products/useProductsByColor', () => ({
  useProductsByColor: () => ({ productIds: new Set(), hasFilter: false, isLoading: false }),
}));
vi.mock('@/hooks/products/useProductsByMaterial', () => ({
  useProductsByMaterial: () => ({ productIds: new Set(), hasFilter: false, isLoading: false }),
}));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>{children}</BrowserRouter>
  </QueryClientProvider>
);

describe('useFiltersPageState — minStock URL & reset', () => {
  beforeEach(() => vi.clearAllMocks());

  it('parseia ?minStock=300 e aplica o filtro consolidado', () => {
    const { result } = renderHook(() => useFiltersPageState(), { wrapper });
    expect(result.current.filters.minStock).toBe(300);
    expect(result.current.activeFiltersCount).toBeGreaterThanOrEqual(1);
  });

  it('múltiplas variantes — entra se ao menos uma variação satisfaz o mínimo', () => {
    const { result } = renderHook(() => useFiltersPageState(), { wrapper });
    const ids = result.current.filteredProducts.map((p) => p.id);
    // p1 (Verde=500) e p3 (fallback stock=350) passam; p2 (max=200) fica de fora
    expect(ids).toContain('p1');
    expect(ids).toContain('p3');
    expect(ids).not.toContain('p2');
  });

  it('estoque consolidado por produto permanece íntegro após filtro', () => {
    const { result } = renderHook(() => useFiltersPageState(), { wrapper });
    const p1 = result.current.filteredProducts.find((p) => p.id === 'p1');
    // Soma das variantes (50+500+50) preservada — filtro não muta o produto
    expect(p1?.stock).toBe(600);
  });

  it('handleReset zera minStock e o activeFiltersCount', () => {
    const { result } = renderHook(() => useFiltersPageState(), { wrapper });
    expect(result.current.filters.minStock).toBe(300);
    act(() => {
      result.current.handleReset();
    });
    expect(result.current.filters.minStock).toBe(0);
    expect(result.current.activeFiltersCount).toBe(0);
    // Sem o filtro, todos os produtos voltam à lista
    expect(result.current.filteredProducts.length).toBe(3);
  });
});
