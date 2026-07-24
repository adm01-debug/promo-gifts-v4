import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCatalogFiltering } from '../hooks/products/useCatalogFiltering';
import { defaultFilters } from '../components/filters/FilterPanel';
import type { Product } from '../hooks/products/useProducts';

// Mock simple product data
const mockProducts: Product[] = [
  {
    id: '1',
    name: 'Caneta Esferográfica Blue',
    sku: 'CAN-001',
    price: 2.5,
    stock: 100,
    colors: [
      {
        name: 'Azul',
        hex: '#0000FF',
        groupSlug: 'azul',
        group: 'Azul',
        variationSlug: 'azul-caneta',
      },
    ],
    supplier: { id: 'supp-1', name: 'Fornecedor A' },
    brand: 'Fornecedor A',
    materials: ['Plástico'],
    category_id: 'cat-1',
    featured: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
  {
    id: '2',
    name: 'Mochila Notebook Premium',
    sku: 'MOC-002',
    price: 150.0,
    stock: 50,
    colors: [{ name: 'Preto', hex: '#000000', groupSlug: 'preto', group: 'Preto' }],
    supplier: { id: 'supp-2', name: 'Fornecedor B' },
    brand: 'Fornecedor B',
    materials: ['Poliéster', 'Nylon'],
    category_id: 'cat-2',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
  {
    id: '3',
    name: 'Garrafa Térmica Sport',
    sku: 'GAR-003',
    price: 45.9,
    stock: 0,
    colors: [{ name: 'Rosa', hex: '#FF00FF', groupSlug: 'rosa', group: 'Rosa' }],
    supplier: { id: 'supp-1', name: 'Fornecedor A' },
    brand: 'Fornecedor A',
    materials: ['Metal'],
    category_id: 'cat-3',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
];

describe('useCatalogFiltering Performance & Deep Logic Audit', () => {
  // Filtro de cor é server-side (useProductsByColor → product_variants.color_id).
  // Os produtos lightweight chegam com colors:[], então a grade filtra pela
  // interseção com colorFilteredProductIds, não inspecionando p.colors.
  it('should filter by the server-resolved color product-id set', () => {
    const filters = { ...defaultFilters, colorVariations: ['azul-caneta'] };
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
        hasColorFilter: true,
        colorFilteredProductIds: new Set(['1']),
        isLoadingColorFilter: false,
      }),
    );

    expect(result.current.length).toBe(1);
    expect(result.current[0].id).toBe('1');
  });

  it('returns empty while color filter active but server set is empty (no leak)', () => {
    const filters = { ...defaultFilters, colorVariations: ['inexistente'] };
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
        hasColorFilter: true,
        colorFilteredProductIds: new Set(),
        isLoadingColorFilter: false,
      }),
    );

    expect(result.current.length).toBe(0);
  });

  it('should handle complex material filtering (fallback to simple match)', () => {
    const filters = { ...defaultFilters, materiais: ['Metal'] };
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

    expect(result.current.length).toBe(1);
    expect(result.current[0].id).toBe('3');
  });

  it('should integrate fuzzy search results correctly when active', () => {
    const filters = defaultFilters;
    const { result } = renderHook(() =>
      useCatalogFiltering({
        realProducts: mockProducts,
        filters,
        sortBy: 'name',
        hasFuzzySearch: true,
        fuzzySearchResults: [mockProducts[1]], // Assume fuzzy found Mochila
        hasMaterialFilter: false,
        materialFilteredProductIds: new Set(),
        isLoadingMaterialFilter: false,
        hasCategoryFilter: false,
        categoryFilteredProductIds: new Set(),
        isLoadingCategoryFilter: false,
      }),
    );

    expect(result.current.length).toBe(1);
    expect(result.current[0].id).toBe('2');
  });

  it('should handle sorting by "best-seller-supplier" using ranking scores', () => {
    const supplierSalesMap = new Map();
    // High score for Garrafa
    supplierSalesMap.set('3', {
      turnoverScore: 100,
      velocity7d: 10,
      velocity30d: 50,
      abcClass: 'A',
      depleted30d: 0,
    });
    // Low score for Caneta
    supplierSalesMap.set('1', {
      turnoverScore: 10,
      velocity7d: 1,
      velocity30d: 5,
      abcClass: 'C',
      depleted30d: 0,
    });

    const { result } = renderHook(() =>
      useCatalogFiltering({
        realProducts: mockProducts,
        filters: defaultFilters,
        sortBy: 'best-seller-supplier',
        hasFuzzySearch: false,
        fuzzySearchResults: [],
        hasMaterialFilter: false,
        materialFilteredProductIds: new Set(),
        isLoadingMaterialFilter: false,
        hasCategoryFilter: false,
        categoryFilteredProductIds: new Set(),
        isLoadingCategoryFilter: false,
        supplierSalesMap,
      }),
    );

    // High score first
    expect(result.current[0].id).toBe('3');
    // Featured fallback if no map entry
    expect(result.current[result.current.length - 1].id).toBe('2'); // Low priority
  });

  it('should apply gender filters correctly', () => {
    const productsWithGender = [
      ...mockProducts,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { ...mockProducts[0], id: '4', name: 'Camiseta Masc', gender: 'masculino' } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { ...mockProducts[1], id: '5', name: 'Camiseta Fem', gender: 'feminino' } as any,
    ];
    const filters = { ...defaultFilters, gender: ['masculino'] };

    const { result } = renderHook(() =>
      useCatalogFiltering({
        realProducts: productsWithGender,
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

    // FIX-16 parity: produtos sem gênero (neutros) são incluídos em qualquer filtro de gênero.
    // A asserção anterior verificava strict === 'masculino' — errado. Neutros ('' / null) passam.
    expect(
      result.current.every((p) => {
        const g = (p.gender || '').toLowerCase();
        return g === 'masculino' || g === '';
      }),
    ).toBe(true);
    expect(result.current.some((p) => p.id === '4')).toBe(true);
    expect(result.current.some((p) => p.id === '5')).toBe(false);
  });
});
