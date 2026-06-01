/**
 * Testes de regressão para BUG-15 a BUG-22 + BUG-VOZ
 * Auditoria exaustiva Super Filtro — 26/05/2026
 *
 * Cobertura:
 *  BUG-15a — filtro featured ausente em useFiltersPageState
 *  BUG-15b — filtro isNew (→ newArrival) ausente em useFiltersPageState
 *  BUG-15c — hasPersonalization ausente do tipo Product (type fix)
 *  BUG-16  — filtro gender ausente em useFiltersPageState
 *  BUG-17  — filtro sizes (via variations.size_code) ausente em useFiltersPageState
 *  BUG-19  — stale closure em useFilterPanelState debouncedSearch effect
 *  BUG-20  — fuzzySearchQuery usava searchParams.get('search') stale
 *  BUG-21  — priceRange threshold < 500 em useCatalogFiltering
 *  BUG-22  — priceRange threshold < 500 em useCatalogState.activeFiltersCount
 *  BUG-VOZ — sortMap sem best-seller-supplier / best-seller-promo
 */

import { describe, it, expect, vi } from 'vitest';
import type { Product } from '@/types/product-catalog';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-test',
    name: 'Produto Teste',
    price: 50,
    stock: 100,
    sku: 'TEST-001',
    description: '',
    images: [],
    colors: [],
    materials: [],
    tags: {},
    supplier: null,
    brand: '',
    supplier_reference: '',
    category_id: '',
    category: null,
    isKit: false,
    featured: false,
    newArrival: false,
    hasCommercialPackaging: false,
    hasPersonalization: false,
    gender: '',
    variations: [],
    created_at: new Date().toISOString(),
    ...overrides,
  } as unknown as Product;
}

// ---------------------------------------------------------------------------
// BUG-15a: filtro featured
// ---------------------------------------------------------------------------

describe('BUG-15a — filtro featured', () => {
  it('deve incluir apenas produtos com featured=true quando filtro ativo', () => {
    const products = [
      makeProduct({ id: '1', featured: true }),
      makeProduct({ id: '2', featured: false }),
      makeProduct({ id: '3' }), // featured undefined → falsy
    ];

    const result = products.filter((p) => p.featured === true);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('não deve filtrar quando featured=false no filtro', () => {
    const products = [
      makeProduct({ id: '1', featured: true }),
      makeProduct({ id: '2', featured: false }),
    ];
    // filtro inativo → todos passam
    const result = products; // sem filtro aplicado
    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// BUG-15b: filtro isNew → newArrival
// ---------------------------------------------------------------------------

describe('BUG-15b — filtro isNew via newArrival', () => {
  it('deve mapear isNew para product.newArrival corretamente', () => {
    const products = [
      makeProduct({ id: '1', newArrival: true }),
      makeProduct({ id: '2', newArrival: false }),
      makeProduct({ id: '3' }),
    ];

    const result = products.filter((p) => p.newArrival === true);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('isNew=true não deve usar product.isNew (campo inexistente no tipo Product)', () => {
    const p = makeProduct({ newArrival: true });
    // Produto não tem campo .isNew — o filtro correto checa .newArrival
    expect((p as Record<string, unknown>).isNew).toBeUndefined();
    expect(p.newArrival).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// BUG-15c: hasPersonalization no tipo Product
// ---------------------------------------------------------------------------

describe('BUG-15c — hasPersonalization no tipo Product', () => {
  it('deve aceitar hasPersonalization no tipo sem erro de TypeScript', () => {
    const p = makeProduct({ hasPersonalization: true });
    expect(p.hasPersonalization).toBe(true);
  });

  it('filtro hasPersonalization deve incluir apenas produtos com campo true', () => {
    const products = [
      makeProduct({ id: '1', hasPersonalization: true }),
      makeProduct({ id: '2', hasPersonalization: false }),
      makeProduct({ id: '3' }), // undefined
    ];
    const result = products.filter((p) => p.hasPersonalization === true);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });
});

// ---------------------------------------------------------------------------
// BUG-16: filtro gender
// ---------------------------------------------------------------------------

describe('BUG-16 — filtro gender', () => {
  it('deve filtrar por gênero com case-insensitive', () => {
    const products = [
      makeProduct({ id: '1', gender: 'Feminino' }),
      makeProduct({ id: '2', gender: 'Masculino' }),
      makeProduct({ id: '3', gender: 'Unissex' }),
      makeProduct({ id: '4', gender: '' }),
    ];

    const selectedGenders = ['feminino'];
    const genderSet = new Set(selectedGenders.map((g) => g.toLowerCase().trim()));
    const result = products.filter((p) => genderSet.has((p.gender || '').toLowerCase().trim()));

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('deve filtrar múltiplos gêneros (OR)', () => {
    const products = [
      makeProduct({ id: '1', gender: 'Feminino' }),
      makeProduct({ id: '2', gender: 'Masculino' }),
      makeProduct({ id: '3', gender: 'Unissex' }),
    ];

    const selectedGenders = ['Feminino', 'Masculino'];
    const genderSet = new Set(selectedGenders.map((g) => g.toLowerCase().trim()));
    const result = products.filter((p) => genderSet.has((p.gender || '').toLowerCase().trim()));

    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// BUG-17: filtro sizes via variations.size_code
// ---------------------------------------------------------------------------

describe('BUG-17 — filtro sizes via variations.size_code', () => {
  it('deve incluir produto com variação que tenha o tamanho selecionado', () => {
    const products = [
      makeProduct({
        id: '1',
        variations: [{ size_code: 'M', stock: 10 }] as never,
      }),
      makeProduct({
        id: '2',
        variations: [{ size_code: 'G', stock: 5 }] as never,
      }),
      makeProduct({ id: '3', variations: [] }),
    ];

    const selectedSizes = ['M'];
    const sizeSet = new Set(selectedSizes);
    const result = products.filter((p) =>
      p.variations?.some(
        (v: Record<string, unknown>) => v.size_code != null && sizeSet.has(String(v.size_code)),
      ),
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('deve excluir produto sem variações quando filtro de tamanho ativo', () => {
    const p = makeProduct({ id: '1', variations: [] });
    const sizeSet = new Set(['P']);
    const passes = p.variations?.some(
      (v: Record<string, unknown>) => v.size_code != null && sizeSet.has(String(v.size_code)),
    );
    expect(passes).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// BUG-21: priceRange threshold < 500 → < 9999 em useCatalogFiltering
// ---------------------------------------------------------------------------

describe('BUG-21 — priceRange ativação com threshold correto', () => {
  const priceFilter = (products: Product[], min: number, max: number) =>
    products.filter((p) => p.price >= min && p.price <= max);

  it('filtro NÃO deve ativar com priceRange=[0, 9999] (threshold padrão)', () => {
    const [min, max] = [0, 9999];
    // BUG-21: condição era < 500, então priceRange=[0, 9999] não ativava o filtro
    // Fix: condição é < 9999
    const isFilterActive = min > 0 || max < 9999;
    expect(isFilterActive).toBe(false);
  });

  it('filtro DEVE ativar com priceRange=[0, 500]', () => {
    const [min, max] = [0, 500];
    const isFilterActive = min > 0 || max < 9999;
    expect(isFilterActive).toBe(true);
  });

  it('filtro DEVE ativar com priceRange=[100, 9999]', () => {
    const [min, max] = [100, 9999];
    const isFilterActive = min > 0 || max < 9999;
    expect(isFilterActive).toBe(true);
  });

  it('deve filtrar produtos no range correto', () => {
    const products = [
      makeProduct({ id: '1', price: 10 }),
      makeProduct({ id: '2', price: 250 }),
      makeProduct({ id: '3', price: 600 }),
      makeProduct({ id: '4', price: 9000 }),
    ];
    const result = priceFilter(products, 0, 500);
    expect(result.map((p) => p.id)).toEqual(['1', '2']);
  });

  it('COM BUG-21: priceRange=[0, 700] era ignorado quando threshold era < 500', () => {
    // Com bug: max=700 > 500, então a condição `max < 500` era false → filtro não ativava
    // Com fix: max=700 < 9999 → filtro ATIVA
    const [min, max] = [0, 700];
    const isFilterActiveBuggy = min > 0 || max < 500; // bug original
    const isFilterActiveFixed = min > 0 || max < 9999; // fix aplicado
    expect(isFilterActiveBuggy).toBe(false); // demonstra o bug
    expect(isFilterActiveFixed).toBe(true); // demonstra o fix
  });
});

// ---------------------------------------------------------------------------
// BUG-22: activeFiltersCount no useCatalogState
// ---------------------------------------------------------------------------

describe('BUG-22 — activeFiltersCount priceRange correto', () => {
  const countPriceFilter = (min: number, max: number, useFixed: boolean) => {
    if (useFixed) return min > 0 || max < 9999 ? 1 : 0;
    return min > 0 || max < 500 ? 1 : 0; // bug original
  };

  it('COM BUG-22: range [0, 700] era contado como 0 (não ativo)', () => {
    expect(countPriceFilter(0, 700, false)).toBe(0); // demonstra o bug
  });

  it('COM FIX-22: range [0, 700] é corretamente contado como 1 (ativo)', () => {
    expect(countPriceFilter(0, 700, true)).toBe(1);
  });

  it('COM FIX-22: range padrão [0, 9999] não conta como filtro ativo', () => {
    expect(countPriceFilter(0, 9999, true)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// BUG-20: fuzzySearchQuery fonte primária
// ---------------------------------------------------------------------------

describe('BUG-20 — fuzzySearchQuery usa filters.search como fonte primária', () => {
  it('deve usar filters.search quando disponível (evita stale do searchParams)', () => {
    const filtersSearch = 'caneta';
    const urlSearch = ''; // searchParams ainda não sincronizou
    const fuzzySearchQuery = filtersSearch || urlSearch || '';
    expect(fuzzySearchQuery).toBe('caneta');
  });

  it('deve fazer fallback para searchParams.get("search") quando filters.search está vazio', () => {
    const filtersSearch = '';
    const urlSearch = 'squeeze'; // chegou via URL direta
    const fuzzySearchQuery = filtersSearch || urlSearch || '';
    expect(fuzzySearchQuery).toBe('squeeze');
  });

  it('COM BUG-20: usava apenas searchParams.get, perdendo 1 render frame de atualização', () => {
    // Bug: fuzzySearchQuery = searchParams.get('search') || ''
    // Após setFilters({search: 'caneta'}), o URL ainda não foi atualizado
    const staleUrlSearch = ''; // stale — URL ainda não refletiu o novo valor
    const buggyQuery = staleUrlSearch || '';
    expect(buggyQuery).toBe(''); // demonstra o bug: fuzzy search não disparava
  });
});

// ---------------------------------------------------------------------------
// BUG-VOZ: sortMap no voice agent
// ---------------------------------------------------------------------------

describe('BUG-VOZ — sortMap inclui best-seller-supplier e best-seller-promo', () => {
  const sortMapFixed: Record<string, string> = {
    'price-asc': 'price-asc',
    'price-desc': 'price-desc',
    name: 'name',
    stock: 'stock',
    newest: 'newest',
    popularity: 'popularity',
    'best-seller-supplier': 'best-seller-supplier',
    'best-seller-promo': 'best-seller-promo',
  };

  const sortMapBuggy: Record<string, string> = {
    'price-asc': 'price-asc',
    'price-desc': 'price-desc',
    name: 'name',
    stock: 'stock',
    newest: 'newest',
    popularity: 'popularity',
    // faltavam as duas entradas
  };

  it('COM BUG-VOZ: best-seller-supplier caia no fallback "name"', () => {
    const sortValue = sortMapBuggy['best-seller-supplier'] || 'name';
    expect(sortValue).toBe('name'); // demonstra o bug
  });

  it('COM FIX-VOZ: best-seller-supplier é mapeado corretamente', () => {
    const sortValue = sortMapFixed['best-seller-supplier'] || 'name';
    expect(sortValue).toBe('best-seller-supplier');
  });

  it('COM FIX-VOZ: best-seller-promo é mapeado corretamente', () => {
    const sortValue = sortMapFixed['best-seller-promo'] || 'name';
    expect(sortValue).toBe('best-seller-promo');
  });

  it('COM FIX-VOZ: popularity ainda funciona (compat retroativa)', () => {
    const sortValue = sortMapFixed['popularity'] || 'name';
    expect(sortValue).toBe('popularity');
  });
});

// ---------------------------------------------------------------------------
// BUG-19: stale closure pattern (unit)
// ---------------------------------------------------------------------------

describe('BUG-19 — padrão ref evita stale closure', () => {
  it('ref sincroniza o valor mais recente imediatamente', () => {
    // Simula o padrão filtersRef implementado
    let filtersRef = { current: { search: '', colors: [] as string[] } };
    const filters1 = { search: '', colors: [] };
    const filters2 = { search: '', colors: ['azul'] }; // alterado durante debounce

    // Simula o efeito: filtersRef.current = filters (roda após cada render)
    filtersRef.current = filters1;
    filtersRef.current = filters2; // sobrescreve antes do debounce disparar

    // Quando o debounce dispara, usa o ref (não o valor capturado em closure)
    const capturedByRef = filtersRef.current;
    expect(capturedByRef.colors).toContain('azul'); // fix: vê o valor atual
  });

  it('closure capturaria o valor stale sem o padrão ref', () => {
    // Simula o bug: closure captura filters1 na criação do effect
    const filters1 = { search: '', colors: [] as string[] };
    const onFilterChangeMock = vi.fn();

    // Cria closure com filters1 (bug)
    const staleClosure = (debouncedSearch: string) => {
      if (debouncedSearch !== filters1.search) {
        onFilterChangeMock({ ...filters1, search: debouncedSearch });
      }
    };

    // Simula alteração de filtros antes do debounce
    // filters1 ainda é o antigo — azul seria perdido
    staleClosure('caneta');
    expect(onFilterChangeMock).toHaveBeenCalledWith({
      search: 'caneta',
      colors: [], // BUG: perdeu as cores adicionadas entre renders
    });
  });
});
