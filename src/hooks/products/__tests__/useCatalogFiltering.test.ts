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

  it('inStock exclui produto com stock > 0 mas abaixo de minQuantity (BUG-CF-INSTOCK-01)', () => {
    // Produto com estoque físico positivo (3 un.) mas min_quantity=5 → stockStatus='out-of-stock'
    // O filtro "Em estoque" NÃO deve incluí-lo pois não é possível efetuar pedido.
    const lowMoqProduct = makeP('low-moq', 3, {
      stockStatus: 'out-of-stock', // stock=3 < minQuantity=5 → calculado por getCatalogStockStatus
    });
    const result = run([lowMoqProduct], { inStock: true });
    expect(result).toHaveLength(0); // excluído porque stockStatus='out-of-stock'
  });

  it('inStock inclui produto com stock > 0 e stockStatus="in-stock" (regra normal)', () => {
    const inStockProduct = makeP('normal', 10, { stockStatus: 'in-stock' });
    const result = run([inStockProduct], { inStock: true });
    expect(result).toHaveLength(1);
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

// FUZZY-SEARCH parity — quando hasFuzzySearch=true, o conjunto inicial é
// fuzzySearchResults (resultados do Fuse.js/servidor), não realProducts.
// Filtros adicionais são aplicados SOBRE o conjunto fuzzy (AND semântico).
// skipSort=true quando hasFuzzySearch && sortBy==='name' preserva o ranqueamento fuzzy.
describe('useCatalogFiltering — fuzzy search path', () => {
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

  const base = {
    filters: { ...defaultFilters },
    sortBy: 'name' as const,
    hasMaterialFilter: false,
    materialFilteredProductIds: new Set<string>(),
    isLoadingMaterialFilter: false,
    hasCategoryFilter: false,
    categoryFilteredProductIds: new Set<string>(),
    isLoadingCategoryFilter: false,
  };

  it('usa fuzzySearchResults como conjunto inicial quando hasFuzzySearch=true', () => {
    const catalog = [makeP('a'), makeP('b'), makeP('c')];
    const { result } = renderHook(() =>
      useCatalogFiltering({
        ...base,
        realProducts: catalog,
        hasFuzzySearch: true,
        fuzzySearchResults: [catalog[1], catalog[0]], // b, a — 'c' não está
      }),
    );
    const ids = result.current.map((p) => p.id);
    expect(ids).toContain('a');
    expect(ids).toContain('b');
    expect(ids).not.toContain('c');
  });

  it('hasFuzzySearch=false ignora fuzzySearchResults e usa realProducts', () => {
    const catalog = [makeP('a'), makeP('b'), makeP('c')];
    const { result } = renderHook(() =>
      useCatalogFiltering({
        ...base,
        realProducts: catalog,
        hasFuzzySearch: false,
        fuzzySearchResults: [catalog[0]], // só 'a' — deve ser ignorado
      }),
    );
    expect(result.current).toHaveLength(catalog.length);
  });

  it('hasFuzzySearch=true + fuzzySearchResults=[] retorna []', () => {
    const catalog = [makeP('a'), makeP('b')];
    const { result } = renderHook(() =>
      useCatalogFiltering({
        ...base,
        realProducts: catalog,
        hasFuzzySearch: true,
        fuzzySearchResults: [],
      }),
    );
    expect(result.current).toHaveLength(0);
  });

  it('hasFuzzySearch=true + filtro adicional (AND): só interseção passa', () => {
    // 'a' featured + 'b' não; fuzzy retorna 'a' e 'b'; 'c' featured mas fora do fuzzy
    const catalog = [makeP('a', { featured: true }), makeP('b'), makeP('c', { featured: true })];
    const { result } = renderHook(() =>
      useCatalogFiltering({
        ...base,
        realProducts: catalog,
        filters: { ...defaultFilters, featured: true },
        hasFuzzySearch: true,
        fuzzySearchResults: [catalog[0], catalog[1]], // a, b
      }),
    );
    expect(result.current.map((p) => p.id)).toEqual(['a']);
  });

  it('preserva ranqueamento fuzzy quando hasFuzzySearch=true e sortBy=name (skipSort)', () => {
    const catalog = [makeP('alpha'), makeP('beta'), makeP('gamma')];
    const fuzzyRanked = [catalog[2], catalog[0], catalog[1]]; // gamma, alpha, beta
    const { result } = renderHook(() =>
      useCatalogFiltering({
        ...base,
        realProducts: catalog,
        hasFuzzySearch: true,
        fuzzySearchResults: fuzzyRanked,
      }),
    );
    expect(result.current.map((p) => p.id)).toEqual(['gamma', 'alpha', 'beta']);
  });
});

// CLIENT-SIDE materiais fallback — quando hasMaterialFilter=false mas filters.materiais
// está preenchido, filtra no client via substring case-insensitive sobre p.materials.
// Cobre tanto arrays (join) quanto strings (direto). Paridade com applyProductFilters.ts.
describe('useCatalogFiltering — client-side materiais fallback', () => {
  const makeP = (id: string, materials: string[] | string, over: Partial<Product> = {}): Product =>
    ({
      id,
      name: id,
      price: 10,
      stock: 5,
      colors: [],
      materials,
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

  it('filtra por material (array) via substring case-insensitive', () => {
    const catalog = [
      makeP('couro', ['Couro Natural']),
      makeP('borr', ['Borracha']),
      makeP('none', []),
    ];
    const ids = run(catalog, { materiais: ['couro'] }).map((p) => p.id);
    expect(ids).toContain('couro');
    expect(ids).not.toContain('borr');
    expect(ids).not.toContain('none');
  });

  it('filtra por material (string) via join + includes', () => {
    const catalog = [makeP('couro', 'Couro Natural Macio'), makeP('metal', 'Aço Inox')];
    const ids = run(catalog, { materiais: ['couro'] }).map((p) => p.id);
    expect(ids).toContain('couro');
    expect(ids).not.toContain('metal');
  });

  it('case-insensitive: COURO bate com filtro couro', () => {
    const catalog = [makeP('a', ['COURO']), makeP('b', ['plástico'])];
    expect(run(catalog, { materiais: ['Couro'] }).map((p) => p.id)).toContain('a');
  });

  it('produto com array de materiais vazio não passa quando há filtro', () => {
    const catalog = [makeP('tem', ['Couro']), makeP('vazio', [])];
    const ids = run(catalog, { materiais: ['Couro'] }).map((p) => p.id);
    expect(ids).toContain('tem');
    expect(ids).not.toContain('vazio');
  });

  it('hasMaterialFilter=true sobrescreve o fallback client-side', () => {
    // Quando server-side está ativo, filters.materiais deve ser ignorado
    const catalog = [makeP('couro', ['Couro']), makeP('borr', ['Borracha'])];
    const { result } = renderHook(() =>
      useCatalogFiltering({
        realProducts: catalog,
        filters: { ...defaultFilters, materiais: ['Couro'] }, // seria client-side
        sortBy: 'name',
        hasFuzzySearch: false,
        fuzzySearchResults: [],
        hasMaterialFilter: true,
        materialFilteredProductIds: new Set(['borr']), // server-side só retorna 'borr'
        isLoadingMaterialFilter: false,
        hasCategoryFilter: false,
        categoryFilteredProductIds: new Set(),
        isLoadingCategoryFilter: false,
      }),
    );
    expect(result.current.map((p) => p.id)).toEqual(['borr']);
  });

  it('SF-MATERIAIS-INERT-ALL: não zera a grade quando nenhum produto tem materiais (catálogo leve)', () => {
    // BUG-CF-01: todos os produtos com materials=[] — catálogo lightweight antes de Silver/Gold hydration.
    // materialsDataAvailable=false → filtro de texto deve ser pulado → grid intacta.
    const catalog = [makeP('a', []), makeP('b', []), makeP('c', [])];
    const ids = run(catalog, { materiais: ['plastico'] }).map((p) => p.id);
    expect(ids).toHaveLength(catalog.length);
  });

  it('SF-MATERIAIS-INERT-PARTIAL: filtra quando pelo menos um produto tem materiais', () => {
    // Com dados de materiais disponíveis, o filtro de texto DEVE rodar normalmente.
    // Evitamos acentos no produto para que o toLowerCase() funcione sem normalização.
    const catalog = [
      makeP('com-mat', ['Plastico ABS']),
      makeP('sem-mat', []),
      makeP('outro', ['Metal']),
    ];
    const ids = run(catalog, { materiais: ['plastico'] }).map((p) => p.id);
    expect(ids).toContain('com-mat');
    expect(ids).not.toContain('outro');
    // produto sem materiais não passa quando dados existem no catálogo
    expect(ids).not.toContain('sem-mat');
  });
});

// CLIENT-SIDE category fallback — quando hasCategoryFilter=false mas filters.categories
// está preenchido, filtra no client via category_id. Paridade com applyProductFilters.ts.
describe('useCatalogFiltering — client-side category fallback', () => {
  const makeP = (id: string, categoryId: string): Product =>
    ({
      id,
      name: id,
      price: 10,
      stock: 5,
      colors: [],
      materials: [],
      sku: id,
      category_id: categoryId,
      tags: { publicoAlvo: [], datasComemorativas: [], endomarketing: [], ramo: [], nicho: [] },
      featured: false,
      newArrival: false,
      onSale: false,
      hasPersonalization: false,
      hasCommercialPackaging: false,
      isKit: false,
    }) as unknown as Product;

  it('filtra por category_id quando hasCategoryFilter=false', () => {
    const catalog = [makeP('c1', 'cat-a'), makeP('c2', 'cat-b'), makeP('c3', 'cat-a')];
    const { result } = renderHook(() =>
      useCatalogFiltering({
        realProducts: catalog,
        filters: { ...defaultFilters, categories: ['cat-a'] },
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
    const ids = result.current.map((p) => p.id);
    expect(ids).toContain('c1');
    expect(ids).toContain('c3');
    expect(ids).not.toContain('c2');
  });

  it('sem filtro de categoria retorna todos', () => {
    const catalog = [makeP('c1', 'cat-a'), makeP('c2', 'cat-b')];
    const { result } = renderHook(() =>
      useCatalogFiltering({
        realProducts: catalog,
        filters: { ...defaultFilters, categories: [] },
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
    expect(result.current).toHaveLength(catalog.length);
  });

  it('hasCategoryFilter=true sobrescreve o fallback client-side', () => {
    const catalog = [makeP('c1', 'cat-a'), makeP('c2', 'cat-b')];
    const { result } = renderHook(() =>
      useCatalogFiltering({
        realProducts: catalog,
        filters: { ...defaultFilters, categories: ['cat-a'] }, // client-side só quereria c1
        sortBy: 'name',
        hasFuzzySearch: false,
        fuzzySearchResults: [],
        hasMaterialFilter: false,
        materialFilteredProductIds: new Set(),
        isLoadingMaterialFilter: false,
        hasCategoryFilter: true,
        categoryFilteredProductIds: new Set(['c2']), // server-side vence
        isLoadingCategoryFilter: false,
      }),
    );
    expect(result.current.map((p) => p.id)).toEqual(['c2']);
  });
});

// COMBINED multi-filter AND logic — múltiplos filtros ativos ao mesmo tempo.
// Semantica AND: produto deve satisfazer TODOS os filtros para passar.
// Cobre combinações server-side × client-side e múltiplos filtros client-side.
describe('useCatalogFiltering — combined multi-filter AND logic', () => {
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

  it('server-side color × client-side featured = AND (só interseção)', () => {
    const catalog = [
      makeP('both', { featured: true }),
      makeP('color-only'),
      makeP('featured-only', { featured: true }),
    ];
    const { result } = renderHook(() =>
      useCatalogFiltering({
        realProducts: catalog,
        filters: { ...defaultFilters, featured: true },
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
        colorFilteredProductIds: new Set(['both', 'color-only']),
        isLoadingColorFilter: false,
      }),
    );
    expect(result.current.map((p) => p.id)).toEqual(['both']);
  });

  it('priceRange + supplier + inStock = AND (tripla restrição)', () => {
    const catalog = [
      makeP('match', { price: 100, stock: 10, supplier: { id: 'sup1', name: 'Sup One' } }),
      makeP('expensive', { price: 500, stock: 10, supplier: { id: 'sup1', name: 'Sup One' } }),
      makeP('wrong-sup', { price: 100, stock: 10, supplier: { id: 'sup2', name: 'Other' } }),
      makeP('no-stock', { price: 100, stock: 0, supplier: { id: 'sup1', name: 'Sup One' } }),
    ];
    const result = run(catalog, { priceRange: [0, 200], suppliers: ['sup1'], inStock: true });
    expect(result.map((p) => p.id)).toEqual(['match']);
  });

  it('hasPersonalization + onSale = AND', () => {
    const catalog = [
      makeP('match', { hasPersonalization: true, onSale: true }),
      makeP('only-perso', { hasPersonalization: true }),
      makeP('only-sale', { onSale: true }),
      makeP('none'),
    ];
    expect(run(catalog, { hasPersonalization: true, onSale: true }).map((p) => p.id)).toEqual([
      'match',
    ]);
  });

  it('server-side metadata × server-side size = AND (dois filtros server-side)', () => {
    const catalog = [makeP('p1'), makeP('p2'), makeP('p3'), makeP('p4')];
    const { result } = renderHook(() =>
      useCatalogFiltering({
        realProducts: catalog,
        filters: { ...defaultFilters },
        sortBy: 'name',
        hasFuzzySearch: false,
        fuzzySearchResults: [],
        hasMaterialFilter: false,
        materialFilteredProductIds: new Set(),
        isLoadingMaterialFilter: false,
        hasCategoryFilter: false,
        categoryFilteredProductIds: new Set(),
        isLoadingCategoryFilter: false,
        hasMetadataFilter: true,
        metadataFilteredProductIds: new Set(['p1', 'p2', 'p3']),
        isLoadingMetadataFilter: false,
        hasSizeFilter: true,
        sizeFilteredProductIds: new Set(['p2', 'p3', 'p4']),
        isLoadingSizeFilter: false,
      }),
    );
    const ids = result.current.map((p) => p.id);
    expect(ids).toContain('p2');
    expect(ids).toContain('p3');
    expect(ids).not.toContain('p1'); // só em metadata
    expect(ids).not.toContain('p4'); // só em size
  });

  it('fuzzy + server-side color + client-side featured = AND triplo', () => {
    const catalog = [
      makeP('all-three', { featured: true }),
      makeP('no-featured', { featured: false }),
      makeP('not-in-fuzzy', { featured: true }),
    ];
    const { result } = renderHook(() =>
      useCatalogFiltering({
        realProducts: catalog,
        filters: { ...defaultFilters, featured: true },
        sortBy: 'name',
        hasFuzzySearch: true,
        fuzzySearchResults: [catalog[0], catalog[1]],
        hasMaterialFilter: false,
        materialFilteredProductIds: new Set(),
        isLoadingMaterialFilter: false,
        hasCategoryFilter: false,
        categoryFilteredProductIds: new Set(),
        isLoadingCategoryFilter: false,
        hasColorFilter: true,
        colorFilteredProductIds: new Set(['all-three', 'not-in-fuzzy']),
        isLoadingColorFilter: false,
      }),
    );
    expect(result.current.map((p) => p.id)).toEqual(['all-three']);
  });
});

// EMPTY CATALOG early exit — realProducts=[] deve retornar [] imediatamente
// sem percorrer o pipeline de filtros (invariante de performance e correctness).
describe('useCatalogFiltering — empty catalog early exit', () => {
  it('retorna [] quando realProducts está vazio, mesmo com filtros ativos', () => {
    const { result } = renderHook(() =>
      useCatalogFiltering({
        realProducts: [],
        filters: { ...defaultFilters, featured: true, inStock: true, priceRange: [100, 500] },
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
        colorFilteredProductIds: new Set(['hypothetical-id']),
        isLoadingColorFilter: false,
      }),
    );
    expect(result.current).toHaveLength(0);
  });

  it('retorna [] com hasFuzzySearch=false e catalog vazio, sem erros', () => {
    const { result } = renderHook(() =>
      useCatalogFiltering({
        realProducts: [],
        filters: { ...defaultFilters },
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
    expect(result.current).toEqual([]);
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

  it('não filtra metadata enquanto isLoadingMetadataFilter=true', () => {
    const { result } = renderHook(() =>
      useCatalogFiltering({
        ...baseArgs,
        realProducts: catalog,
        hasMetadataFilter: true,
        metadataFilteredProductIds: new Set(['x1', 'x2']),
        isLoadingMetadataFilter: true,
      }),
    );
    expect(result.current).toHaveLength(catalog.length);
  });
});
