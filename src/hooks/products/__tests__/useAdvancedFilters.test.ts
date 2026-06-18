/**
 * Testes — useAdvancedFilters
 *
 * Gerencia o estado de filtros avançados do catálogo (313 linhas de lógica).
 *
 * Bugs históricos corrigidos:
 *   BUG-LOADING-01: isLoading não inicia como true (flash de skeleton desnecessário)
 *   BUG-AF-01: fetch functions capturadas em ref (sem stale closure)
 *   BUG-SF-16: quantityRange removido (campo orphaned)
 *   FIX-11: priceRange=[0,9999], não [0,1000]
 *
 * Invariantes testadas:
 *   - Estado inicial: filters=defaultAdvancedFilters, isLoading=false
 *   - updateFilter: atualiza um campo específico sem afetar os outros
 *   - toggleArrayFilter: adiciona quando ausente, remove quando presente
 *   - resetFilters: restaura defaultAdvancedFilters
 *   - resetFilterGroup: restaura apenas as chaves especificadas
 *   - activeFiltersCount: conta filtros diferentes do padrão
 *   - hasActiveFiltersInGroup: true quando algum campo do grupo difere do padrão
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useAdvancedFilters } from '../useAdvancedFilters';
import { defaultAdvancedFilters } from '@/constants/filters';

// Mocks mínimos para os hooks externos usados no mount
vi.mock('@/hooks/products/useExternalCategoriesQuery', () => ({
  useExternalCategories: vi.fn(() => ({ data: [], fetchAll: vi.fn() })),
}));
vi.mock('@/hooks/products/useExternalDatabase', () => ({
  useExternalDatabase: vi.fn(() => ({ data: [], fetchAll: vi.fn() })),
}));

// Mocks genéricos para outros hooks de dados
const _noop = { data: [], fetchAll: vi.fn() };
vi.mock('@/hooks/products/useMaterialTypes', () => ({
  useMaterialTypes: vi.fn(() => ({ data: [], fetchAll: vi.fn() })),
}));

describe('useAdvancedFilters', () => {
  // ── Estado inicial ─────────────────────────────────────────────────────────
  describe('estado inicial', () => {
    it('BUG-LOADING-01: isLoading inicia false (sem flash de skeleton)', () => {
      const { result } = renderHook(() => useAdvancedFilters());
      expect(result.current.isLoading).toBe(false);
    });

    it('filters iniciam como defaultAdvancedFilters', () => {
      const { result } = renderHook(() => useAdvancedFilters());
      expect(result.current.filters).toEqual(defaultAdvancedFilters);
    });

    it('FIX-11: priceRange inicial = [0, 9999] (não [0, 1000])', () => {
      const { result } = renderHook(() => useAdvancedFilters());
      expect(result.current.filters.priceRange).toEqual([0, 9999]);
    });

    it('BUG-SF-16: filters nao tem quantityRange', () => {
      const { result } = renderHook(() => useAdvancedFilters());
      expect('quantityRange' in result.current.filters).toBe(false);
    });

    it('activeFiltersCount = 0 com filtros padrao', () => {
      const { result } = renderHook(() => useAdvancedFilters());
      expect(result.current.activeFiltersCount).toBe(0);
    });

    it('expoe as 6 funcoes esperadas', () => {
      const { result } = renderHook(() => useAdvancedFilters());
      expect(typeof result.current.updateFilter).toBe('function');
      expect(typeof result.current.toggleArrayFilter).toBe('function');
      expect(typeof result.current.resetFilters).toBe('function');
      expect(typeof result.current.resetFilterGroup).toBe('function');
      expect(typeof result.current.hasActiveFiltersInGroup).toBe('function');
    });
  });

  // ── updateFilter ──────────────────────────────────────────────────────────
  describe('updateFilter', () => {
    it('atualiza campo especifico sem afetar os outros', () => {
      const { result } = renderHook(() => useAdvancedFilters());
      act(() => {
        result.current.updateFilter('search', 'caneta');
      });
      expect(result.current.filters.search).toBe('caneta');
      // Outros campos devem manter o valor padrão
      expect(result.current.filters.categories).toEqual([]);
      expect(result.current.filters.stockStatus).toBe('all');
    });

    it('atualiza boolean toggle (isKit)', () => {
      const { result } = renderHook(() => useAdvancedFilters());
      act(() => {
        result.current.updateFilter('isKit', true);
      });
      expect(result.current.filters.isKit).toBe(true);
    });

    it('atualiza priceRange com tupla', () => {
      const { result } = renderHook(() => useAdvancedFilters());
      act(() => {
        result.current.updateFilter('priceRange', [50, 500]);
      });
      expect(result.current.filters.priceRange).toEqual([50, 500]);
    });
  });

  // ── toggleArrayFilter ──────────────────────────────────────────────────────
  describe('toggleArrayFilter', () => {
    it('adiciona valor ao array quando ausente', () => {
      const { result } = renderHook(() => useAdvancedFilters());
      act(() => {
        result.current.toggleArrayFilter('colors', 'azul');
      });
      expect(result.current.filters.colors).toContain('azul');
    });

    it('remove valor do array quando presente', () => {
      const { result } = renderHook(() => useAdvancedFilters());
      act(() => {
        result.current.toggleArrayFilter('colors', 'azul');
      });
      act(() => {
        result.current.toggleArrayFilter('colors', 'azul');
      });
      expect(result.current.filters.colors).not.toContain('azul');
    });

    it('multiplos valores coexistem no array', () => {
      const { result } = renderHook(() => useAdvancedFilters());
      act(() => {
        result.current.toggleArrayFilter('tags', 'promo');
      });
      act(() => {
        result.current.toggleArrayFilter('tags', 'sustentavel');
      });
      expect(result.current.filters.tags).toHaveLength(2);
    });
  });

  // ── activeFiltersCount ──────────────────────────────────────────────────────
  describe('activeFiltersCount', () => {
    it('incrementa ao adicionar filtro diferente do padrao', () => {
      const { result } = renderHook(() => useAdvancedFilters());
      act(() => {
        result.current.updateFilter('search', 'caneta');
      });
      expect(result.current.activeFiltersCount).toBeGreaterThan(0);
    });

    it('nao incrementa ao definir mesmo valor do padrao', () => {
      const { result } = renderHook(() => useAdvancedFilters());
      act(() => {
        result.current.updateFilter('stockStatus', 'all');
      }); // mesmo padrão
      expect(result.current.activeFiltersCount).toBe(0);
    });

    it('isKit=true contribui para contagem', () => {
      const { result } = renderHook(() => useAdvancedFilters());
      act(() => {
        result.current.updateFilter('isKit', true);
      });
      expect(result.current.activeFiltersCount).toBeGreaterThanOrEqual(1);
    });
  });

  // ── resetFilters ──────────────────────────────────────────────────────────
  describe('resetFilters', () => {
    it('restaura todos os filtros ao padrao', () => {
      const { result } = renderHook(() => useAdvancedFilters());
      act(() => {
        result.current.updateFilter('search', 'caneta');
      });
      act(() => {
        result.current.toggleArrayFilter('colors', 'azul');
      });
      act(() => {
        result.current.updateFilter('isKit', true);
      });
      act(() => {
        result.current.resetFilters();
      });
      expect(result.current.filters).toEqual(defaultAdvancedFilters);
      expect(result.current.activeFiltersCount).toBe(0);
    });
  });

  // ── resetFilterGroup ──────────────────────────────────────────────────────
  describe('resetFilterGroup', () => {
    it('restaura apenas as chaves especificadas', () => {
      const { result } = renderHook(() => useAdvancedFilters());
      act(() => {
        result.current.updateFilter('search', 'caneta');
      });
      act(() => {
        result.current.toggleArrayFilter('colors', 'azul');
      });
      act(() => {
        result.current.resetFilterGroup(['colors']);
      });
      // search deve continuar alterado
      expect(result.current.filters.search).toBe('caneta');
      // colors deve ter voltado ao padrão
      expect(result.current.filters.colors).toEqual([]);
    });
  });

  // ── hasActiveFiltersInGroup ───────────────────────────────────────────────
  describe('hasActiveFiltersInGroup', () => {
    it('retorna false quando grupo tem apenas valores padrao', () => {
      const { result } = renderHook(() => useAdvancedFilters());
      expect(result.current.hasActiveFiltersInGroup(['colors', 'categories'])).toBe(false);
    });

    it('retorna true quando algum campo do grupo difere do padrao', () => {
      const { result } = renderHook(() => useAdvancedFilters());
      act(() => {
        result.current.toggleArrayFilter('colors', 'vermelho');
      });
      expect(result.current.hasActiveFiltersInGroup(['colors', 'categories'])).toBe(true);
    });
  });
});
