/**
 * bug-g7-regression.unit.test.ts
 *
 * Testes de regressao para BUG-G7 (PR #689) e os 4 gaps semanticos (PR #690).
 * Contexto: o repo recebe commits automatizados (Lovable) que ja reverteram
 * padroes e corromperam arquivos (incidente base64, 2026-06-09). Estes testes
 * congelam os invariantes arquiteturais dos fixes para que qualquer revert
 * acidental quebre o CI imediatamente.
 *
 * Cobertura:
 *   BUG-G7    TooltipTrigger asChild nao pode envolver <Select> composto
 *   GAP-1     Tooltip labels: INTERNAL_SORT_LABELS + fallback generico
 *   GAP-2     Snapshot useRef anti flash-empty-state em transicoes de sort
 *   GAP-3/4   Badge de estoque: stock_quantity/stock normalizado (nunca camelCase)
 *   SORT-VAL  validateSortOption: canonicos + aliases + default seguro
 *
 * Refs: PR #689, PR #690, issue #691 (divida de tipos do ProductQuickView).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateSortOption } from '@/hooks/products/useCatalogState';

const readSrc = (relPath: string): string => readFileSync(resolve(process.cwd(), relPath), 'utf-8');

const filtersPage = () => readSrc('src/pages/products/FiltersPage.tsx');
const catalogState = () => readSrc('src/hooks/products/useCatalogState.ts');
const quickView = () => readSrc('src/components/products/ProductQuickView.tsx');

/** Remove linhas de comentario (// e blocos *) para asserts somente sobre codigo. */
const stripLineComments = (src: string): string =>
  src
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    })
    .join('\n');

// ============================================================
// BUG-G7: composicao Tooltip/Select (PR #689)
// ============================================================

describe('BUG-G7 — TooltipTrigger asChild nao envolve Radix composto', () => {
  it('nenhum bloco TooltipTrigger asChild contem <Select>', () => {
    const blocks =
      filtersPage().match(/<TooltipTrigger asChild>([\s\S]*?)<\/TooltipTrigger>/g) ?? [];
    expect(blocks.length).toBeGreaterThan(0);
    for (const b of blocks) {
      expect(b).not.toContain('<Select ');
    }
  });

  it('ordem correta dentro do Select: Tooltip -> span wrapper -> SelectTrigger; SelectContent fora do Tooltip', () => {
    const src = filtersPage();
    const sel = src.indexOf('<Select ');
    expect(sel).toBeGreaterThan(-1);

    const tooltipOpen = src.indexOf('<Tooltip>', sel);
    const spanWrapper = src.indexOf('className="relative inline-flex"', sel);
    const selectTrigger = src.indexOf('<SelectTrigger', sel);
    const tooltipClose = src.indexOf('</Tooltip>', sel);
    const selectContent = src.indexOf('<SelectContent>', sel);

    expect(tooltipOpen).toBeGreaterThan(-1);
    expect(tooltipOpen).toBeLessThan(spanWrapper);
    expect(spanWrapper).toBeLessThan(selectTrigger);
    expect(tooltipClose).toBeLessThan(selectContent);
  });

  it('DEFAULT_SORT_VALUE deriva do SSOT (SORT_OPTIONS[0])', () => {
    expect(filtersPage()).toContain('const DEFAULT_SORT_VALUE = SORT_OPTIONS[0].value');
  });
});

// ============================================================
// GAP-1: tooltip labels para sorts internos (PR #690)
// ============================================================

describe('GAP-1 — tooltip nao mascara sorts internos', () => {
  it('INTERNAL_SORT_LABELS contem os 4 valores internos com labels corretos', () => {
    const src = filtersPage();
    expect(src).toContain("'color-match': 'Relevância de cor'");
    expect(src).toContain("popularity: 'Popularidade'");
    expect(src).toContain("'name-asc': 'Nome (A-Z)'");
    expect(src).toContain("'name-desc': 'Nome (Z-A)'");
  });

  it('cadeia de fallback termina em rotulo generico (nunca em label especifico)', () => {
    expect(filtersPage()).toMatch(
      /\?\.label \?\?\s*INTERNAL_SORT_LABELS\[state\.sortBy\] \?\?\s*'Ordenação personalizada'/,
    );
  });
});

// ============================================================
// GAP-2: snapshot useRef anti flash-empty-state (PR #690 + review v2)
// ============================================================

describe('GAP-2 — snapshot de produtos durante transicao de sort', () => {
  it('snapshot e useRef (nao useState — evita render extra por atualizacao)', () => {
    const src = catalogState();
    expect(src).toContain('const lastNonTransitionedProductsRef = useRef<Product[]>([])');
    expect(src).not.toContain('setLastNonTransitionedProducts');
  });

  it('ref e escrito em effect APENAS fora de transicao (concurrent-safe)', () => {
    expect(catalogState()).toMatch(
      /if \(!isTransitioning\) \{\s*lastNonTransitionedProductsRef\.current = filteredProducts;/,
    );
  });

  it('display le o ref congelado durante isTransitioning', () => {
    expect(catalogState()).toMatch(
      /displayFilteredProducts = isTransitioning\s*\?\s*lastNonTransitionedProductsRef\.current\s*:\s*filteredProducts/,
    );
  });
});

// ============================================================
// GAP-3/4: badge de estoque le campos reais (PR #690)
// ============================================================

describe('GAP-3/4 — badge de unidades em estoque', () => {
  it('le product.stock do catalog type (nao camelCase stockQuantity)', () => {
    // Componente usa product.stock (campo do catalog type) — nao acessa
    // diretamente stock_quantity do DB nem usa camelCase stockQuantity.
    expect(quickView()).toContain('product.stock');
  });

  it('product.stockQuantity (camelCase morto) nao existe em CODIGO (apenas comentario permitido)', () => {
    expect(stripLineComments(quickView())).not.toContain('product.stockQuantity');
  });

  it('normaliza para number|null na origem via typeof (string/NaN-safe)', () => {
    expect(quickView()).toContain("typeof product.stock === 'number' ? product.stock : null");
  });

  it('JSX renderiza o badge a partir do stockQty normalizado', () => {
    const src = quickView();
    expect(src).toContain('stockQty !== null && stockQty > 0');
    expect(src).toContain('({stockQty} un.)');
  });
});

// ============================================================
// SORT-VAL: validateSortOption (fix P0 + SORT_ALIASES)
// ============================================================

describe('SORT-VAL — validateSortOption normaliza e protege o state', () => {
  it('valores canonicos passam inalterados', () => {
    const canonicos = [
      'name',
      'price-asc',
      'price-desc',
      'stock',
      'newest',
      'best-seller-supplier',
      'best-seller-promo',
    ] as const;
    for (const v of canonicos) {
      expect(validateSortOption(v)).toBe(v);
    }
  });

  it('aliases conhecidos sao normalizados para o canonico', () => {
    expect(validateSortOption('popularity')).toBe('best-seller-promo');
    expect(validateSortOption('relevance')).toBe('name');
  });

  it('nulos e vazios caem no default seguro (newest)', () => {
    expect(validateSortOption(null)).toBe('newest');
    expect(validateSortOption(undefined)).toBe('newest');
    expect(validateSortOption('')).toBe('newest');
  });

  it('valores invalidos/maliciosos caem no default seguro', () => {
    const invalidos = [
      'PRICE-ASC',
      'price asc',
      'name-asc-extra',
      '<script>alert(1)</script>',
      '../../etc/passwd',
      'a'.repeat(500),
      'ção-inválida',
    ];
    for (const v of invalidos) {
      expect(validateSortOption(v)).toBe('newest');
    }
  });

  it('BUG-SORT-12 — chaves de Object.prototype NUNCA vazam (prototype pollution)', () => {
    // O operador `in` percorre a cadeia de prototipos; `?sort=toString` resolvia
    // para Object.prototype.toString (uma funcao). validateSortOption deve usar
    // hasOwnProperty.call e devolver SEMPRE uma string canonica.
    const protoKeys = [
      'toString',
      'constructor',
      'hasOwnProperty',
      'valueOf',
      '__proto__',
      'isPrototypeOf',
      'propertyIsEnumerable',
      'toLocaleString',
    ];
    for (const k of protoKeys) {
      const r = validateSortOption(k);
      expect(typeof r).toBe('string');
      expect(r).toBe('newest');
    }
  });

  it('fuzz: 200 strings aleatorias nunca produzem valor fora do dominio SortOption', () => {
    const dominio = new Set([
      'name',
      'price-asc',
      'price-desc',
      'stock',
      'newest',
      'color-match',
      'best-seller-supplier',
      'best-seller-promo',
    ]);
    for (let i = 0; i < 200; i++) {
      const rand = Math.random()
        .toString(36)
        .slice(2, 2 + (i % 14) + 1);
      const r = validateSortOption(rand);
      expect(typeof r).toBe('string');
      expect(dominio.has(r)).toBe(true);
    }
  });
});

describe('SORT-SESSION — ranking do catálogo não alterna após seleção', () => {
  it('SORT_OPTIONS inicia em newest, preservando o default global Mais Recentes', () => {
    expect(readSrc('src/constants/filters.ts')).toMatch(
      /export const SORT_OPTIONS = \[\s*\{ value: 'newest', label: 'Mais Recentes' \}/,
    );
  });

  it('useCatalogState consulta o catálogo com sortBy no queryKey/fetch servidor', () => {
    expect(catalogState()).toMatch(
      /useProductsCatalog\(\{\s*search: debouncedServerSearch,\s*categories: filters\.categories,\s*suppliers: filters\.suppliers,\s*sortBy,/,
    );
  });

  it('preferências persistidas fora da sessão não sobrescrevem o ranking escolhido na sessão', () => {
    const src = catalogState();
    expect(src).toContain("const SORT_SESSION_KEY = 'catalog:sortBy'");
    expect(src).toContain('validateSortOption(getSessionSortPreference())');
    expect(src).not.toContain('prefsLoaded');
    expect(src).not.toContain('preferences.sortBy');
  });

  it('bloqueia URL stale de sobrescrever a escolha local enquanto a navegação sincroniza', () => {
    const src = catalogState();
    expect(src).toContain('const pendingLocalSortRef = useRef<SortOption | null>(null)');
    expect(src).toContain('pendingLocalSortRef.current = validated');
    expect(src).toContain('if (!urlMatchesPendingSort) return');
    expect(src).toContain('pendingLocalSortRef.current = null');
  });
});
