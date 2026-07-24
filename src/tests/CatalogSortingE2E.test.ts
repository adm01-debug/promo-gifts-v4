import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCatalogFiltering } from '../hooks/products/useCatalogFiltering';
import { defaultFilters } from '../components/filters/FilterPanel';

// Mock product data
const mockProducts = [
  { id: '1', name: 'Product B', price: 100, stock: 10 },
  { id: '2', name: 'Product A', price: 50, stock: 5 },
  { id: '3', name: 'Product C', price: 150, stock: 20 },
];

describe('Catalog Sorting Logic (E2E simulation)', () => {
  it('should correctly sort by price ascending', () => {
    const { result } = renderHook(() =>
      useCatalogFiltering({
        realProducts: mockProducts as unknown as Parameters<
          typeof useCatalogFiltering
        >[0]['realProducts'],
        filters: defaultFilters,
        sortBy: 'price-asc',
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

    expect(result.current[0].id).toBe('2'); // Price 50
    expect(result.current[1].id).toBe('1'); // Price 100
    expect(result.current[2].id).toBe('3'); // Price 150
  });

  it('should correctly sort by price descending', () => {
    const { result } = renderHook(() =>
      useCatalogFiltering({
        realProducts: mockProducts as unknown as Parameters<
          typeof useCatalogFiltering
        >[0]['realProducts'],
        filters: defaultFilters,
        sortBy: 'price-desc',
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

    expect(result.current[0].id).toBe('3'); // Price 150
    expect(result.current[1].id).toBe('1'); // Price 100
    expect(result.current[2].id).toBe('2'); // Price 50
  });

  it('should correctly sort by name (A-Z)', () => {
    const { result } = renderHook(() =>
      useCatalogFiltering({
        realProducts: mockProducts as unknown as Parameters<
          typeof useCatalogFiltering
        >[0]['realProducts'],
        filters: defaultFilters,
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

    expect(result.current[0].name).toBe('Product A');
    expect(result.current[1].name).toBe('Product B');
    expect(result.current[2].name).toBe('Product C');
  });
});
