import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCatalogFiltering } from '../useCatalogFiltering';
import { defaultFilters } from '@/components/filters/filter-panel/types';
import type { Product } from '@/types/product-catalog';
import type { SupplierSalesEntry } from '@/hooks/products/useSupplierSalesRanking';

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

// BUG-VENDAS-FILTER-CATALOG parity — minSupplierSales90d e minPromoSales90d eram
// aplicados no Super Filtro (/filtros via applyProductFilters) mas ignorados no
// catálogo principal. Guard: só filtra quando o mapa está disponível e não vazio
// (mapa ausente = dados ainda carregando → preserva grade).
describe('useCatalogFiltering — minSupplierSales90d parity', () => {
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

  const baseArgs = {
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

  const catalog = [makeP('low'), makeP('high'), makeP('zero')];

  const makeSupplierMap = (entries: Record<string, number>): Map<string, SupplierSalesEntry> => {
    const map = new Map<string, SupplierSalesEntry>();
    Object.entries(entries).forEach(([id, depleted90d]) => {
      map.set(id, {
        turnoverScore: 0,
        velocity7d: 0,
        velocity30d: 0,
        abcClass: 'C',
        depleted30d: 0,
        depleted90d,
      });
    });
    return map;
  };

  it('filtra pelo threshold quando supplierSalesMap está disponível', () => {
    const supplierSalesMap = makeSupplierMap({ low: 10, high: 100, zero: 0 });
    const { result } = renderHook(() =>
      useCatalogFiltering({
        ...baseArgs,
        realProducts: catalog,
        filters: { ...defaultFilters, minSupplierSales90d: 50 },
        supplierSalesMap,
      }),
    );
    const ids = result.current.map((p) => p.id);
    expect(ids).toContain('high');
    expect(ids).not.toContain('low');
    expect(ids).not.toContain('zero');
  });

  it('não filtra quando supplierSalesMap está vazio (dados ainda carregando)', () => {
    const { result } = renderHook(() =>
      useCatalogFiltering({
        ...baseArgs,
        realProducts: catalog,
        filters: { ...defaultFilters, minSupplierSales90d: 50 },
        supplierSalesMap: new Map(),
      }),
    );
    expect(result.current).toHaveLength(catalog.length);
  });

  it('não filtra quando supplierSalesMap é undefined (hook não carregou)', () => {
    const { result } = renderHook(() =>
      useCatalogFiltering({
        ...baseArgs,
        realProducts: catalog,
        filters: { ...defaultFilters, minSupplierSales90d: 50 },
        supplierSalesMap: undefined,
      }),
    );
    expect(result.current).toHaveLength(catalog.length);
  });

  it('minSupplierSales90d=0 retorna todos (sem filtro)', () => {
    const supplierSalesMap = makeSupplierMap({ low: 10, high: 100, zero: 0 });
    const { result } = renderHook(() =>
      useCatalogFiltering({
        ...baseArgs,
        realProducts: catalog,
        filters: { ...defaultFilters, minSupplierSales90d: 0 },
        supplierSalesMap,
      }),
    );
    expect(result.current).toHaveLength(catalog.length);
  });
});

describe('useCatalogFiltering — minPromoSales90d parity', () => {
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

  const baseArgs = {
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

  const catalog = [makeP('few'), makeP('many'), makeP('none')];

  it('filtra pelo threshold quando promoSales90dMap está disponível', () => {
    const promoSales90dMap = new Map<string, number>([
      ['few', 5],
      ['many', 80],
      ['none', 0],
    ]);
    const { result } = renderHook(() =>
      useCatalogFiltering({
        ...baseArgs,
        realProducts: catalog,
        filters: { ...defaultFilters, minPromoSales90d: 20 },
        promoSales90dMap,
      }),
    );
    const ids = result.current.map((p) => p.id);
    expect(ids).toContain('many');
    expect(ids).not.toContain('few');
    expect(ids).not.toContain('none');
  });

  it('não filtra quando promoSales90dMap está vazio (dados ainda carregando)', () => {
    const { result } = renderHook(() =>
      useCatalogFiltering({
        ...baseArgs,
        realProducts: catalog,
        filters: { ...defaultFilters, minPromoSales90d: 20 },
        promoSales90dMap: new Map(),
      }),
    );
    expect(result.current).toHaveLength(catalog.length);
  });

  it('não filtra quando promoSales90dMap é undefined (hook não carregou)', () => {
    const { result } = renderHook(() =>
      useCatalogFiltering({
        ...baseArgs,
        realProducts: catalog,
        filters: { ...defaultFilters, minPromoSales90d: 20 },
        promoSales90dMap: undefined,
      }),
    );
    expect(result.current).toHaveLength(catalog.length);
  });

  it('minPromoSales90d=0 retorna todos (sem filtro)', () => {
    const promoSales90dMap = new Map<string, number>([
      ['few', 5],
      ['many', 80],
    ]);
    const { result } = renderHook(() =>
      useCatalogFiltering({
        ...baseArgs,
        realProducts: catalog,
        filters: { ...defaultFilters, minPromoSales90d: 0 },
        promoSales90dMap,
      }),
    );
    expect(result.current).toHaveLength(catalog.length);
  });
});

// Server-side filter positive paths — verifica que quando os filtros server-side
// estão ATIVOS e os IDs estão disponíveis, apenas os produtos correspondentes passam.
// Complementa o bloco FIX-21/22 que testa apenas o caso de erro (IDs vazio + erro).
describe('useCatalogFiltering — server-side filter positive paths', () => {
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

  it('hasCategoryFilter=true + IDs disponíveis → só produtos nos IDs passam', () => {
    const { result } = renderHook(() =>
      useCatalogFiltering({
        ...baseArgs,
        realProducts: catalog,
        hasCategoryFilter: true,
        categoryFilteredProductIds: new Set(['p1']),
        isLoadingCategoryFilter: false,
      }),
    );
    expect(result.current.map((p) => p.id)).toEqual(['p1']);
  });

  it('hasColorFilter=true + IDs disponíveis → só produtos nos IDs passam', () => {
    const { result } = renderHook(() =>
      useCatalogFiltering({
        ...baseArgs,
        realProducts: catalog,
        hasColorFilter: true,
        colorFilteredProductIds: new Set(['p2']),
        isLoadingColorFilter: false,
      }),
    );
    expect(result.current.map((p) => p.id)).toEqual(['p2']);
  });

  it('hasMaterialFilter=true + IDs disponíveis → só produtos nos IDs passam', () => {
    const { result } = renderHook(() =>
      useCatalogFiltering({
        ...baseArgs,
        realProducts: catalog,
        hasMaterialFilter: true,
        materialFilteredProductIds: new Set(['p1', 'p3']),
        isLoadingMaterialFilter: false,
      }),
    );
    const ids = result.current.map((p) => p.id);
    expect(ids).toContain('p1');
    expect(ids).toContain('p3');
    expect(ids).not.toContain('p2');
  });

  it('hasSizeFilter=true + IDs disponíveis → só produtos nos IDs passam', () => {
    const { result } = renderHook(() =>
      useCatalogFiltering({
        ...baseArgs,
        realProducts: catalog,
        hasSizeFilter: true,
        sizeFilteredProductIds: new Set(['p3']),
        isLoadingSizeFilter: false,
      }),
    );
    expect(result.current.map((p) => p.id)).toEqual(['p3']);
  });

  it('hasMetadataFilter=true + IDs disponíveis → só produtos nos IDs passam', () => {
    const { result } = renderHook(() =>
      useCatalogFiltering({
        ...baseArgs,
        realProducts: catalog,
        hasMetadataFilter: true,
        metadataFilteredProductIds: new Set(['p2', 'p3']),
        isLoadingMetadataFilter: false,
      }),
    );
    const ids = result.current.map((p) => p.id);
    expect(ids).toContain('p2');
    expect(ids).toContain('p3');
    expect(ids).not.toContain('p1');
  });
});

// Loading state guards — quando um filtro server-side está carregando, NÃO deve
// filtrar produtos (evita apagar a grade enquanto a RPC ainda não respondeu).
describe('useCatalogFiltering — loading state guards', () => {
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

  const catalog = [makeP('x1'), makeP('x2'), makeP('x3')];

  const baseArgs = {
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

  it('não filtra categorias enquanto isLoadingCategoryFilter=true', () => {
    const { result } = renderHook(() =>
      useCatalogFiltering({
        ...baseArgs,
        realProducts: catalog,
        hasCategoryFilter: true,
        categoryFilteredProductIds: new Set(['x1']),
        isLoadingCategoryFilter: true,
      }),
    );
    expect(result.current).toHaveLength(catalog.length);
  });

  it('não filtra cores enquanto isLoadingColorFilter=true', () => {
    const { result } = renderHook(() =>
      useCatalogFiltering({
        ...baseArgs,
        realProducts: catalog,
        hasColorFilter: true,
        colorFilteredProductIds: new Set(['x2']),
        isLoadingColorFilter: true,
      }),
    );
    expect(result.current).toHaveLength(catalog.length);
  });

  it('não filtra materiais enquanto isLoadingMaterialFilter=true', () => {
    const { result } = renderHook(() =>
      useCatalogFiltering({
        ...baseArgs,
        realProducts: catalog,
        hasMaterialFilter: true,
        materialFilteredProductIds: new Set(['x1', 'x2']),
        isLoadingMaterialFilter: true,
      }),
    );
    expect(result.current).toHaveLength(catalog.length);
  });

  it('não filtra tamanhos enquanto isLoadingSizeFilter=true', () => {
    const { result } = renderHook(() =>
      useCatalogFiltering({
        ...baseArgs,
        realProducts: catalog,
        hasSizeFilter: true,
        sizeFilteredProductIds: new Set(['x3']),
        isLoadingSizeFilter: true,
      }),
    );
    expect(result.current).toHaveLength(catalog.length);
  });
});
