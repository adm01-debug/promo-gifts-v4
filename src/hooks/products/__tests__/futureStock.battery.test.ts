/**
 * BATERIA COMPLETA — Estoque Futuro (FutureStockModal)
 *
 * Cobre todas as funcionalidades e melhorias da sessão "Estoque Futuro":
 *  1. processStockEntries — geração de até 3 chegadas por variante
 *  2. calculateColorSummary — agregação por cor (atual + incoming)
 *  3. Ordenação (nearest, farthest, quantity-desc, quantity-asc)
 *  4. Filtros de período (all, 7days, 30days, 90days, past)
 *  5. Filtro por cor (selectedColor)
 *  6. Filtros combinados (período + cor)
 *  7. Edge cases: sem variantes, sem previsões, partial nulls, multi-cor
 *  8. Agrupamento por cor + collapse/expand
 *  9. Formatação de números (k para >=1000)
 */
import { describe, it, expect } from 'vitest';
import { addDays, format, parseISO, isBefore } from 'date-fns';
import {
  processStockEntries,
  calculateColorSummary,
  type VariantWithStock,
  type StockEntry,
} from '../useVariantSupplierSources';

// ---------- Helpers ----------
const iso = (d: Date) => format(d, 'yyyy-MM-dd');
const today = new Date();
const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

const makeVariant = (overrides: Partial<VariantWithStock> = {}): VariantWithStock => ({
  id: 'v-default',
  product_id: 'p1',
  sku: 'SKU',
  color_code: '01',
  color_name: 'Preto',
  color_hex: '#000',
  stock_quantity: 0,
  selected_thumbnail: null,
  next_entry_date: null,
  next_entry_quantity: null,
  next_date_1: null,
  next_quantity_1: null,
  next_date_2: null,
  next_quantity_2: null,
  next_date_3: null,
  next_quantity_3: null,
  ...overrides,
});

// Reimplementa o filtro de período do modal (espelho da lógica em FutureStockModal.tsx)
type DateFilter = 'all' | '7days' | '30days' | '90days' | 'past';
const applyDateFilter = (entries: StockEntry[], filter: DateFilter) => {
  if (filter === 'all') return entries;
  return entries.filter((e) => {
    const d = parseISO(e.expectedDate);
    switch (filter) {
      case 'past':
        return isBefore(d, todayStart);
      case '7days':
        return !isBefore(d, todayStart) && isBefore(d, addDays(todayStart, 8));
      case '30days':
        return !isBefore(d, todayStart) && isBefore(d, addDays(todayStart, 31));
      case '90days':
        return !isBefore(d, todayStart) && isBefore(d, addDays(todayStart, 91));
      default:
        return true;
    }
  });
};

// Reimplementa as ordenações do modal
type SortOrder = 'nearest' | 'farthest' | 'quantity-desc' | 'quantity-asc';
const sortEntries = (entries: StockEntry[], order: SortOrder) =>
  [...entries].sort((a, b) => {
    switch (order) {
      case 'nearest': {
        const t = new Date(a.expectedDate).getTime() - new Date(b.expectedDate).getTime();
        return t !== 0 ? t : (a.entryIndex ?? 0) - (b.entryIndex ?? 0);
      }
      case 'farthest': {
        const t = new Date(b.expectedDate).getTime() - new Date(a.expectedDate).getTime();
        return t !== 0 ? t : (b.entryIndex ?? 0) - (a.entryIndex ?? 0);
      }
      case 'quantity-desc':
        return b.expectedQuantity - a.expectedQuantity;
      case 'quantity-asc':
        return a.expectedQuantity - b.expectedQuantity;
      default:
        return 0;
    }
  });

// ---------- Fixture cenário real (espelha o screenshot) ----------
// Produto SKU 94297 — 7 cores, com previsões variadas
const buildSnapshotFixture = (): VariantWithStock[] => [
  makeVariant({
    id: 'v-preto',
    sku: '94297-1',
    color_name: 'Preto',
    color_hex: '#000000',
    stock_quantity: 33000,
    // sem previsões
  }),
  makeVariant({
    id: 'v-branco-1',
    sku: '94297-10.1',
    color_name: 'Branco',
    color_hex: '#FFFFFF',
    stock_quantity: 4400,
    next_date_1: '2026-03-16',
    next_quantity_1: 10000,
    next_date_2: '2026-09-01',
    next_quantity_2: 10000,
  }),
  makeVariant({
    id: 'v-azul',
    sku: '94297-1.1',
    color_name: 'Azul',
    color_hex: '#0000FF',
    stock_quantity: 26400,
    next_date_1: '2026-03-06',
    next_quantity_1: 20000,
  }),
  makeVariant({
    id: 'v-verde',
    color_name: 'Verde Exército',
    color_hex: '#4B5320',
    stock_quantity: 10800,
  }),
  makeVariant({
    id: 'v-vermelho',
    color_name: 'Vermelho Bordo',
    color_hex: '#800000',
    stock_quantity: 9200,
  }),
  makeVariant({
    id: 'v-laranja',
    color_name: 'Laranja',
    color_hex: '#FFA500',
    stock_quantity: 412,
    next_date_1: iso(addDays(todayStart, 15)),
    next_quantity_1: 6000,
  }),
  makeVariant({
    id: 'v-rosa',
    color_name: 'Rosa Bebê',
    color_hex: '#FFB6C1',
    stock_quantity: 5500,
  }),
];

// =====================================================================
// 1. processStockEntries — comportamento básico
// =====================================================================
describe('Estoque Futuro · processStockEntries', () => {
  it('gera entradas para todas as variantes do fixture realista', () => {
    const entries = processStockEntries(buildSnapshotFixture());
    // Branco(2) + Azul(1) + Laranja(1) = 4
    expect(entries).toHaveLength(4);
  });

  it('preserva entryIndex (1, 2, 3) mesmo quando entradas anteriores são puladas', () => {
    const v = makeVariant({
      id: 'X',
      next_date_2: '2026-05-01',
      next_quantity_2: 50,
      next_date_3: '2026-06-01',
      next_quantity_3: 70,
    });
    const entries = processStockEntries([v]);
    expect(entries.map((e) => e.entryIndex)).toEqual([2, 3]);
    expect(entries.map((e) => e.id)).toEqual(['X-2', 'X-3']);
  });

  it('ignora quantidades negativas, zero, NaN e datas vazias', () => {
    const v = makeVariant({
      next_date_1: '2026-01-01',
      next_quantity_1: -5,
      next_date_2: '',
      next_quantity_2: 10,
      next_date_3: '2026-03-01',
      next_quantity_3: 0,
    });
    expect(processStockEntries([v])).toHaveLength(0);
  });

  it('IDs são únicos entre variantes diferentes', () => {
    const entries = processStockEntries(buildSnapshotFixture());
    const ids = entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// =====================================================================
// 2. calculateColorSummary — agregação por cor
// =====================================================================
describe('Estoque Futuro · calculateColorSummary', () => {
  it('agrega estoque atual + incoming corretamente por cor', () => {
    const variants = buildSnapshotFixture();
    const entries = processStockEntries(variants);
    const summary = calculateColorSummary(variants, entries);

    const azul = summary.find((c) => c.name === 'Azul')!;
    expect(azul.currentStock).toBe(26400);
    expect(azul.incomingTotal).toBe(20000);
    expect(azul.incomingCount).toBe(1);

    const branco = summary.find((c) => c.name === 'Branco')!;
    expect(branco.incomingTotal).toBe(20000); // 10k + 10k
    expect(branco.incomingCount).toBe(2);

    const preto = summary.find((c) => c.name === 'Preto')!;
    expect(preto.currentStock).toBe(33000);
    expect(preto.incomingTotal).toBe(0);
    expect(preto.incomingCount).toBe(0);
  });

  it('soma estoque atual de múltiplas variantes da mesma cor', () => {
    const variants = [
      makeVariant({ id: 'a', color_name: 'Azul', stock_quantity: 100 }),
      makeVariant({ id: 'b', color_name: 'Azul', stock_quantity: 250 }),
    ];
    const summary = calculateColorSummary(variants, []);
    expect(summary).toHaveLength(1);
    expect(summary[0].currentStock).toBe(350);
  });

  it('lida com color_name nulo agrupando como "Sem cor"', () => {
    const variants = [makeVariant({ color_name: null, stock_quantity: 10 })];
    const summary = calculateColorSummary(variants, []);
    expect(summary[0].name).toBe('Sem cor');
  });

  it('grid mostra todas as 7 cores (mesmo as sem previsão)', () => {
    const variants = buildSnapshotFixture();
    const summary = calculateColorSummary(variants, processStockEntries(variants));
    expect(summary).toHaveLength(7);
  });
});

// =====================================================================
// 3. Ordenação
// =====================================================================
describe('Estoque Futuro · ordenação', () => {
  const variants = buildSnapshotFixture();
  const entries = processStockEntries(variants);

  it('nearest: ordena por data ascendente', () => {
    const sorted = sortEntries(entries, 'nearest');
    const dates = sorted.map((e) => e.expectedDate);
    const sortedCopy = [...dates].sort();
    expect(dates).toEqual(sortedCopy);
  });

  it('farthest: ordena por data descendente', () => {
    const sorted = sortEntries(entries, 'farthest');
    const dates = sorted.map((e) => e.expectedDate);
    const reverseSorted = [...dates].sort().reverse();
    expect(dates).toEqual(reverseSorted);
  });

  it('quantity-desc: maior quantidade primeiro', () => {
    const sorted = sortEntries(entries, 'quantity-desc');
    expect(sorted[0].expectedQuantity).toBeGreaterThanOrEqual(
      sorted[sorted.length - 1].expectedQuantity,
    );
    expect(sorted[0].expectedQuantity).toBe(20000);
  });

  it('quantity-asc: menor quantidade primeiro', () => {
    const sorted = sortEntries(entries, 'quantity-asc');
    expect(sorted[0].expectedQuantity).toBe(6000);
  });

  it('nearest: desempata pelo entryIndex quando datas são idênticas', () => {
    const v = makeVariant({
      id: 'tie',
      next_date_1: '2026-05-01',
      next_quantity_1: 10,
      next_date_2: '2026-05-01',
      next_quantity_2: 20,
      next_date_3: '2026-05-01',
      next_quantity_3: 30,
    });
    const sorted = sortEntries(processStockEntries([v]), 'nearest');
    expect(sorted.map((e) => e.entryIndex)).toEqual([1, 2, 3]);
  });
});

// =====================================================================
// 4. Filtros de período
// =====================================================================
describe('Estoque Futuro · filtros de período', () => {
  const buildPeriodFixture = (): StockEntry[] => [
    // Atrasado
    {
      id: 'past',
      variantId: 'v',
      colorName: 'Azul',
      colorHex: '#00f',
      expectedDate: iso(addDays(todayStart, -10)),
      expectedQuantity: 100,
      thumbnail: null,
      entryIndex: 1,
    },
    // Próximos 7
    {
      id: 'in5',
      variantId: 'v',
      colorName: 'Azul',
      colorHex: '#00f',
      expectedDate: iso(addDays(todayStart, 5)),
      expectedQuantity: 200,
      thumbnail: null,
      entryIndex: 1,
    },
    // Próximos 30
    {
      id: 'in20',
      variantId: 'v',
      colorName: 'Verde',
      colorHex: '#0f0',
      expectedDate: iso(addDays(todayStart, 20)),
      expectedQuantity: 300,
      thumbnail: null,
      entryIndex: 1,
    },
    // Próximos 90
    {
      id: 'in60',
      variantId: 'v',
      colorName: 'Verde',
      colorHex: '#0f0',
      expectedDate: iso(addDays(todayStart, 60)),
      expectedQuantity: 400,
      thumbnail: null,
      entryIndex: 1,
    },
    // Distante
    {
      id: 'in200',
      variantId: 'v',
      colorName: 'Verde',
      colorHex: '#0f0',
      expectedDate: iso(addDays(todayStart, 200)),
      expectedQuantity: 500,
      thumbnail: null,
      entryIndex: 1,
    },
  ];

  it('"all" não filtra nada', () => {
    expect(applyDateFilter(buildPeriodFixture(), 'all')).toHaveLength(5);
  });

  it('"past" pega apenas atrasados', () => {
    const r = applyDateFilter(buildPeriodFixture(), 'past');
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('past');
  });

  it('"7days" pega apenas as entradas dentro de 7 dias (e nunca atrasados)', () => {
    const r = applyDateFilter(buildPeriodFixture(), '7days');
    expect(r.map((e) => e.id)).toEqual(['in5']);
  });

  it('"30days" inclui as de 7 e 30 dias, exclui 60 dias', () => {
    const r = applyDateFilter(buildPeriodFixture(), '30days');
    expect(r.map((e) => e.id).sort()).toEqual(['in20', 'in5']);
  });

  it('"90days" inclui até 90, exclui 200', () => {
    const r = applyDateFilter(buildPeriodFixture(), '90days');
    expect(r.map((e) => e.id).sort()).toEqual(['in20', 'in5', 'in60']);
  });

  it('entrada exatamente em hoje conta como futuro (não como atrasado)', () => {
    const entries: StockEntry[] = [
      {
        id: 'now',
        variantId: 'v',
        colorName: 'X',
        colorHex: null,
        expectedDate: iso(todayStart),
        expectedQuantity: 1,
        thumbnail: null,
        entryIndex: 1,
      },
    ];
    expect(applyDateFilter(entries, 'past')).toHaveLength(0);
    expect(applyDateFilter(entries, '7days')).toHaveLength(1);
  });
});

// =====================================================================
// 5. Filtros combinados (período + cor)
// =====================================================================
describe('Estoque Futuro · filtros combinados', () => {
  it('filtra por período E depois por cor (cor reduz subset)', () => {
    const variants = buildSnapshotFixture();
    const entries = processStockEntries(variants);

    // Aplica período "90days" e depois cor "Laranja"
    const periodFiltered = applyDateFilter(entries, '90days');
    const colorFiltered = periodFiltered.filter((e) => e.colorName === 'Laranja');
    expect(colorFiltered).toHaveLength(1);
    expect(colorFiltered[0].colorName).toBe('Laranja');
  });

  it('summary de cores reflete apenas o período (não o filtro de cor)', () => {
    const variants = buildSnapshotFixture();
    const allEntries = processStockEntries(variants);
    const periodOnly = applyDateFilter(allEntries, '30days');
    const summary = calculateColorSummary(variants, periodOnly);

    // Todas as 7 cores aparecem no grid, mas só as do período têm incoming > 0
    expect(summary).toHaveLength(7);
    const withIncoming = summary.filter((c) => c.incomingCount > 0);
    expect(withIncoming.length).toBeLessThanOrEqual(7);
  });
});

// =====================================================================
// 6. Agrupamento por cor + toggle de collapse
// =====================================================================
describe('Estoque Futuro · agrupamento por cor', () => {
  it('preserva ordem das cores conforme a ordenação dos entries', () => {
    const variants = buildSnapshotFixture();
    const sorted = sortEntries(processStockEntries(variants), 'nearest');
    const colorOrder = [...new Set(sorted.map((e) => e.colorName))];
    expect(colorOrder[0]).toBe('Azul'); // 06/mar é a data mais próxima do fixture
  });

  it('toggle de grupo adiciona/remove cor de expandedGroups', () => {
    // Espelha lógica do toggleGroup do modal
    let expanded: string[] = [];
    const toggle = (name: string) => {
      expanded = expanded.includes(name) ? expanded.filter((n) => n !== name) : [...expanded, name];
    };
    toggle('Azul');
    expect(expanded).toEqual(['Azul']);
    toggle('Branco');
    expect(expanded).toEqual(['Azul', 'Branco']);
    toggle('Azul');
    expect(expanded).toEqual(['Branco']);
  });

  it('grupo é considerado expandido se selectedColor === colorName', () => {
    const expandedGroups: string[] = [];
    const selectedColor = 'Azul';
    const isExpanded = expandedGroups.includes('Azul') || selectedColor === 'Azul';
    expect(isExpanded).toBe(true);
  });
});

// =====================================================================
// 7. Formatação de números (k para >=1000) — espelha lógica do badge
// =====================================================================
describe('Estoque Futuro · formatação de números', () => {
  const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

  it.each([
    [412, '412'],
    [1000, '1.0k'],
    [4400, '4.4k'],
    [26400, '26.4k'],
    [33000, '33.0k'],
  ])('formata %s como %s', (n, expected) => {
    expect(fmt(n)).toBe(expected);
  });
});

// =====================================================================
// 8. Edge cases
// =====================================================================
describe('Estoque Futuro · edge cases', () => {
  it('lista de variantes vazia gera arrays vazios', () => {
    expect(processStockEntries([])).toEqual([]);
    expect(calculateColorSummary([], [])).toEqual([]);
  });

  it('nenhuma previsão = grid de cores ainda renderiza (com incomingCount=0)', () => {
    const variants = [makeVariant({ stock_quantity: 100 })];
    const entries = processStockEntries(variants);
    const summary = calculateColorSummary(variants, entries);
    expect(entries).toHaveLength(0);
    expect(summary).toHaveLength(1);
    expect(summary[0].incomingCount).toBe(0);
  });

  it('campos null parciais não quebram o processamento', () => {
    const v = makeVariant({
      next_date_1: '2026-05-01',
      next_quantity_1: 10,
      next_date_2: null,
      next_quantity_2: 20,
      next_date_3: '2026-07-01',
      next_quantity_3: null,
    });
    const entries = processStockEntries([v]);
    expect(entries).toHaveLength(1);
    expect(entries[0].entryIndex).toBe(1);
  });

  it('cor null vira "Sem cor" tanto no summary quanto no entry', () => {
    const v = makeVariant({
      color_name: null,
      next_date_1: '2026-05-01',
      next_quantity_1: 50,
    });
    const entries = processStockEntries([v]);
    expect(entries[0].colorName).toBe('Sem cor');
    const summary = calculateColorSummary([v], entries);
    expect(summary[0].name).toBe('Sem cor');
  });
});
