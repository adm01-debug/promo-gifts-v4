import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCatalogFiltering } from '../useCatalogFiltering';
import { defaultFilters } from '@/components/filters/filter-panel/types';
import type { Product } from '@/types/product-catalog';

function run(products: Product[], overrides: Partial<typeof defaultFilters>) {
  return renderHook(() =>
    useCatalogFiltering({
      realProducts: products,
      filters: { ...defaultFilters, ...overrides },
      sortBy: 'name',
      hasFuzzySearch: false,
      fuzzySearchResults: [],
      hasMaterialFilter: false,
      materialFilteredProductIds: new Set(),
      isLoadingMaterialFilter: false,
      hasCategoryFilter: false,
      categoryFilteredProductIds: new Set(),
      isLoadingCategoryFilter: false,
    }),
  ).result.current;
}

describe('useCatalogFiltering', () => {
  const mockProducts: Product[] = [
    {
      id: '1',
      name: 'Produto Com Embalagem',
      hasCommercialPackaging: true,
      price: 10,
      stock: 100,
      colors: [],
      materials: [],
      sku: 'SKU1',
      category: { id: 'cat1', name: 'Cat 1' },
      supplier: { id: 'sup1', name: 'Sup 1' },
      tags: { publicoAlvo: [], datasComemorativas: [], endomarketing: [], ramo: [], nicho: [] },
      stockStatus: 'in-stock',
      featured: false,
      newArrival: false,
      onSale: false,
      isKit: false,
    } as unknown as Product,
    {
      id: '2',
      name: 'Produto Sem Embalagem',
      hasCommercialPackaging: false,
      price: 20,
      stock: 50,
      colors: [],
      materials: [],
      sku: 'SKU2',
      category: { id: 'cat1', name: 'Cat 1' },
      supplier: { id: 'sup1', name: 'Sup 1' },
      tags: { publicoAlvo: [], datasComemorativas: [], endomarketing: [], ramo: [], nicho: [] },
      stockStatus: 'in-stock',
      featured: false,
      newArrival: false,
      onSale: false,
      isKit: false,
    } as unknown as Product,
  ];

  it('should filter by hasCommercialPackaging when filter is active', () => {
    const filters = {
      ...defaultFilters,
      hasCommercialPackaging: true,
    };

    const { result } = renderHook(() =>
      useCatalogFiltering({
        realProducts: mockProducts,
        filters,
        sortBy: 'name',
        hasFuzzySearch: false,
        fuzzySearchResults: [],
        hasMaterialFilter: false,
        materialFilteredProductIds: new Set(),
        isLoadingMaterialFilter: false,
        hasCategoryFilter: false,
        categoryFilteredProductIds: new Set(),
        isLoadingCategoryFilter: false,
      }),
    );

    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe('1');
  });

  it('should return all products when hasCommercialPackaging filter is inactive', () => {
    const filters = {
      ...defaultFilters,
      hasCommercialPackaging: false,
    };

    const { result } = renderHook(() =>
      useCatalogFiltering({
        realProducts: mockProducts,
        filters,
        sortBy: 'name',
        hasFuzzySearch: false,
        fuzzySearchResults: [],
        hasMaterialFilter: false,
        materialFilteredProductIds: new Set(),
        isLoadingMaterialFilter: false,
        hasCategoryFilter: false,
        categoryFilteredProductIds: new Set(),
        isLoadingCategoryFilter: false,
      }),
    );

    expect(result.current).toHaveLength(2);
  });

  it('should filter kits using category fallback when isKit flag is missing', () => {
    const kitProducts = [
      ...mockProducts,
      {
        ...mockProducts[0],
        id: '3',
        name: 'Kit churrasco — ref. KC0124PP',
        sku: 'KC0124PP',
        isKit: false,
        category: { id: 'cat-kit', name: 'Kit Churrasco' },
        category_name: 'Kit Churrasco',
      } as Product,
    ];
    const filters = {
      ...defaultFilters,
      isKit: true,
    };

    const { result } = renderHook(() =>
      useCatalogFiltering({
        realProducts: kitProducts,
        filters,
        sortBy: 'name',
        hasFuzzySearch: false,
        fuzzySearchResults: [],
        hasMaterialFilter: false,
        materialFilteredProductIds: new Set(),
        isLoadingMaterialFilter: false,
        hasCategoryFilter: false,
        categoryFilteredProductIds: new Set(),
        isLoadingCategoryFilter: false,
      }),
    );

    expect(result.current.map((product) => product.id)).toEqual(['3']);
  });
});

// SF-A parity — Quick Options no catálogo Index (/produtos)
// Estes flags eram silenciosamente ignorados em useCatalogFiltering apesar de
// estarem corretamente mapeados pelo mapLightweightToProduct (fix SF-A).
// Sem este teste, o Lovable pode reverter a correção sem CI detectar.
describe('useCatalogFiltering — Quick Options parity (SF-A fix)', () => {
  const makeP = (id: string, over: Partial<Product> = {}): Product =>
    ({
      id,
      name: id,
      price: 10,
      stock: 5,
      colors: [],
      materials: [],
      sku: id,
      tags: { publicoAlvo: [], datasComemorativas: [], endomarketing: [], ramo: [], nicho: [] },
      featured: false,
      newArrival: false,
      onSale: false,
      hasPersonalization: false,
      hasCommercialPackaging: false,
      isKit: false,
      ...over,
    }) as unknown as Product;

  const catalog = [
    makeP('a', { featured: true }),
    makeP('b', { onSale: true }),
    makeP('c', { hasPersonalization: true }),
    makeP('d', { newArrival: true }),
    makeP('e'),
  ];

  it('featured filtra corretamente no catálogo Index', () => {
    expect(run(catalog, { featured: true }).map((p) => p.id)).toEqual(['a']);
  });

  it('onSale filtra corretamente no catálogo Index', () => {
    expect(run(catalog, { onSale: true }).map((p) => p.id)).toEqual(['b']);
  });

  it('hasPersonalization filtra corretamente no catálogo Index', () => {
    expect(run(catalog, { hasPersonalization: true }).map((p) => p.id)).toEqual(['c']);
  });

  it('isNew (newArrival) filtra corretamente no catálogo Index', () => {
    expect(run(catalog, { isNew: true }).map((p) => p.id)).toEqual(['d']);
  });

  it('sem filtro retorna catálogo completo', () => {
    expect(run(catalog, {}).length).toBe(catalog.length);
  });

  it('featured + onSale combinados (AND) só retorna interseção', () => {
    const both = [makeP('x', { featured: true, onSale: true }), makeP('y', { featured: true })];
    expect(run(both, { featured: true, onSale: true }).map((p) => p.id)).toEqual(['x']);
  });
});
