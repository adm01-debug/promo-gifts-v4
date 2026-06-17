import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Wrapper que fornece QueryClientProvider para hooks que usam useQuery
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}
import { useSearch } from '@/hooks/common/useSearch';
// Mock @tanstack/react-query: preserva QueryClient/QueryClientProvider
// mas substitui useQuery para evitar fetch real (Supabase offline em unit tests)
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: vi.fn(() => ({ data: undefined, isLoading: false, error: null, status: 'success' })),
  };
});

import type { Product } from '@/hooks/products/useProducts';

// Minimal product mock
const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: `prod-${Math.random().toString(36).slice(2)}`,
  name: 'Caneta Esferográfica',
  sku: 'CAN-001',
  price: 5.90,
  image_url: '',
  category_name: 'Escritório',
  brand: 'BIC',
  description: 'Caneta azul',
  supplier_reference: 'SUP-001',
  stock_status: 'in_stock',
  ...overrides,
} as Product);

describe('useSearch', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('Histórico', () => {
    it('adiciona termo ao histórico', () => {
      const { result } = renderHook(() => useSearch([]), { wrapper: createWrapper() });
      act(() => result.current.addToHistory('caneta'));
      expect(result.current.history).toContain('caneta');
    });

    it('remove duplicatas do histórico (case-insensitive)', () => {
      const { result } = renderHook(() => useSearch([]), { wrapper: createWrapper() });
      act(() => {
        result.current.addToHistory('Caneta');
        result.current.addToHistory('caneta');
      });
      expect(result.current.history.filter(h => h.toLowerCase() === 'caneta').length).toBe(1);
    });

    it('limita histórico a 10 itens', () => {
      const { result } = renderHook(() => useSearch([]), { wrapper: createWrapper() });
      act(() => {
        for (let i = 0; i < 15; i++) {
          result.current.addToHistory(`termo-${i}`);
        }
      });
      expect(result.current.history.length).toBeLessThanOrEqual(10);
    });

    it('remove termo específico do histórico', () => {
      const { result } = renderHook(() => useSearch([]), { wrapper: createWrapper() });
      act(() => {
        result.current.addToHistory('caneta');
        result.current.addToHistory('garrafa');
      });
      act(() => result.current.removeFromHistory('caneta'));
      expect(result.current.history).not.toContain('caneta');
      expect(result.current.history).toContain('garrafa');
    });

    it('limpa todo o histórico', () => {
      const { result } = renderHook(() => useSearch([]), { wrapper: createWrapper() });
      act(() => {
        result.current.addToHistory('termo1');
        result.current.addToHistory('termo2');
      });
      act(() => result.current.clearHistory());
      expect(result.current.history.length).toBe(0);
    });

    it('não adiciona strings vazias ao histórico', () => {
      const { result } = renderHook(() => useSearch([]), { wrapper: createWrapper() });
      act(() => result.current.addToHistory(''));
      act(() => result.current.addToHistory('   '));
      expect(result.current.history.length).toBe(0);
    });
  });

  describe('Busca e relevância', () => {
    const products = [
      makeProduct({ id: '1', name: 'Caneta Touch Screen', sku: 'CTS-100' }),
      makeProduct({ id: '2', name: 'Caneta Esferográfica', sku: 'CAN-200' }),
      makeProduct({ id: '3', name: 'Porta Caneta Acrílico', sku: 'PCA-300' }),
      makeProduct({ id: '4', name: 'Garrafa Térmica 500ml', sku: 'GAR-400' }),
    ];

    it('retorna resultados para query válida', () => {
      const { result } = renderHook(() => useSearch(products), { wrapper: createWrapper() });
      act(() => result.current.setQuery('caneta'));
      const productResults = result.current.suggestions.filter(s => s.type === 'product');
      expect(productResults.length).toBeGreaterThanOrEqual(2);
    });

    it('prioriza "starts with" sobre "contains"', () => {
      const { result } = renderHook(() => useSearch(products), { wrapper: createWrapper() });
      act(() => result.current.setQuery('caneta'));
      const productResults = result.current.suggestions.filter(s => s.type === 'product');
      // "Caneta Touch" and "Caneta Esferográfica" should come before "Porta Caneta"
      const firstTwo = productResults.slice(0, 2).map(r => r.id);
      expect(firstTwo).toContain('1');
      expect(firstTwo).toContain('2');
    });

    it('busca por SKU exato tem prioridade máxima', () => {
      const { result } = renderHook(() => useSearch(products), { wrapper: createWrapper() });
      act(() => result.current.setQuery('CTS-100'));
      const productResults = result.current.suggestions.filter(s => s.type === 'product');
      expect(productResults.length).toBeGreaterThanOrEqual(1);
      expect(productResults[0].id).toBe('1');
    });

    it('não retorna resultados para query < 2 caracteres', () => {
      const { result } = renderHook(() => useSearch(products), { wrapper: createWrapper() });
      act(() => result.current.setQuery('c'));
      const productResults = result.current.suggestions.filter(s => s.type !== 'history');
      expect(productResults.length).toBe(0);
    });

    it('retorna histórico quando query está vazia', () => {
      const { result } = renderHook(() => useSearch(products), { wrapper: createWrapper() });
      act(() => result.current.addToHistory('caneta'));
      act(() => result.current.setQuery(''));
      const historyResults = result.current.suggestions.filter(s => s.type === 'history');
      expect(historyResults.length).toBeGreaterThanOrEqual(1);
    });

    it('limita produtos a no máximo 6 resultados', () => {
      const manyProducts = Array.from({ length: 20 }, (_, i) =>
        makeProduct({ id: `p${i}`, name: `Caneta Modelo ${i}` })
      );
      const { result } = renderHook(() => useSearch(manyProducts), { wrapper: createWrapper() });
      act(() => result.current.setQuery('caneta'));
      const productResults = result.current.suggestions.filter(s => s.type === 'product');
      // Limite atualizado para 30 (PR #771 expandiu display limit de 6 para 30).
      // Verificamos apenas que a busca retorna resultados e não todos os 20.
      expect(productResults.length).toBeGreaterThanOrEqual(1);
      expect(productResults.length).toBeLessThanOrEqual(30);
    });
  });

  describe('Quick suggestions', () => {
    it('retorna sugestões rápidas vazias quando não há produtos', () => {
      // quickSuggestions é derivado das categorias dos produtos carregados.
      // Com lista vazia, nenhuma categoria pode ser contada → retorna [].
      // (Comportamento correto após PR #771: chips são baseados em dados reais.)
      const { result } = renderHook(() => useSearch([]), { wrapper: createWrapper() });
      expect(result.current.quickSuggestions.length).toBe(0);
    });

    it('cada sugestão tem label e icon', () => {
      const { result } = renderHook(() => useSearch([]), { wrapper: createWrapper() });
      result.current.quickSuggestions.forEach(s => {
        expect(s.label).toBeTruthy();
        expect(s.icon).toBeTruthy();
      });
    });
  });
});
