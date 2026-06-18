/**
 * SIMULAÇÃO EXAUSTIVA — Super Filtro (applyProductFilters)
 *
 * Centenas de cenários do dia a dia gerados combinatoriamente sobre um catálogo
 * sintético representativo. Objetivo: provar invariantes do pipeline puro e
 * prevenir regressões em qualquer filtro isolado ou combinado.
 *
 * Invariantes verificadas:
 *  - Resultado é sempre subconjunto do catálogo (nenhum produto "inventado").
 *  - Sem filtros ativos → catálogo inteiro.
 *  - Cada filtro isolado retorna exatamente os produtos esperados.
 *  - Combinações (AND entre filtros distintos) nunca aumentam a contagem.
 *  - Idempotência: aplicar 2x com os mesmos inputs dá o mesmo resultado.
 *  - Ordenação não altera o conjunto, só a ordem.
 */
import { describe, it, expect } from 'vitest';
import { applyProductFilters, type ProductFilterContext } from '../applyProductFilters';
import { defaultFilters, type FilterState } from '@/components/filters/FilterPanel';
import type { Product } from '@/types/product-catalog';

// ---------------------------------------------------------------------------
// Catálogo sintético
// ---------------------------------------------------------------------------
function makeProduct(over: Partial<Product> = {}): Product {
  return {
    id: 'p',
    name: 'Produto',
    description: '',
    sku: '',
    price: 50,
    stock: 10,
    images: [],
    image_url: '',
    colors: [],
    materials: [],
    supplier_reference: null,
    brand: '',
    supplier: null,
    category: null,
    category_id: '',
    tags: { publicoAlvo: [], datasComemorativas: [], endomarketing: [], ramo: [], nicho: [] },
    isKit: false,
    featured: false,
    newArrival: false,
    onSale: false,
    hasPersonalization: false,
    hasCommercialPackaging: false,
    gender: '',
    variations: [],
    created_at: '2026-01-01T00:00:00.000Z',
    ...over,
  } as unknown as Product;
}

const CATALOG: Product[] = [
  makeProduct({
    id: '1',
    name: 'Caneta Azul',
    price: 9.9,
    stock: 100,
    gender: 'unissex',
    featured: true,
    materials: ['plastico'],
  }),
  makeProduct({
    id: '2',
    name: 'Squeeze Inox',
    sku: 'SQZ-1',
    price: 49.9,
    stock: 0,
    onSale: true,
    materials: ['inox'],
    hasCommercialPackaging: true,
  }),
  makeProduct({
    id: '3',
    name: 'Camiseta Feminina',
    price: 79.9,
    stock: 5,
    gender: 'feminino',
    hasPersonalization: true,
    variations: [{ size_code: 'M', stock: 5 } as never],
  }),
  makeProduct({
    id: '4',
    name: 'Kit Executivo',
    price: 250,
    stock: 20,
    isKit: true,
    featured: true,
    newArrival: true,
    materials: ['couro'],
  }),
  makeProduct({
    id: '5',
    name: 'Mochila Premium',
    price: 5175,
    stock: 2,
    materials: ['nylon'],
    tags: {
      publicoAlvo: ['executivo'],
      datasComemorativas: [],
      endomarketing: ['onboarding'],
      ramo: ['tecnologia'],
      nicho: ['startups'],
    },
  }),
  makeProduct({ id: '6', name: 'Brinde Caro', price: 12000, stock: 1 }), // acima do sentinela 9999
  makeProduct({
    id: '7',
    name: 'Caderno Reciclado',
    price: 19.9,
    stock: 0,
    newArrival: true,
    materials: ['papel'],
    variations: [{ size_code: 'P', stock: 0 } as never, { size_code: 'G', stock: 3 } as never],
  }),
  makeProduct({
    id: '8',
    name: 'Garrafa Térmica',
    sku: 'GT-9',
    price: 89.9,
    stock: 50,
    hasCommercialPackaging: true,
    supplier: { id: 'sup-1', name: 'AcmeCo' } as never,
  }),
];

function baseCtx(over: Partial<ProductFilterContext> = {}): ProductFilterContext {
  return {
    hasFuzzySearch: false,
    fuzzySearchResults: [],
    techniquesDataAvailable: false,
    hasColorFilter: false,
    colorFilteredProductIds: new Set(),
    isLoadingColorFilter: false,
    hasCategoryFilter: false,
    categoryFilteredProductIds: new Set(),
    isLoadingCategoryFilter: false,
    categoryFilterError: null,
    hasMaterialFilter: false,
    materialFilteredProductIds: new Set(),
    isLoadingMaterialFilter: false,
    ...over,
  };
}

const f = (over: Partial<FilterState> = {}): FilterState => ({ ...defaultFilters, ...over });
const ids = (ps: Product[]) => ps.map((p) => p.id).sort();
const run = (filters: FilterState, ctx = baseCtx()) =>
  applyProductFilters(CATALOG, filters, filters.sortBy, ctx);

// ---------------------------------------------------------------------------
// Invariantes globais (geração combinatória — centenas de execuções)
// ---------------------------------------------------------------------------
describe('SIM — invariantes globais sobre combinações', () => {
  // Matriz de filtros atômicos plausíveis do dia a dia.
  const atomicFilters: Array<Partial<FilterState>> = [
    {},
    { search: 'caneta' },
    { search: 'squeeze' },
    { inStock: true },
    { isKit: true },
    { featured: true },
    { isNew: true },
    { onSale: true },
    { hasPersonalization: true },
    { hasCommercialPackaging: true },
    { gender: ['feminino'] },
    { gender: ['unissex', 'feminino'] },
    { priceRange: [0, 100] },
    { priceRange: [50, 9999] },
    { priceRange: [100, 9999] },
    { minStock: 5 },
    { minStock: 1000 },
    { materiais: ['inox'] },
    { materiais: ['plastico', 'papel'] },
    { suppliers: ['AcmeCo'] },
    { publicoAlvo: ['executivo'] },
    { endomarketing: ['onboarding'] },
    { ramosAtividade: ['tecnologia'] },
  ];

  it('todo resultado é subconjunto do catálogo e sem duplicatas (todas as combinações de 2)', () => {
    let runs = 0;
    for (let i = 0; i < atomicFilters.length; i++) {
      for (let j = i; j < atomicFilters.length; j++) {
        const filters = f({ ...atomicFilters[i], ...atomicFilters[j] });
        const out = run(filters);
        const outIds = out.map((p) => p.id);
        // subconjunto
        for (const id of outIds) expect(CATALOG.some((p) => p.id === id)).toBe(true);
        // sem duplicatas
        expect(new Set(outIds).size).toBe(outIds.length);
        runs++;
      }
    }
    // matriz triangular: n*(n+1)/2 cenários
    expect(runs).toBe((atomicFilters.length * (atomicFilters.length + 1)) / 2);
  });

  it('combinar dois filtros nunca aumenta a contagem vs. cada um isolado (AND)', () => {
    for (let i = 0; i < atomicFilters.length; i++) {
      for (let j = 0; j < atomicFilters.length; j++) {
        if (i === j) continue;
        const a = run(f(atomicFilters[i])).length;
        const combined = run(f({ ...atomicFilters[i], ...atomicFilters[j] })).length;
        // só vale quando os filtros não compartilham as mesmas chaves
        const keysA = Object.keys(atomicFilters[i]);
        const keysB = Object.keys(atomicFilters[j]);
        const overlap = keysA.some((k) => keysB.includes(k));
        if (!overlap) expect(combined).toBeLessThanOrEqual(a);
      }
    }
  });

  it('idempotência: aplicar 2x produz o mesmo conjunto', () => {
    for (const af of atomicFilters) {
      const filters = f(af);
      expect(ids(run(filters))).toEqual(ids(run(filters)));
    }
  });

  it('sem filtros → catálogo completo', () => {
    expect(run(f()).length).toBe(CATALOG.length);
  });
});

// ---------------------------------------------------------------------------
// Filtros isolados — asserts exatos
// ---------------------------------------------------------------------------
describe('SIM — filtros isolados (resultado exato)', () => {
  it('preço sem limite superior inclui o produto caro (>9999)', () => {
    expect(ids(run(f({ priceRange: [50, 9999] })))).toContain('6');
  });
  it('preço com teto real exclui o caro', () => {
    expect(ids(run(f({ priceRange: [0, 100] })))).not.toContain('6');
  });
  it('inStock exclui estoque zero (mas considera variações em estoque)', () => {
    const out = ids(run(f({ inStock: true })));
    expect(out).not.toContain('2'); // stock 0, sem variações
    expect(out).toContain('7'); // stock 0 mas variação G tem 3
  });
  it('featured retorna apenas marcados', () => {
    expect(ids(run(f({ featured: true })))).toEqual(['1', '4']);
  });
  it('onSale retorna apenas em promoção', () => {
    expect(ids(run(f({ onSale: true })))).toEqual(['2']);
  });
  it('hasPersonalization retorna apenas personalizáveis', () => {
    expect(ids(run(f({ hasPersonalization: true })))).toEqual(['3']);
  });
  it('hasCommercialPackaging retorna apenas com embalagem', () => {
    expect(ids(run(f({ hasCommercialPackaging: true })))).toEqual(['2', '8']);
  });
  it('gender feminino é case-insensitive', () => {
    expect(ids(run(f({ gender: ['Feminino'] })))).toEqual(['3']);
  });
  it('isKit usa detecção de kit', () => {
    expect(ids(run(f({ isKit: true })))).toContain('4');
  });
  it('materiais faz match por substring', () => {
    expect(ids(run(f({ materiais: ['inox'] })))).toEqual(['2']);
  });
  it('supplier por nome (brand/supplier.name) case-insensitive', () => {
    expect(ids(run(f({ suppliers: ['acmeco'] })))).toEqual(['8']);
  });
  it('busca substring por nome/sku/descrição', () => {
    expect(ids(run(f({ search: 'squeeze' })))).toEqual(['2']);
    expect(ids(run(f({ search: 'GT-9' })))).toEqual(['8']);
  });
  it('minStock alto zera o resultado', () => {
    expect(run(f({ minStock: 1000 }))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Filtros server-side (Sets) — color/category/material/size
// ---------------------------------------------------------------------------
describe('SIM — filtros server-side por Set de IDs', () => {
  it('cor: aplica o Set; vazio + não carregando → zera', () => {
    expect(
      ids(
        run(f(), baseCtx({ hasColorFilter: true, colorFilteredProductIds: new Set(['1', '5']) })),
      ),
    ).toEqual(['1', '5']);
    expect(
      run(
        f(),
        baseCtx({
          hasColorFilter: true,
          colorFilteredProductIds: new Set(),
          isLoadingColorFilter: false,
        }),
      ),
    ).toHaveLength(0);
  });
  it('cor: Set vazio mas carregando → mantém catálogo (não zera prematuramente)', () => {
    expect(
      run(
        f(),
        baseCtx({
          hasColorFilter: true,
          colorFilteredProductIds: new Set(),
          isLoadingColorFilter: true,
        }),
      ),
    ).toHaveLength(CATALOG.length);
  });
  it('categoria: erro não zera (degrada graciosamente)', () => {
    expect(
      run(
        f(),
        baseCtx({
          hasCategoryFilter: true,
          categoryFilteredProductIds: new Set(),
          isLoadingCategoryFilter: false,
          categoryFilterError: new Error('x'),
        }),
      ),
    ).toHaveLength(CATALOG.length);
  });
  it('size server-side: usa Set quando hasSizeFilter; vazio + não carregando → zera', () => {
    const ctx = baseCtx({
      hasSizeFilter: true,
      sizeFilteredProductIds: new Set(['3']),
      isLoadingSizeFilter: false,
    });
    expect(ids(run(f({ sizes: ['M'] }), ctx))).toEqual(['3']);
    const empty = baseCtx({
      hasSizeFilter: true,
      sizeFilteredProductIds: new Set(),
      isLoadingSizeFilter: false,
    });
    expect(run(f({ sizes: ['XGG'] }), empty)).toHaveLength(0);
  });
  it('size legado (sem contexto server) cai no match por variações carregadas', () => {
    expect(ids(run(f({ sizes: ['M'] })))).toEqual(['3']);
    expect(ids(run(f({ sizes: ['G'] })))).toEqual(['7']);
  });
});

// ---------------------------------------------------------------------------
// Fuzzy + ordenação
// ---------------------------------------------------------------------------
describe('SIM — fuzzy search e ordenação', () => {
  it('fuzzy ativo: usa resultados fuzzy e NÃO reaplica substring', () => {
    const ctx = baseCtx({ hasFuzzySearch: true, fuzzySearchResults: [CATALOG[1]] });
    // busca "sqz" jamais casaria por substring, mas fuzzy entregou o Squeeze
    expect(ids(run(f({ search: 'sqz' }), ctx))).toEqual(['2']);
  });
  it('ordenação por preço asc não muda o conjunto', () => {
    const unsorted = ids(run(f()));
    const sorted = ids(run(f({ sortBy: 'price-asc' })));
    expect(sorted).toEqual(unsorted);
  });
  it('ordenação por preço asc ordena corretamente', () => {
    const out = run(f({ sortBy: 'price-asc' })).map((p) => p.price);
    const sortedCopy = [...out].sort((a, b) => a - b);
    expect(out).toEqual(sortedCopy);
  });
  it('técnicas inertes quando techniquesDataAvailable=false (não filtra)', () => {
    expect(run(f({ techniques: ['serigrafia'] })).length).toBe(CATALOG.length);
  });
});
