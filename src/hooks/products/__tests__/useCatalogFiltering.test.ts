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

// FIX-16 parity — Gender filter: produtos sem gênero definido são neutros
// (applyProductFilters FIX-16). Anterior: gender=null excluía o produto.
describe('useCatalogFiltering — FIX-16 gender neutral parity', () => {
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
    makeP('masc', { gender: 'Masculino' }),
    makeP('fem', { gender: 'Feminino' }),
    makeP('uni', { gender: 'Unissex' }),
    makeP('null-gender'),
    makeP('empty-gender', { gender: '' }),
  ];

  it('filtra por gênero masculino incluindo produtos sem gênero (neutros)', () => {
    const result = run(catalog, { gender: ['Masculino'] }).map((p) => p.id);
    expect(result).toContain('masc');
    expect(result).toContain('null-gender');
    expect(result).toContain('empty-gender');
    expect(result).not.toContain('fem');
    expect(result).not.toContain('uni');
  });

  it('filtra por gênero feminino incluindo produtos sem gênero (neutros)', () => {
    const result = run(catalog, { gender: ['Feminino'] }).map((p) => p.id);
    expect(result).toContain('fem');
    expect(result).toContain('null-gender');
    expect(result).toContain('empty-gender');
    expect(result).not.toContain('masc');
    expect(result).not.toContain('uni');
  });

  it('sem filtro de gênero retorna todos', () => {
    expect(run(catalog, { gender: [] }).length).toBe(catalog.length);
  });
});

// FIX-17 parity — Supplier filter: case-insensitive + partial name match
// (applyProductFilters FIX-17). Anterior: case-sensitive, só brand (sem supplier.name).
describe('useCatalogFiltering — FIX-17 supplier parity', () => {
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
    makeP('by-id', { supplier: { id: 'SUP-001', name: 'Brinde Master' } }),
    makeP('by-name', {
      supplier: { id: 'sup-002', name: 'Gráfica Total' },
      brand: 'Gráfica Total',
    }),
    makeP('by-ref', { supplier: { id: 'sup-003', name: 'Outro' }, supplier_reference: 'REF-XYZ' }),
    makeP('no-match'),
  ];

  it('case-insensitive match por supplier.id', () => {
    const result = run(catalog, { suppliers: ['sup-001'] }).map((p) => p.id);
    expect(result).toContain('by-id');
    expect(result).not.toContain('no-match');
  });

  it('partial name match por supplier.name', () => {
    const result = run(catalog, { suppliers: ['gráfica total'] }).map((p) => p.id);
    expect(result).toContain('by-name');
    expect(result).not.toContain('no-match');
  });

  it('case-insensitive match por supplier_reference', () => {
    const result = run(catalog, { suppliers: ['ref-xyz'] }).map((p) => p.id);
    expect(result).toContain('by-ref');
    expect(result).not.toContain('no-match');
  });
});

// FIX-21/FIX-22 parity — Error guard: RPC failure must not zero the grid
// (useCatalogFiltering anterior retornava [] incondicionalmente quando productIds.size===0,
// mesmo quando a causa era timeout/erro de rede — zerando a grade sem razão válida).
// applyProductFilters.ts resolve isso via guards !colorFilterError / !materialFilterError.
describe('useCatalogFiltering — FIX-21/FIX-22 error guard parity', () => {
  const makeP = (id: string): Product =>
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
    }) as unknown as Product;

  const catalog = [makeP('p1'), makeP('p2'), makeP('p3')];

  const baseArgs = {
    realProducts: catalog,
    filters: { ...defaultFilters },
    sortBy: 'name' as const,
    hasFuzzySearch: false,
    fuzzySearchResults: [],
    hasMaterialFilter: false,
    materialFilteredProductIds: new Set<string>(),
    isLoadingMaterialFilter: false,
    hasCategoryFilter: false,
    categoryFilteredProductIds: new Set<string>(),
    isLoadingCategoryFilter: false,
  };

  it('preserva grade quando categoryFilterError ocorre (RPC falhou)', () => {
    const { result } = renderHook(() =>
      useCatalogFiltering({
        ...baseArgs,
        hasCategoryFilter: true,
        categoryFilteredProductIds: new Set(),
        isLoadingCategoryFilter: false,
        categoryFilterError: new Error('RPC timeout'),
      }),
    );
    expect(result.current).toHaveLength(catalog.length);
  });

  it('retorna [] quando category RPC retorna 0 resultados sem erro (filtro legítimo)', () => {
    const { result } = renderHook(() =>
      useCatalogFiltering({
        ...baseArgs,
        hasCategoryFilter: true,
        categoryFilteredProductIds: new Set(),
        isLoadingCategoryFilter: false,
      }),
    );
    expect(result.current).toHaveLength(0);
  });

  it('preserva grade quando colorFilterError ocorre', () => {
    const { result } = renderHook(() =>
      useCatalogFiltering({
        ...baseArgs,
        hasColorFilter: true,
        colorFilteredProductIds: new Set(),
        isLoadingColorFilter: false,
        colorFilterError: new Error('network error'),
      }),
    );
    expect(result.current).toHaveLength(catalog.length);
  });

  it('preserva grade quando materialFilterError ocorre', () => {
    const { result } = renderHook(() =>
      useCatalogFiltering({
        ...baseArgs,
        hasMaterialFilter: true,
        materialFilteredProductIds: new Set(),
        isLoadingMaterialFilter: false,
        materialFilterError: new Error('RPC failed'),
      }),
    );
    expect(result.current).toHaveLength(catalog.length);
  });

  it('preserva grade quando metadataFilterError ocorre', () => {
    const { result } = renderHook(() =>
      useCatalogFiltering({
        ...baseArgs,
        hasMetadataFilter: true,
        metadataFilteredProductIds: new Set(),
        isLoadingMetadataFilter: false,
        metadataFilterError: new Error('fn_super_filtro_product_ids falhou'),
      }),
    );
    expect(result.current).toHaveLength(catalog.length);
  });

  it('preserva grade quando sizeFilterError ocorre', () => {
    const { result } = renderHook(() =>
      useCatalogFiltering({
        ...baseArgs,
        hasSizeFilter: true,
        sizeFilteredProductIds: new Set(),
        isLoadingSizeFilter: false,
        sizeFilterError: new Error('product_variants query failed'),
      }),
    );
    expect(result.current).toHaveLength(catalog.length);
  });
});
