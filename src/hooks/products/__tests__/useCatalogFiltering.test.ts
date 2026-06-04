import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCatalogFiltering } from '../useCatalogFiltering';
import { defaultFilters } from '@/components/filters/filter-panel/types';
import type { Product } from '@/types/product-catalog';

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
      })
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
      })
    );

    expect(result.current).toHaveLength(2);
  });
});
