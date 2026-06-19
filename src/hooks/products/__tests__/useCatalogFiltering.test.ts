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

// FIX-PRICE / FIX-INSTOCK / FIX-MINSTOCK parity
// Garantem que os filtros de preço e estoque do catálogo se comportam
// identicamente a applyProductFilters.ts (sentinela 9999, variation-aware stock).
describe('useCatalogFiltering — price range parity', () => {
  const makeP = (id: string, price: number, over: Partial<Product> = {}): Product =>
    ({
      id,
      name: id,
      price,
      stock: 100,
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
    makeP('cheap', 10),
    makeP('mid', 100),
    makeP('expensive', 500),
    makeP('very-expensive', 1500),
  ];

  it('retorna todos quando range é [0, 9999] (default)', () => {
    expect(run(catalog, { priceRange: [0, 9999] }).length).toBe(catalog.length);
  });

  it('filtra pelo range [50, 200]', () => {
    const ids = run(catalog, { priceRange: [50, 200] }).map((p) => p.id);
    expect(ids).toContain('mid');
    expect(ids).not.toContain('cheap');
    expect(ids).not.toContain('expensive');
    expect(ids).not.toContain('very-expensive');
  });

  it('sentinela max=9999 — produtos acima de 9999 não são excluídos quando só min é definido', () => {
    // priceRange [200, 9999]: inclui expensive (500) e very-expensive (1500)
    const ids = run(catalog, { priceRange: [200, 9999] }).map((p) => p.id);
    expect(ids).toContain('expensive');
    expect(ids).toContain('very-expensive');
    expect(ids).not.toContain('cheap');
  });

  it('limite inferior exclui produtos abaixo do mínimo', () => {
    const ids = run(catalog, { priceRange: [100, 9999] }).map((p) => p.id);
    expect(ids).not.toContain('cheap');
    expect(ids).toContain('mid');
    expect(ids).toContain('expensive');
  });

  it('range estreito [100, 100] inclui só produto com preço exato', () => {
    const ids = run(catalog, { priceRange: [100, 100] }).map((p) => p.id);
    expect(ids).toEqual(['mid']);
  });
});

describe('useCatalogFiltering — inStock + minStock parity', () => {
  const makeP = (id: string, stock: number, over: Partial<Product> = {}): Product =>
    ({
      id,
      name: id,
      price: 10,
      stock,
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
    makeP('zero-stock', 0),
    makeP('low-stock', 5),
    makeP('good-stock', 50),
    // produto sem estoque agregado mas com variação com estoque
    makeP('variation-stock', 0, {
      variations: [
        { id: 'v1', stock: 10, size_code: 'M', is_active: true } as unknown,
      ] as Product['variations'],
    }),
    // produto com variações mas TODAS sem estoque
    makeP('variation-no-stock', 0, {
      variations: [
        { id: 'v2', stock: 0, size_code: 'G', is_active: true } as unknown,
      ] as Product['variations'],
    }),
  ];

  it('inStock=true exclui produtos com stock=0 e sem variações com estoque', () => {
    const ids = run(catalog, { inStock: true }).map((p) => p.id);
    expect(ids).toContain('low-stock');
    expect(ids).toContain('good-stock');
    expect(ids).not.toContain('zero-stock');
    expect(ids).not.toContain('variation-no-stock');
  });

  it('inStock=true inclui produto com variação em estoque (variation-aware)', () => {
    const ids = run(catalog, { inStock: true }).map((p) => p.id);
    expect(ids).toContain('variation-stock');
  });

  it('minStock=10 exclui produtos abaixo do threshold', () => {
    const ids = run(catalog, { minStock: 10 }).map((p) => p.id);
    expect(ids).not.toContain('zero-stock');
    expect(ids).not.toContain('low-stock'); // stock=5 < 10
    expect(ids).toContain('good-stock'); // stock=50 >= 10
  });

  it('minStock=10 variation-aware: inclui produto com variação >= threshold', () => {
    const ids = run(catalog, { minStock: 10 }).map((p) => p.id);
    expect(ids).toContain('variation-stock'); // variation stock=10 >= 10
  });

  it('minStock=10 exclui produto cujas variações ficam abaixo do threshold', () => {
    const ids = run(catalog, { minStock: 10 }).map((p) => p.id);
    expect(ids).not.toContain('variation-no-stock'); // variation stock=0 < 10
  });

  it('minStock=0 retorna todos (default — não filtra)', () => {
    expect(run(catalog, { minStock: 0 }).length).toBe(catalog.length);
  });
});

// FIX-TECHNIQUES-FILTER parity — graceful degradation quando catálogo leve não
// hidrata metadata.techniques (campo ausente → não zerar a grade).
describe('useCatalogFiltering — techniques graceful degradation parity', () => {
  const makeP = (id: string, techniques?: string[]): Product =>
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
      ...(techniques !== undefined ? { metadata: { techniques } } : {}),
    }) as unknown as Product;

  it('filtra por técnica quando dados estão disponíveis', () => {
    const catalog = [
      makeP('seri', ['Serigrafia', 'Bordado']),
      makeP('laser', ['Laser']),
      makeP('none', []),
    ];
    const ids = run(catalog, { techniques: ['Serigrafia'] }).map((p) => p.id);
    expect(ids).toContain('seri');
    expect(ids).toContain('none'); // sem dados → passa (graceful)
    expect(ids).not.toContain('laser');
  });

  it('graceful degradation — sem nenhum produto com técnica, retorna todos', () => {
    // Catálogo leve típico: metadata.techniques ausente em todos
    const catalog = [makeP('a'), makeP('b'), makeP('c')];
    // Filtro de técnica definido, mas nenhum produto tem o campo → não zera a grade
    expect(run(catalog, { techniques: ['Serigrafia'] }).length).toBe(catalog.length);
  });

  it('case-insensitive: técnica em lowercase bate com uppercase no produto', () => {
    const catalog = [makeP('seri', ['SERIGRAFIA']), makeP('other', ['Laser'])];
    const ids = run(catalog, { techniques: ['serigrafia'] }).map((p) => p.id);
    expect(ids).toContain('seri');
  });
});
