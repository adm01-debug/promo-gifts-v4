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
  it('gender feminino é case-insensitive: inclui feminino, exclui unissex, inclui neutros', () => {
    const out = run(f({ gender: ['Feminino'] }));
    expect(ids(out)).toContain('3'); // gender='feminino' — match case-insensitive
    expect(ids(out)).not.toContain('1'); // gender='unissex' — definido, mas diferente → excluído
    // FIX-16: produtos sem gender são neutros → incluídos com qualquer filtro
    expect(ids(out)).toContain('2'); // gender='' → neutro
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
// ---------------------------------------------------------------------------
// FIX-20: gaps de cobertura — minStock boundary, sort stability, three-way AND
// ---------------------------------------------------------------------------
describe('FIX-20: cobertura de gaps — minStock=0, sort stability, three-way AND', () => {
  // minStock boundary
  it('minStock=0 não filtra nada (equivalente a sem filtro)', () => {
    expect(run(f({ minStock: 0 })).length).toBe(CATALOG.length);
  });

  it('minStock=1: exclui produtos sem stock e sem variação com stock', () => {
    // produto 2 (stock=0, sem variações), produto 7 (stock=0, variação G=3 → passa),
    // produto 6 (stock=1 → inclui). Produto 7 tem variação G=3 ≥ 1 → inclui.
    const out = run(f({ minStock: 1 }));
    expect(ids(out)).not.toContain('2'); // stock=0, sem variações
    expect(ids(out)).toContain('6'); // stock=1 → incluído
    expect(ids(out)).toContain('7'); // stock=0 mas variação G=3 ≥ 1 → incluído
  });

  // sort stability: mesmos inputs → mesma ordem
  it('sort stability: aplicar o mesmo sort 10x consecutivas dá sempre a mesma ordem', () => {
    const first = run(f({ sortBy: 'price-asc' })).map((p) => p.id);
    for (let i = 0; i < 9; i++) {
      expect(run(f({ sortBy: 'price-asc' })).map((p) => p.id)).toEqual(first);
    }
  });

  it('sort stability: name_asc tem ordem determinística em múltiplas chamadas', () => {
    const first = run(f({ sortBy: 'name_asc' })).map((p) => p.id);
    expect(run(f({ sortBy: 'name_asc' })).map((p) => p.id)).toEqual(first);
  });

  // three-way AND: material + priceRange + featured
  it('three-way AND: material+preço+featured retorna interseção correta', () => {
    // Produto 1: plastico, R$9.9, featured=true → único match
    // Produto 4: couro, R$250, featured=true → fora do priceRange
    const out = run(f({ materiais: ['plastico'], priceRange: [0, 50], featured: true }));
    expect(ids(out)).toEqual(['1']);
  });

  it('three-way AND: material+inStock+isNew — nenhum produto atende os 3', () => {
    // inox → produto 2 (sem stock), papel → produto 7 (sem stock, newArrival=true)
    // buscar nylon(produto5) + inStock + isNew → produto5 (stock=2, newArrival=false) → excluído
    const out = run(f({ materiais: ['nylon'], inStock: true, isNew: true }));
    expect(out).toHaveLength(0);
  });

  it('three-way AND: material+preço+inStock — produto 1 (plastico, R$9.9, stock=100)', () => {
    const out = run(f({ materiais: ['plastico'], priceRange: [5, 20], inStock: true }));
    expect(ids(out)).toContain('1');
    expect(ids(out)).not.toContain('2'); // inox, não plastico
    expect(ids(out)).not.toContain('4'); // couro, fora do range
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

// ---------------------------------------------------------------------------
// Condições de fronteira — sentinel de preço
// ---------------------------------------------------------------------------
describe('SIM — fronteiras do sentinel de preço (SF-F)', () => {
  it('priceRange [0,9999] = padrão → NÃO ativa filtro (todos os 8 passam)', () => {
    expect(run(f({ priceRange: [0, 9999] })).length).toBe(CATALOG.length);
  });
  it('priceRange [0,9998] → max real, inclui R$5175 mas exclui R$12000', () => {
    const out = run(f({ priceRange: [0, 9998] }));
    expect(out.map((p) => p.id)).toContain('5'); // 5175 < 9998 → inclui
    expect(out.map((p) => p.id)).not.toContain('6'); // 12000 > 9998 → exclui
  });
  it('priceRange [10000,9999] → min > sentinel; exclui tudo exceto produto >=10000', () => {
    const out = run(f({ priceRange: [10000, 9999] }));
    // priceFilterActive: 10000>0 → sim. max(9999) < 9999 → false (sem teto). min=10000.
    expect(out.map((p) => p.id)).toEqual(['6']); // só brinde caro 12000
  });
  it('priceRange [0,12001] → max > sentinel tratado como sem limite, todos passam', () => {
    // max=12001 >= 9999 → sem limite superior
    const out = run(f({ priceRange: [0, 12001] }));
    expect(out.length).toBe(CATALOG.length);
  });
  it('priceRange [5000,9999] → inclui produto R$5175 E R$12000', () => {
    const out = ids(run(f({ priceRange: [5000, 9999] })));
    expect(out).toContain('5'); // 5175 >= 5000
    expect(out).toContain('6'); // 12000 >= 5000, sem teto
  });
  it('priceRange [50,50] → intervalo fechado; inclui apenas Squeeze R$49.9? NÃO (49.9 < 50)', () => {
    const out = run(f({ priceRange: [50, 50] }));
    // 50 < 9999 → max ativo. produtos com price=50 exatamente
    expect(out.every((p) => p.price >= 50 && p.price <= 50)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Catálogo vazio e casos extremos
// ---------------------------------------------------------------------------
describe('SIM — catálogo vazio e extremos', () => {
  it('catálogo vazio → resultado vazio independente de filtros', () => {
    const run0 = (filters: FilterState, ctx = baseCtx()) =>
      applyProductFilters([], filters, filters.sortBy, ctx);
    expect(run0(f({ featured: true }))).toHaveLength(0);
    expect(run0(f({ search: 'algo' }))).toHaveLength(0);
    expect(run0(f())).toHaveLength(0);
  });

  it('todos os filtros boolean ativos simultaneamente → apenas produtos que satisfazem todos', () => {
    const superProduct = makeProduct({
      id: 'super',
      name: 'Super Produto Kit',
      featured: true,
      onSale: true,
      hasPersonalization: true,
      hasCommercialPackaging: true,
      newArrival: true,
      isKit: true,
      stock: 10,
      price: 99,
      gender: 'unissex',
      materials: ['couro'],
    });
    const catalog2 = [...CATALOG, superProduct];
    const run2 = (filters: FilterState, ctx = baseCtx()) =>
      applyProductFilters(catalog2, filters, filters.sortBy, ctx);
    const out = run2(
      f({
        featured: true,
        onSale: true,
        hasPersonalization: true,
        hasCommercialPackaging: true,
        isNew: true,
        isKit: true,
        inStock: true,
        gender: ['unissex'],
      }),
    );
    expect(out.map((p) => p.id)).toEqual(['super']);
  });

  it('priceMin = priceMax = 0 → NÃO filtra (0 não é maior que 0)', () => {
    // priceFilterActive = 0 > 0 || 0 < 9999 → verdadeiro. filter: price >= 0 && (0 < 9999 → price <= 0)
    // Apenas produtos com preço 0 passariam. Catálogo não tem preço 0, todos excluídos.
    const out = run(f({ priceRange: [0, 0] }));
    expect(out).toHaveLength(0);
  });

  it('ramo + segmento AND logic: produto que tem só ramo mas não segmento é excluído', () => {
    // produto 5 tem ramo='tecnologia', nicho='startups'
    // Se filtrar ramo='tecnologia' E segmento='corporativo', o produto 5 não tem 'corporativo'
    const out = run(f({ ramosAtividade: ['tecnologia'], segmentosAtividade: ['corporativo'] }));
    expect(out.map((p) => p.id)).not.toContain('5');
  });

  it('ramo + segmento AND logic: produto com ambos passa', () => {
    const out = run(f({ ramosAtividade: ['tecnologia'], segmentosAtividade: ['startups'] }));
    expect(out.map((p) => p.id)).toContain('5');
  });

  it('datasComemorativas filtra por tag', () => {
    // nenhum produto do catálogo tem datasComemorativas, todos excluídos
    const out = run(f({ datasComemorativas: ['natal'] }));
    expect(out).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Filtros server-side — interseção de múltiplos Sets
// ---------------------------------------------------------------------------
describe('SIM — interseção de filtros server-side com filtros locais', () => {
  it('color Set + featured ambos ativos → interseção (AND)', () => {
    // colorFilteredProductIds = {1} + featured=true → produto 1 tem featured=true → permanece
    const ctx = baseCtx({ hasColorFilter: true, colorFilteredProductIds: new Set(['1', '2']) });
    const out = run(f({ featured: true }), ctx);
    expect(ids(out)).toEqual(['1']); // produto 1 é featured AND está no color set
  });

  it('size server-side Set vazio + carregando → mantém catálogo completo', () => {
    const ctx = baseCtx({
      hasSizeFilter: true,
      sizeFilteredProductIds: new Set(),
      isLoadingSizeFilter: true,
    });
    expect(run(f({ sizes: ['XGG'] }), ctx).length).toBe(CATALOG.length);
  });

  it('material + price combinados (server-side + local)', () => {
    const ctx = baseCtx({
      hasMaterialFilter: true,
      materialFilteredProductIds: new Set(['2', '5']),
    });
    // produto 2 = R$49.9, produto 5 = R$5175. filtro preço [50, 9999] → exclui produto 2
    const out = run(f({ priceRange: [50, 9999] }), ctx);
    expect(ids(out)).toEqual(['5']); // 5175 >= 50, sem teto (9999 é sentinel)
  });
});

// ---------------------------------------------------------------------------
// Caminhos de ERRO — graça degradada (grade não zera em falha server-side)
// ---------------------------------------------------------------------------
describe('SIM — error gates: falha de servidor nunca zera a grade', () => {
  it('metadataFilterError: grade intacta (não zera) quando RPC falha', () => {
    const ctx = baseCtx({
      hasMetadataFilter: true,
      metadataFilteredProductIds: new Set(), // RPC retornou vazio por erro
      isLoadingMetadataFilter: false,
      metadataFilterError: new Error('rpc timeout'),
    });
    // Com erro: não zera — grade completa retorna
    expect(run(f({ datasComemorativas: ['natal'] }), ctx).length).toBe(CATALOG.length);
  });

  it('sizeFilterError: grade intacta quando query de tamanhos falha', () => {
    const ctx = baseCtx({
      hasSizeFilter: true,
      sizeFilteredProductIds: new Set(),
      isLoadingSizeFilter: false,
      sizeFilterError: new Error('connection refused'),
    });
    expect(run(f({ sizes: ['M'] }), ctx).length).toBe(CATALOG.length);
  });

  it('categoryFilterError: grade intacta quando categories-api falha', () => {
    const ctx = baseCtx({
      hasCategoryFilter: true,
      categoryFilteredProductIds: new Set(),
      isLoadingCategoryFilter: false,
      categoryFilterError: new Error('categories-api 503'),
    });
    expect(run(f(), ctx).length).toBe(CATALOG.length);
  });

  // FIX-21: color filter error guard (mirrors categoryFilterError behavior)
  it('FIX-21: colorFilterError: grade intacta quando RPC de cor falha', () => {
    const ctx = baseCtx({
      hasColorFilter: true,
      colorFilteredProductIds: new Set(),
      isLoadingColorFilter: false,
      colorFilterError: new Error('color-rpc timeout'),
    });
    expect(run(f({ colors: ['azul'] }), ctx).length).toBe(CATALOG.length);
  });

  it('FIX-21: colorFilterError: string error também preserva a grade', () => {
    const ctx = baseCtx({
      hasColorFilter: true,
      colorFilteredProductIds: new Set(),
      isLoadingColorFilter: false,
      colorFilterError: 'network error',
    });
    expect(run(f({ colorGroups: ['azuis'] }), ctx).length).toBe(CATALOG.length);
  });

  it('FIX-21: cor Set vazio + sem erro + sem loading = zera grade (comportamento correto)', () => {
    // Sem erro e sem loading, Set vazio significa "nenhum produto desta cor" → grade zerada
    const ctx = baseCtx({
      hasColorFilter: true,
      colorFilteredProductIds: new Set(),
      isLoadingColorFilter: false,
      colorFilterError: undefined,
    });
    expect(run(f({ colors: ['cor-inexistente'] }), ctx).length).toBe(0);
  });

  it('FIX-21: cor Set não vazio + erro = filtra normalmente (Set parcial disponível)', () => {
    // Erro APÓS resultado parcial: usa o Set disponível, não zera
    const colorIds = new Set(['1', '2']);
    const ctx = baseCtx({
      hasColorFilter: true,
      colorFilteredProductIds: colorIds,
      isLoadingColorFilter: false,
      colorFilterError: new Error('partial failure'),
    });
    const out = run(f({ colors: ['azul'] }), ctx);
    expect(out.length).toBe(2);
    expect(ids(out)).toEqual(expect.arrayContaining(['1', '2']));
  });

  it('FIX-21: cor error + filtro local price ativo = price ainda filtra', () => {
    const ctx = baseCtx({
      hasColorFilter: true,
      colorFilteredProductIds: new Set(),
      isLoadingColorFilter: false,
      colorFilterError: new Error('rpc error'),
    });
    // priceRange [0, 10] deve filtrar por preço mesmo com color error
    const out = run(f({ priceRange: [0, 10] as [number, number] }), ctx);
    expect(out.every((p) => p.price <= 10)).toBe(true);
    expect(out.length).toBeGreaterThan(0);
  });

  it('cor: Set vazio + carregando = mantém (loading gate)', () => {
    const ctx = baseCtx({
      hasColorFilter: true,
      colorFilteredProductIds: new Set(),
      isLoadingColorFilter: true,
    });
    expect(run(f(), ctx).length).toBe(CATALOG.length);
  });

  it('material: Set vazio + carregando = mantém (loading gate)', () => {
    const ctx = baseCtx({
      hasMaterialFilter: true,
      materialFilteredProductIds: new Set(),
      isLoadingMaterialFilter: true,
    });
    expect(run(f(), ctx).length).toBe(CATALOG.length);
  });

  it('erro metadata + filtro local ativo: filtra local, NÃO server-side', () => {
    // metadata server falhou; filtro local featured deve ainda funcionar
    const ctx = baseCtx({
      hasMetadataFilter: true,
      metadataFilteredProductIds: new Set(),
      isLoadingMetadataFilter: false,
      metadataFilterError: new Error('rpc error'),
    });
    // featured ainda funciona (filtro local)
    const out = run(f({ featured: true }), ctx);
    expect(ids(out)).toEqual(['1', '4']);
  });

  it('dois filtros server-side em erro simultâneo: nenhum zera a grade', () => {
    const ctx = baseCtx({
      hasCategoryFilter: true,
      categoryFilteredProductIds: new Set(),
      isLoadingCategoryFilter: false,
      categoryFilterError: new Error('x'),
      hasSizeFilter: true,
      sizeFilteredProductIds: new Set(),
      isLoadingSizeFilter: false,
      sizeFilterError: new Error('y'),
    });
    expect(run(f({ sizes: ['M'], categories: ['cat-1'] }), ctx).length).toBe(CATALOG.length);
  });
});

// ---------------------------------------------------------------------------
// Filtros de vendas — promoSalesMap e supplierSalesMap
// ---------------------------------------------------------------------------
describe('SIM — filtros de vendas (promoSales90d e supplierSales90d)', () => {
  const promoMap = new Map([
    ['1', 50],
    ['3', 120],
    ['5', 8],
  ]);
  const supplierMap = new Map([
    ['1', { depleted90d: 300, depleted30d: 100 }],
    ['8', { depleted90d: 2000, depleted30d: 600 }],
  ]);

  it('minPromoSales90d filtra produtos abaixo do threshold', () => {
    const ctx = baseCtx({ promoSales90dMap: promoMap });
    const out = run(f({ minPromoSales90d: 100 }), ctx);
    expect(ids(out)).toEqual(['3']); // apenas p3 tem 120 >= 100
  });

  it('minPromoSales90d=0 → não filtra (padrão)', () => {
    const ctx = baseCtx({ promoSales90dMap: promoMap });
    expect(run(f({ minPromoSales90d: 0 }), ctx).length).toBe(CATALOG.length);
  });

  it('minPromoSales90d sem map → não filtra (mapa ausente)', () => {
    expect(run(f({ minPromoSales90d: 50 })).length).toBe(CATALOG.length);
  });

  it('minPromoSales90d com mapa vazio → não filtra', () => {
    const ctx = baseCtx({ promoSales90dMap: new Map() });
    expect(run(f({ minPromoSales90d: 50 }), ctx).length).toBe(CATALOG.length);
  });

  it('produto não presente no promoMap tem contagem=0 (abaixo de threshold)', () => {
    const ctx = baseCtx({ promoSales90dMap: promoMap });
    const out = run(f({ minPromoSales90d: 1 }), ctx);
    // p2,4,6,7,8 não estão no mapa → excluídos; p1(50),p3(120),p5(8) passam
    expect(ids(out)).toEqual(['1', '3', '5']);
  });

  it('minSupplierSales90d filtra pelo depleted90d do fornecedor', () => {
    const ctx = baseCtx({ supplierSalesMap: supplierMap });
    const out = run(f({ minSupplierSales90d: 1000 }), ctx);
    expect(ids(out)).toEqual(['8']); // depleted90d=2000 >= 1000
  });

  it('supplierSalesMap: produto ausente tem depleted90d=0', () => {
    const ctx = baseCtx({ supplierSalesMap: supplierMap });
    const out = run(f({ minSupplierSales90d: 100 }), ctx);
    expect(ids(out)).toEqual(['1', '8']); // 300 e 2000 >= 100
  });

  it('promoSales + supplierSales combinados: AND entre thresholds', () => {
    const ctx = baseCtx({ promoSales90dMap: promoMap, supplierSalesMap: supplierMap });
    // minPromo >= 40: p1(50), p3(120) | minSupplier >= 200: p1(300), p8(2000)
    // intersecção: apenas p1 (aparece nos dois)
    const out = run(f({ minPromoSales90d: 40, minSupplierSales90d: 200 }), ctx);
    expect(ids(out)).toEqual(['1']);
  });
});

// ---------------------------------------------------------------------------
// Metadata server-side (hasMetadataFilter) — comportamento do gate
// ---------------------------------------------------------------------------
describe('SIM — metadata server-side gate', () => {
  it('hasMetadataFilter=true: bloco client-side endomarketing NÃO executa', () => {
    // produto 5 tem tags.endomarketing=['onboarding'] → client-side acertaria
    // mas com hasMetadataFilter=true, o bloco client-side é pulado
    const ctx = baseCtx({
      hasMetadataFilter: true,
      metadataFilteredProductIds: new Set(['1', '2']), // server diz apenas 1 e 2
      isLoadingMetadataFilter: false,
    });
    // filtro endomarketing=['onboarding'] com server ativo → usa Set do server
    const out = run(f({ endomarketing: ['onboarding'] }), ctx);
    expect(ids(out)).toEqual(['1', '2']); // server Set, ignora client-side
    expect(ids(out)).not.toContain('5'); // p5 está fora do server Set
  });

  it('hasMetadataFilter=true: bloco client-side publicoAlvo NÃO executa', () => {
    const ctx = baseCtx({
      hasMetadataFilter: true,
      metadataFilteredProductIds: new Set(['8']),
      isLoadingMetadataFilter: false,
    });
    const out = run(f({ publicoAlvo: ['executivo'] }), ctx);
    expect(ids(out)).toEqual(['8']); // server Set (p8 não tem tag executivo mas server decidiu)
  });

  it('hasMetadataFilter=false: bloco client-side publicoAlvo executa normalmente', () => {
    // produto 5 tem tags.publicoAlvo=['executivo']
    const out = run(f({ publicoAlvo: ['executivo'] }));
    expect(ids(out)).toEqual(['5']);
  });

  it('hasMetadataFilter=true + Set vazio + carregando → mantém catálogo', () => {
    const ctx = baseCtx({
      hasMetadataFilter: true,
      metadataFilteredProductIds: new Set(),
      isLoadingMetadataFilter: true,
    });
    expect(run(f({ datasComemorativas: ['natal'] }), ctx).length).toBe(CATALOG.length);
  });

  it('hasMetadataFilter=true + Set populado → intersecta com outros filtros locais', () => {
    const ctx = baseCtx({
      hasMetadataFilter: true,
      metadataFilteredProductIds: new Set(['1', '4', '5']),
      isLoadingMetadataFilter: false,
    });
    // metadata server retorna {1,4,5}; featured=true filtra localmente → {1,4}
    const out = run(f({ featured: true }), ctx);
    expect(ids(out)).toEqual(['1', '4']);
  });
});

// ---------------------------------------------------------------------------
// Cenários de regressão e casos extremos adicionais
// ---------------------------------------------------------------------------
describe('SIM — regressões e casos extremos adicionais', () => {
  it('minStock com variações: produto com stock=0 mas variação G=3 passa com minStock=2', () => {
    // produto 7: stock=0, variações [{P,0},{G,3}]
    const out = run(f({ minStock: 2 }));
    expect(ids(out)).toContain('7'); // variação G tem 3 >= 2
  });

  it('minStock com variações: produto 7 excluído com minStock=4 (max variação=3)', () => {
    const out = run(f({ minStock: 4 }));
    expect(ids(out)).not.toContain('7');
  });

  it('supplier match por supplier.id tem prioridade sobre nome', () => {
    const out = run(f({ suppliers: ['sup-1'] }));
    expect(ids(out)).toContain('8'); // supplier.id = 'sup-1'
  });

  it('busca vazia não filtra nada', () => {
    expect(run(f({ search: '' })).length).toBe(CATALOG.length);
  });

  it('busca case-insensitive', () => {
    expect(ids(run(f({ search: 'CANETA' })))).toEqual(['1']);
    expect(ids(run(f({ search: 'Squeeze' })))).toEqual(['2']);
  });

  it('fuzzy ativo + sort=name: preserva ordem de relevância (não reordena)', () => {
    const fuzzyResults = [CATALOG[2], CATALOG[0]]; // ordem de relevância
    const ctx = baseCtx({ hasFuzzySearch: true, fuzzySearchResults: fuzzyResults });
    const out = run(f({ sortBy: 'name' }), ctx);
    expect(out[0].id).toBe('3'); // preserva ordem fuzzy, não reordena por nome
    expect(out[1].id).toBe('1');
  });

  it('gender multi-value: produtos matching qualquer gênero da lista', () => {
    const out = run(f({ gender: ['unissex', 'feminino'] }));
    expect(ids(out)).toContain('1'); // unissex
    expect(ids(out)).toContain('3'); // feminino
    // FIX-16: produtos sem gênero (gender='') são neutros → incluídos em qualquer filtro
    expect(ids(out)).toContain('4'); // Kit Executivo não tem gender definido → neutro
  });

  // ---------------------------------------------------------------------------
  // FIX-16: GENDER-NULL-PRODUCTS — neutros incluídos em qualquer filtro de gênero
  // ---------------------------------------------------------------------------
  describe('FIX-16: produtos com gender null/vazio são neutros (não excluídos)', () => {
    const pNull = makeProduct({ id: 'g-null', gender: null as never });
    const pEmpty = makeProduct({ id: 'g-empty', gender: '' });
    const pFem = makeProduct({ id: 'g-fem', gender: 'feminino' });
    const pMasc = makeProduct({ id: 'g-masc', gender: 'masculino' });
    const catalogG = [pNull, pEmpty, pFem, pMasc];
    const runG = (filters: FilterState) =>
      applyProductFilters(catalogG, filters, filters.sortBy, baseCtx());

    it('filtro feminino → inclui produtos com gender=null', () => {
      const out = runG(f({ gender: ['feminino'] }));
      expect(ids(out)).toContain('g-null');
    });

    it('filtro feminino → inclui produtos com gender="" (vazio)', () => {
      const out = runG(f({ gender: ['feminino'] }));
      expect(ids(out)).toContain('g-empty');
    });

    it('filtro feminino → inclui produto com gender=feminino', () => {
      const out = runG(f({ gender: ['feminino'] }));
      expect(ids(out)).toContain('g-fem');
    });

    it('filtro feminino → exclui produto com gender=masculino (gênero definido diferente)', () => {
      const out = runG(f({ gender: ['feminino'] }));
      expect(ids(out)).not.toContain('g-masc');
    });

    it('filtro masculino → inclui neutros, exclui feminino', () => {
      const out = runG(f({ gender: ['masculino'] }));
      expect(ids(out)).toContain('g-null');
      expect(ids(out)).toContain('g-empty');
      expect(ids(out)).toContain('g-masc');
      expect(ids(out)).not.toContain('g-fem');
    });

    it('sem filtro gender → todos os produtos aparecem', () => {
      const out = runG(f());
      expect(out.length).toBe(catalogG.length);
    });
  });

  it('sizes legado: produto sem variações é excluído mesmo que tamanho coincida', () => {
    // produto 1 não tem variações; tamanho M não casa
    const out = run(f({ sizes: ['M'] }));
    expect(ids(out)).not.toContain('1');
    expect(ids(out)).toContain('3'); // tem variação M
  });

  it('técnicas ativas com techniquesDataAvailable=true filtra por metadata.techniques', () => {
    const productWithTech = makeProduct({
      id: 'tech-p',
      name: 'Produto Técnica',
      metadata: { techniques: ['serigrafia'] },
    });
    const run2 = (filters: FilterState, ctx = baseCtx()) =>
      applyProductFilters([...CATALOG, productWithTech], filters, filters.sortBy, ctx);
    const ctx = baseCtx({ techniquesDataAvailable: true });
    const out = run2(f({ techniques: ['serigrafia'] }), ctx);
    expect(ids(out)).toContain('tech-p');
    // produtos sem técnica mas techniquesDataAvailable=true → NÃO excluídos (passa se metaTechs vazio)
    expect(ids(out)).toContain('1'); // sem metadata.techniques → metaTechs=[] → passa
  });

  it('técnicas: produto com técnicas mas sem match é excluído', () => {
    const productWithTech = makeProduct({
      id: 'tech-p',
      name: 'Produto Técnica',
      metadata: { techniques: ['bordado'] },
    });
    const run2 = (filters: FilterState, ctx = baseCtx()) =>
      applyProductFilters([...CATALOG, productWithTech], filters, filters.sortBy, ctx);
    const ctx = baseCtx({ techniquesDataAvailable: true });
    const out = run2(f({ techniques: ['serigrafia'] }), ctx);
    expect(ids(out)).not.toContain('tech-p'); // bordado != serigrafia
  });

  it('pipeline completo: 8 filtros simultâneos retorna exatamente os corretos', () => {
    // produto 8: AcmeCo, preço 89.9, hasCommercialPackaging, stock 50
    const ctx = baseCtx({
      hasColorFilter: true,
      colorFilteredProductIds: new Set(['8', '1', '2', '3', '4', '5', '6', '7']),
    });
    const out = run(
      f({
        suppliers: ['acmeco'],
        priceRange: [50, 200],
        hasCommercialPackaging: true,
        inStock: true,
        minStock: 10,
        sortBy: 'price-asc',
      }),
      ctx,
    );
    expect(ids(out)).toEqual(['8']);
  });
});

// ---------------------------------------------------------------------------
// FIX-10 — Gaps identificados na análise de simulação de cenários
// ---------------------------------------------------------------------------
describe('SIM — FIX-10: gaps de cobertura identificados na análise exaustiva', () => {
  // 1. isNew isolado — retorna exatamente os produtos com newArrival=true
  it('isNew isolado: retorna exatamente produtos 4 e 7 (newArrival=true)', () => {
    const out = run(f({ isNew: true }));
    expect(ids(out)).toEqual(['4', '7']);
  });

  // 2. Fuzzy search + price filter: o filtro de preço aplica sobre resultados fuzzy
  it('fuzzy ativo + priceRange: preço ainda filtra sobre resultados do fuzzy', () => {
    // fuzzy retorna produtos 1 (R$9.9), 2 (R$49.9), 3 (R$79.9)
    // priceRange [20, 9999]: exclui produto 1 (9.9 < 20), mantém 2 e 3
    const ctx = baseCtx({
      hasFuzzySearch: true,
      fuzzySearchResults: [CATALOG[0], CATALOG[1], CATALOG[2]], // ids 1, 2, 3
    });
    const out = run(f({ priceRange: [20, 9999] }), ctx);
    expect(ids(out)).toEqual(['2', '3']);
    expect(ids(out)).not.toContain('1');
  });

  it('fuzzy ativo: sem filtros locais adicionais → retorna o set fuzzy intato', () => {
    const ctx = baseCtx({
      hasFuzzySearch: true,
      fuzzySearchResults: [CATALOG[1], CATALOG[3]], // ids 2, 4
    });
    const out = run(f(), ctx);
    expect(ids(out)).toEqual(['2', '4']);
  });

  // 3. endomarketing client-side (sem hasMetadataFilter)
  it('endomarketing client-side: produto 5 (tags.endomarketing=onboarding) retornado', () => {
    // produto 5 tem tags.endomarketing: ['onboarding']
    // sem hasMetadataFilter, o filtro client-side deve operar sobre product.tags
    const out = run(f({ endomarketing: ['onboarding'] }));
    expect(ids(out)).toEqual(['5']);
  });

  it('endomarketing com hasMetadataFilter=true: bloco client-side ignorado (BUG-DB-07)', () => {
    // Quando a RPC de metadata está ativa, endomarketing NÃO roda client-side
    // (tags são vazias no catálogo leve — rodar zeraria a grade).
    // O gate !hasMetadataFilter deve impedir o bloco client-side.
    const ctx = baseCtx({
      hasMetadataFilter: true,
      metadataFilteredProductIds: new Set(['5', '1', '2']),
      isLoadingMetadataFilter: false,
    });
    const out = run(f({ endomarketing: ['onboarding'] }), ctx);
    // filtro passa pelo Set da RPC; client-side não exclui os 3 produtos
    expect(ids(out)).toEqual(['1', '2', '5']);
  });

  // 4. tags client-side (sem hasMetadataFilter)
  it('tags client-side: tag "onboarding" retorna produto 5 via tags.endomarketing', () => {
    // filtro tags[] varre publicoAlvo, datasComemorativas, endomarketing, ramo, nicho
    const out = run(f({ tags: ['onboarding'] }));
    expect(ids(out)).toEqual(['5']);
  });

  it('tags client-side: tag "tecnologia" retorna produto 5 via tags.ramo', () => {
    const out = run(f({ tags: ['tecnologia'] }));
    expect(ids(out)).toEqual(['5']);
  });

  it('tags client-side: tag "executivo" retorna produto 5 via tags.publicoAlvo', () => {
    const out = run(f({ tags: ['executivo'] }));
    expect(ids(out)).toEqual(['5']);
  });

  it('tags client-side: tag inexistente retorna vazio', () => {
    const out = run(f({ tags: ['xyz-tag-inexistente'] }));
    expect(out).toHaveLength(0);
  });

  // 5. supplier_reference — filtragem via referência interna (não pelo nome)
  it('supplier_reference: filtrar pela referência interna retorna o produto correto', () => {
    const productWithRef = makeProduct({
      id: 'ref-p',
      name: 'Produto Referência',
      supplier_reference: 'REF-42',
      price: 30,
    });
    const catalogWithRef = [...CATALOG, productWithRef];
    const runR = (filters: FilterState, ctx = baseCtx()) =>
      applyProductFilters(catalogWithRef, filters, filters.sortBy, ctx);
    const out = runR(f({ suppliers: ['REF-42'] }));
    expect(out.map((p) => p.id)).toContain('ref-p');
    // produto 8 (AcmeCo) não tem supplier_reference='REF-42' → não deve aparecer
    expect(out.map((p) => p.id)).not.toContain('8');
  });

  it('supplier_reference: referência diferente da do filtro → não retorna', () => {
    const productWithRef = makeProduct({
      id: 'ref-p',
      name: 'Produto Referência',
      supplier_reference: 'REF-99',
    });
    const catalogWithRef = [...CATALOG, productWithRef];
    const runR = (filters: FilterState, ctx = baseCtx()) =>
      applyProductFilters(catalogWithRef, filters, filters.sortBy, ctx);
    const out = runR(f({ suppliers: ['REF-42'] }));
    expect(out.map((p) => p.id)).not.toContain('ref-p');
  });

  // ---------------------------------------------------------------------------
  // FIX-17: SUPPLIER-CASE-SENSITIVITY — todas as 3 vias normalizadas para lowercase
  // ---------------------------------------------------------------------------
  describe('FIX-17: supplier filter — match case-insensitivo em id, reference e name', () => {
    const pUpperId = makeProduct({
      id: 'sup-upper-id',
      supplier: { id: 'SUP-ABC', name: 'Fornecedor X' } as never,
    });
    const pLowerId = makeProduct({
      id: 'sup-lower-id',
      supplier: { id: 'sup-abc', name: 'Fornecedor Y' } as never,
    });
    const pUpperRef = makeProduct({ id: 'sup-upper-ref', supplier_reference: 'REF-XYZ' });
    const pLowerRef = makeProduct({ id: 'sup-lower-ref', supplier_reference: 'ref-xyz' });
    const pUpperName = makeProduct({
      id: 'sup-upper-name',
      supplier: { id: 'sup-zz', name: 'ACMECO' } as never,
    });
    const catalogSup = [pUpperId, pLowerId, pUpperRef, pLowerRef, pUpperName];
    const runSup = (filters: FilterState) =>
      applyProductFilters(catalogSup, filters, filters.sortBy, baseCtx());

    it('filtro "sup-abc" (lower) deve casar supplier.id "SUP-ABC" (upper)', () => {
      const out = runSup(f({ suppliers: ['sup-abc'] }));
      expect(ids(out)).toContain('sup-upper-id');
    });

    it('filtro "SUP-ABC" (upper) deve casar supplier.id "sup-abc" (lower)', () => {
      const out = runSup(f({ suppliers: ['SUP-ABC'] }));
      expect(ids(out)).toContain('sup-lower-id');
    });

    it('filtro "ref-xyz" (lower) deve casar supplier_reference "REF-XYZ" (upper)', () => {
      const out = runSup(f({ suppliers: ['ref-xyz'] }));
      expect(ids(out)).toContain('sup-upper-ref');
    });

    it('filtro "REF-XYZ" (upper) deve casar supplier_reference "ref-xyz" (lower)', () => {
      const out = runSup(f({ suppliers: ['REF-XYZ'] }));
      expect(ids(out)).toContain('sup-lower-ref');
    });

    it('filtro "acmeco" (lower) deve casar supplier.name "ACMECO" (upper)', () => {
      const out = runSup(f({ suppliers: ['acmeco'] }));
      expect(ids(out)).toContain('sup-upper-name');
    });

    it('supplier com id diferente não deve casar mesmo com casing alterado', () => {
      const out = runSup(f({ suppliers: ['sup-xyz'] }));
      expect(ids(out)).not.toContain('sup-upper-id');
      expect(ids(out)).not.toContain('sup-lower-id');
    });
  });

  // 6. Limites de preço fracionários — inclusão exata nos extremos
  it('priceRange [9.9, 49.9]: inclui produtos exatamente nos limites (R$9.9 e R$49.9)', () => {
    // produto 1 = R$9.9 (no limite inferior), produto 2 = R$49.9 (no limite superior)
    const out = run(f({ priceRange: [9.9, 49.9] }));
    expect(ids(out)).toContain('1'); // 9.9 >= 9.9 → incluído
    expect(ids(out)).toContain('2'); // 49.9 <= 49.9 → incluído
    expect(ids(out)).not.toContain('3'); // 79.9 > 49.9 → excluído
  });

  it('priceRange [9.91, 49.89]: produto 1 (R$9.9) e produto 2 (R$49.9) excluídos', () => {
    // Prova que a comparação é >= e <= (não > e <)
    const out = run(f({ priceRange: [9.91, 49.89] }));
    expect(ids(out)).not.toContain('1'); // 9.9 < 9.91 → excluído
    expect(ids(out)).not.toContain('2'); // 49.9 > 49.89 → excluído
    // produto 7 (R$19.9) ainda deve estar entre 9.91 e 49.89
    expect(ids(out)).toContain('7');
  });

  it('priceRange [9.9, 9.9]: intervalo fechado no valor exato → só produto 1', () => {
    const out = run(f({ priceRange: [9.9, 9.9] }));
    expect(ids(out)).toEqual(['1']);
  });

  // ---------------------------------------------------------------------------
  // FIX-15: SIZE-FILTER-CASE-SENSITIVITY (legado — sem servidor)
  // ---------------------------------------------------------------------------
  describe('FIX-15: size filter — case/trim normalization (legacy path)', () => {
    // Catálogo auxiliar com variações em casing misto
    const p_M_upper = makeProduct({
      id: 'sz-upper',
      variations: [{ size_code: 'M', stock: 1 } as never],
    });
    const p_M_lower = makeProduct({
      id: 'sz-lower',
      variations: [{ size_code: 'm', stock: 1 } as never],
    });
    const p_XL_mixed = makeProduct({
      id: 'sz-xl',
      variations: [{ size_code: ' XL ', stock: 1 } as never],
    });
    const catalogSizes = [p_M_upper, p_M_lower, p_XL_mixed];
    const runSz = (filters: FilterState) =>
      applyProductFilters(catalogSizes, filters, filters.sortBy, baseCtx());

    it('filtro "m" (minúsculo) deve casar com variação "M" (maiúsculo)', () => {
      const out = runSz(f({ sizes: ['m'] }));
      expect(ids(out)).toContain('sz-upper');
      expect(ids(out)).toContain('sz-lower');
    });

    it('filtro "M" (maiúsculo) deve casar com variação "m" (minúsculo)', () => {
      const out = runSz(f({ sizes: ['M'] }));
      expect(ids(out)).toContain('sz-upper');
      expect(ids(out)).toContain('sz-lower');
    });

    it('filtro "xl" deve casar com variação " XL " (com espaços)', () => {
      const out = runSz(f({ sizes: ['xl'] }));
      expect(ids(out)).toContain('sz-xl');
      expect(ids(out)).not.toContain('sz-upper');
    });

    it('filtro " XL " (com espaços) deve casar com variação "xl" normalizada', () => {
      const p_xl_clean = makeProduct({
        id: 'sz-xl-clean',
        variations: [{ size_code: 'xl', stock: 1 } as never],
      });
      const out = applyProductFilters([p_xl_clean], f({ sizes: [' XL '] }), 'name_asc', baseCtx());
      expect(ids(out)).toContain('sz-xl-clean');
    });

    it('filtro com casing diferente não deve excluir produto com variação correspondente', () => {
      // Produto 3 do CATALOG tem variação size_code: 'M'
      const out = run(f({ sizes: ['m'] }));
      expect(ids(out)).toContain('3'); // 'm' deve casar 'M'
    });

    it('filtro com casing correto ainda funciona (não quebra caso normal)', () => {
      const out = run(f({ sizes: ['M'] }));
      expect(ids(out)).toContain('3'); // 'M' = 'M' → incluído
      expect(ids(out)).not.toContain('7'); // produto 7 tem 'P' e 'G', não 'M'
    });

    it('combinação de tamanhos com casing misto retorna todos os matches', () => {
      const out = run(f({ sizes: ['m', 'p'] }));
      expect(ids(out)).toContain('3'); // tem 'M'
      expect(ids(out)).toContain('7'); // tem 'P'
    });
  });
});
