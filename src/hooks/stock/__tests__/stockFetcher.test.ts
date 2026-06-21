/**
 * Behavioural tests for stockFetcher (toNumber, fetchPaginatedFromBridge,
 * fetchAndProcessStockData).
 *
 * Strategy: `@/lib/supabase-untyped` is mocked with a chainable, thenable
 * query builder whose resolved value is pulled from a per-table queue. This
 * lets us drive the pagination loop page-by-page and assert which filter
 * methods (is/in/eq) were applied.
 *
 * Run: TZ=America/Sao_Paulo npx vitest run src/hooks/stock/__tests__/stockFetcher.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── chainable, thenable supabase-untyped mock ───────────────────────────────
type QueryResult = { data: unknown; error: unknown; count?: number | null };
type Call = { table: string; method: string; args: unknown[] };

const calls: Call[] = [];
// Per-resolvedTable FIFO queue of results, one per `await query`.
const resultQueues: Record<string, QueryResult[]> = {};
// Fallback when a table's queue is exhausted / unset.
const defaultResult: QueryResult = { data: [], error: null, count: 0 };

function nextResult(table: string): QueryResult {
  const q = resultQueues[table];
  if (q && q.length > 0) return q.shift() as QueryResult;
  return defaultResult;
}

vi.mock('@/lib/supabase-untyped', () => {
  const makeBuilder = (table: string) => {
    const q: Record<string, unknown> = {};
    const chain = (method: string) =>
      vi.fn((...args: unknown[]) => {
        calls.push({ table, method, args });
        return q;
      });
    for (const m of [
      'select',
      'is',
      'in',
      'eq',
      'range',
      'order',
      'limit',
      'gt',
      'lt',
      'gte',
      'lte',
      'neq',
      'not',
    ]) {
      q[m] = chain(m);
    }
    (q as { then?: unknown }).then = (
      resolve: (v: unknown) => unknown,
      reject: (e: unknown) => unknown,
    ) => Promise.resolve(nextResult(table)).then(resolve, reject);
    return q;
  };
  return {
    untypedFrom: vi.fn((t: string) => makeBuilder(t)),
  };
});

// Mock logger (avoid import.meta.env.DEV noise + assert call counts cheaply).
vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Mock the dynamic import used in the 410/Gone branch.
const reportSilentEmpty = vi.fn();
vi.mock('@/lib/external-db/silent-empty-report', () => ({
  reportSilentEmpty: (...args: unknown[]) => reportSilentEmpty(...args),
}));

import {
  toNumber,
  fetchPaginatedFromBridge,
  fetchAndProcessStockData,
  nextStockPairs,
  buildFutureEntries,
  type ExternalSupplierSource,
} from '@/hooks/stock/stockFetcher';
import { logger } from '@/lib/logger';

const queue = (table: string, ...results: QueryResult[]) => {
  resultQueues[table] = results;
};

beforeEach(() => {
  calls.length = 0;
  for (const k of Object.keys(resultQueues)) delete resultQueues[k];
  reportSilentEmpty.mockClear();
  (logger.log as ReturnType<typeof vi.fn>).mockClear();
  (logger.warn as ReturnType<typeof vi.fn>).mockClear();
  (logger.error as ReturnType<typeof vi.fn>).mockClear();
});

// ─── toNumber ────────────────────────────────────────────────────────────────
describe('toNumber', () => {
  it('returns numbers as-is', () => {
    expect(toNumber(42)).toBe(42);
    expect(toNumber(0)).toBe(0);
    expect(toNumber(-3.5)).toBe(-3.5);
  });

  it('coerces numeric strings', () => {
    expect(toNumber('15')).toBe(15);
    expect(toNumber('2.5')).toBe(2.5);
  });

  it('returns the fallback for non-finite / non-numeric values', () => {
    expect(toNumber('abc')).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber(NaN)).toBe(0);
    expect(toNumber(Infinity)).toBe(0);
  });

  it('honours a custom fallback for un-coercible values', () => {
    expect(toNumber('nope', 99)).toBe(99);
    expect(toNumber(undefined, 7)).toBe(7);
  });

  it('coerces null/empty-string to 0 (Number() yields a finite 0, not the fallback)', () => {
    // Number(null) === 0 and Number('') === 0, both finite -> returns 0, never the fallback.
    expect(toNumber(null, 5)).toBe(0);
    expect(toNumber('', 5)).toBe(0);
  });
});

// ─── fetchPaginatedFromBridge ────────────────────────────────────────────────
describe('fetchPaginatedFromBridge', () => {
  it('resolves table aliases for Gold views (products -> v_products_public)', async () => {
    queue('v_products_public', { data: [{ id: 'p1' }], error: null, count: 1 });
    const rows = await fetchPaginatedFromBridge('products', 'id', 1000, 100000);
    expect(rows).toEqual([{ id: 'p1' }]);
    // calls were captured against the resolved table name
    expect(calls.every((c) => c.table === 'v_products_public')).toBe(true);
  });

  it('passes count: exact on the first page only', async () => {
    queue('categories', { data: [{ id: 'c1' }], error: null, count: 1 });
    await fetchPaginatedFromBridge('categories', 'id,name');
    const select = calls.find((c) => c.method === 'select');
    expect(select!.args[1]).toEqual({ count: 'exact' });
  });

  it('stops after a single page when count is satisfied', async () => {
    queue('categories', { data: [{ id: 'c1' }, { id: 'c2' }], error: null, count: 2 });
    const rows = await fetchPaginatedFromBridge('categories', 'id', 1000);
    expect(rows).toHaveLength(2);
    // only one select issued (loop broke on offset >= totalCount)
    expect(calls.filter((c) => c.method === 'select')).toHaveLength(1);
  });

  it('loops across multiple pages until count is reached', async () => {
    const page1 = Array.from({ length: 2 }, (_, i) => ({ id: `a${i}` }));
    const page2 = Array.from({ length: 2 }, (_, i) => ({ id: `b${i}` }));
    queue(
      'categories',
      { data: page1, error: null, count: 4 },
      { data: page2, error: null, count: 4 },
    );
    const rows = await fetchPaginatedFromBridge('categories', 'id', 2);
    expect(rows.map((r) => r.id)).toEqual(['a0', 'a1', 'b0', 'b1']);
    // Early-break optimization: when totalCount is known and all records are fetched,
    // no extra round-trip is issued to confirm empty page.
    expect(calls.filter((c) => c.method === 'select')).toHaveLength(2);
  });

  it('breaks early on an empty page', async () => {
    queue('categories', { data: [], error: null, count: 0 });
    const rows = await fetchPaginatedFromBridge('categories', 'id');
    expect(rows).toEqual([]);
  });

  it('breaks when count is unknown and a short page (< pageSize) is returned', async () => {
    // count omitted (null) -> relies on records.length < pageSize to stop
    queue('categories', { data: [{ id: 'x1' }], error: null, count: null });
    const rows = await fetchPaginatedFromBridge('categories', 'id', 10);
    expect(rows).toHaveLength(1);
    expect(calls.filter((c) => c.method === 'select')).toHaveLength(1);
  });

  it('guards against a non-advancing cursor (same last id) and stops', async () => {
    // Keyset guard: if nextCursor (last id of the page) equals lastId (previous cursor) → break.
    // This simulates a case where the DB returns the same last row repeatedly.
    queue(
      'categories',
      { data: [{ id: 'x1' }, { id: 'stuck' }], error: null, count: 999 },
      { data: [{ id: 'x2' }, { id: 'stuck' }], error: null, count: 999 },
    );
    const rows = await fetchPaginatedFromBridge('categories', 'id', 2);
    // Page 1 accepted; page 2's last id === lastId ('stuck') → cursor didn't advance → break.
    expect(rows.map((r) => r.id)).toEqual(['x1', 'stuck', 'x2']);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('handles a 410 Gone error by reporting silent-empty and stopping', async () => {
    queue('categories', { data: null, error: { message: 'HTTP 410 Gone — bridge deprecated' } });
    const rows = await fetchPaginatedFromBridge('categories', 'id');
    expect(rows).toEqual([]);
    expect(reportSilentEmpty).toHaveBeenCalledTimes(1);
    expect(reportSilentEmpty).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'gone_410', table: 'categories', operation: 'select' }),
    );
    expect(logger.warn).toHaveBeenCalled();
  });

  it('handles a "Gone" message (no 410) the same way', async () => {
    queue('categories', { data: null, error: { message: 'resource is Gone' } });
    const rows = await fetchPaginatedFromBridge('categories', 'id');
    expect(rows).toEqual([]);
    expect(reportSilentEmpty).toHaveBeenCalledTimes(1);
  });

  it('throws on a generic (non-410) error', async () => {
    queue('categories', { data: null, error: { message: 'boom' } });
    await expect(fetchPaginatedFromBridge('categories', 'id')).rejects.toThrow(
      /Erro ao buscar categories: boom/,
    );
    expect(logger.error).toHaveBeenCalled();
  });

  it('applies filters: null -> is, array -> in, scalar -> eq', async () => {
    queue('categories', { data: [{ id: 'c1' }], error: null, count: 1 });
    await fetchPaginatedFromBridge('categories', 'id', 1000, 100000, {
      deleted_at: null,
      ids: ['a', 'b'],
      active: true,
    });
    const isCall = calls.find((c) => c.method === 'is');
    const inCall = calls.find((c) => c.method === 'in');
    const eqCall = calls.find((c) => c.method === 'eq');
    expect(isCall!.args).toEqual(['deleted_at', null]);
    expect(inCall!.args).toEqual(['ids', ['a', 'b']]);
    expect(eqCall!.args).toEqual(['active', true]);
  });

  it('uses keyset pagination: order by id + limit (not range)', async () => {
    // Keyset pagination replaced offset-based .range() — verify .order() and .limit() are called.
    queue('categories', { data: [{ id: 'c1' }], error: null, count: 1 });
    await fetchPaginatedFromBridge('categories', 'id', 500);
    const orderCall = calls.find((c) => c.method === 'order');
    const limitCall = calls.find((c) => c.method === 'limit');
    expect(orderCall?.args).toEqual(['id', { ascending: true }]);
    expect(limitCall?.args).toEqual([500]);
    // range() must NOT be called (keyset replaced it — BUG-STOCK-04 FIX)
    expect(calls.find((c) => c.method === 'range')).toBeUndefined();
  });

  it('410 mid-pagination: returns page-1 data and does not throw', async () => {
    // Simulates server-side cursor invalidation: page 1 succeeds, page 2 returns 410.
    // The function must stop cleanly and return the partial data already accumulated.
    queue(
      'categories',
      { data: [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }], error: null, count: 999 },
      { data: null, error: { message: 'HTTP 410 Gone — bridge deprecated' } },
    );
    const rows = await fetchPaginatedFromBridge('categories', 'id', 3);
    expect(rows.map((r) => r.id)).toEqual(['r1', 'r2', 'r3']);
    expect(reportSilentEmpty).toHaveBeenCalledTimes(1);
    expect(reportSilentEmpty).toHaveBeenCalledWith(expect.objectContaining({ reason: 'gone_410' }));
  });

  it('halts when the last record id is null (cursor cannot advance to next page)', async () => {
    // If a record arrives with id: null the cursor resolves to null, which triggers
    // the stuck-cursor guard (nextCursor === null → break + warn). This is distinct
    // from the "same-id-twice" case: here the very first page already breaks.
    queue('categories', { data: [{ id: 'x1' }, { id: null }], error: null, count: 999 });
    const rows = await fetchPaginatedFromBridge('categories', 'id', 2);
    // x1 is valid and retained; null-id record is discarded by the seen-set guard.
    expect(rows.map((r) => r.id)).toEqual(['x1']);
    expect(logger.warn).toHaveBeenCalled();
  });
});

// ─── fetchAndProcessStockData ────────────────────────────────────────────────
/**
 * Seeds every one of the 6 parallel fetches with one page each. The tables are
 * resolved through GOLD_READ_ALIASES so products -> v_products_public and
 * suppliers -> v_suppliers_public.
 */
function seedAll(opts: {
  products?: unknown[];
  variants?: unknown[];
  sources?: unknown[];
  categories?: unknown[];
  suppliers?: unknown[];
  images?: unknown[];
}) {
  const single = (data: unknown[]): QueryResult => ({ data, error: null, count: data.length });
  queue('v_products_public', single(opts.products ?? []));
  queue('product_variants', single(opts.variants ?? []));
  queue('variant_supplier_sources', single(opts.sources ?? []));
  queue('categories', single(opts.categories ?? []));
  queue('v_suppliers_public', single(opts.suppliers ?? []));
  queue('product_images', single(opts.images ?? []));
}

describe('fetchAndProcessStockData', () => {
  it('returns empty results when there are no products', async () => {
    seedAll({ products: [] });
    const res = await fetchAndProcessStockData();
    expect(res).toEqual({ productStocks: [], alerts: [], futureStock: [], degradedTables: [] });
  });

  it('builds a product summary from its variants + supplier source', async () => {
    seedAll({
      products: [
        {
          id: 'p1',
          name: 'Caneca',
          sku: 'CAN',
          min_quantity: 5,
          category_id: 'cat1',
          supplier_id: 'sup1',
        },
      ],
      variants: [
        {
          id: 'v1',
          product_id: 'p1',
          sku: 'CAN-AZ',
          color_name: 'Azul',
          color_code: 'AZ',
          stock_quantity: 8,
          is_active: true,
        },
      ],
      sources: [
        {
          id: 's1',
          variant_id: 'v1',
          quantity: 12,
          reserved_quantity: 2,
          is_active: true,
          updated_at: '2026-06-01',
        },
      ],
      categories: [{ id: 'cat1', name: 'Bebidas' }],
      suppliers: [{ id: 'sup1', name: 'Fornecedor X' }],
      images: [],
    });

    const res = await fetchAndProcessStockData();
    expect(res.productStocks).toHaveLength(1);
    const ps = res.productStocks[0];
    expect(ps.productName).toBe('Caneca');
    expect(ps.categoryName).toBe('Bebidas');
    expect(ps.supplierName).toBe('Fornecedor X');
    expect(ps.variants).toHaveLength(1);
    const v = ps.variants[0];
    // supplier source quantity (12) wins over variant stock_quantity (8)
    expect(v.currentStock).toBe(12);
    // Gold layer has no reserved_quantity column — reservedStock is always 0 (line ~422 in stockFetcher)
    expect(v.reservedStock).toBe(0);
    expect(v.availableStock).toBe(12); // 12 - 0
    expect(v.minStock).toBe(5);
    expect(v.colorName).toBe('Azul');
  });

  it('preserves an explicit min_quantity of 0 (nullish coalescing, not ||)', async () => {
    seedAll({
      products: [{ id: 'p1', name: 'P', sku: 'S', min_quantity: 0 }],
      variants: [{ id: 'v1', product_id: 'p1', stock_quantity: 3, is_active: true }],
    });
    const res = await fetchAndProcessStockData();
    expect(res.productStocks[0].variants[0].minStock).toBe(0);
  });

  it('defaults min_quantity to 10 when undefined', async () => {
    seedAll({
      products: [{ id: 'p1', name: 'P', sku: 'S' }],
      variants: [{ id: 'v1', product_id: 'p1', stock_quantity: 3, is_active: true }],
    });
    const res = await fetchAndProcessStockData();
    expect(res.productStocks[0].variants[0].minStock).toBe(10);
  });

  it('builds future stock entries from next_quantity/next_date slots 1..6 (q=0 skipped)', async () => {
    seedAll({
      products: [{ id: 'p1', name: 'Caneca', sku: 'CAN' }],
      variants: [
        { id: 'v1', product_id: 'p1', color_name: 'Azul', stock_quantity: 0, is_active: true },
      ],
      sources: [
        {
          id: 's1',
          variant_id: 'v1',
          quantity: 0,
          is_active: true,
          updated_at: '2026-06-01T00:00:00Z',
          next_quantity_1: 10,
          next_date_1: '2026-07-01',
          next_quantity_2: 0, // q=0 -> skipped despite having a date
          next_date_2: '2026-07-15',
          next_quantity_3: 5,
          next_date_3: null, // no date -> skipped
          next_quantity_4: 7,
          next_date_4: '2026-08-01',
          next_quantity_6: 3,
          next_date_6: '2026-09-01',
        },
      ],
    });

    const res = await fetchAndProcessStockData();
    // slots 1, 4, 6 qualify (q>0 AND date present) -> 3 entries
    expect(res.futureStock).toHaveLength(3);
    const ids = res.futureStock.map((e) => e.id).sort();
    expect(ids).toEqual(['s1-1', 's1-4', 's1-6']);

    const first = res.futureStock.find((e) => e.id === 's1-1')!;
    expect(first.expectedQuantity).toBe(10);
    expect(first.expectedDate).toBe('2026-07-01');
    expect(first.status).toBe('confirmed'); // slot 1 is confirmed
    expect(first.productName).toBe('Caneca');
    expect(first.colorName).toBe('Azul');

    const slot4 = res.futureStock.find((e) => e.id === 's1-4')!;
    expect(slot4.status).toBe('pending'); // slots 2..6 are pending

    // inTransitStock aggregates ALL positive next_quantity (incl. slot 3 w/o date)
    const v = res.productStocks[0].variants[0];
    expect(v.inTransitStock).toBe(10 + 5 + 7 + 3); // 25
    // futureSegments only counts positive-q WITH a date -> slots 1,4,6
    expect(v.futureSegments).toHaveLength(3);
    // currentStock 0 + inTransit > 0 -> status 'incoming'
    expect(v.status).toBe('incoming');
    expect(v.futureStockDate).toBe('2026-07-01'); // next_date_1
  });

  it('falls back to product-level stock when single variant sums to zero', async () => {
    seedAll({
      products: [{ id: 'p1', name: 'P', sku: 'S', stock_quantity: 20 }],
      variants: [{ id: 'v1', product_id: 'p1', stock_quantity: 0, is_active: true }],
    });
    const res = await fetchAndProcessStockData();
    const v = res.productStocks[0].variants[0];
    expect(v.currentStock).toBe(20); // patched from product-level stock
  });

  it('adds a synthetic "product total" variant when multiple variants sum to zero', async () => {
    seedAll({
      products: [{ id: 'p1', name: 'P', sku: 'S', stock_quantity: 30 }],
      variants: [
        { id: 'v1', product_id: 'p1', stock_quantity: 0, is_active: true },
        { id: 'v2', product_id: 'p1', stock_quantity: 0, is_active: true },
      ],
    });
    const res = await fetchAndProcessStockData();
    const synthetic = res.productStocks[0].variants.find((v) => v.id.endsWith('::product_total'));
    expect(synthetic).toBeDefined();
    expect(synthetic!.currentStock).toBe(30);
    expect(synthetic!.colorName).toBe('Total do Produto');
  });

  it('handles products with NO variants (synthesizes a default variant)', async () => {
    seedAll({
      products: [{ id: 'p1', name: 'P', sku: 'S', stock_quantity: 4 }],
      variants: [],
    });
    const res = await fetchAndProcessStockData();
    const v = res.productStocks[0].variants[0];
    expect(v.id).toBe('p1');
    expect(v.colorName).toBe('Padrão');
    expect(v.currentStock).toBe(4);
  });

  it('aggregates quantities from multiple active supplier sources for the same variant', async () => {
    seedAll({
      products: [{ id: 'p1', name: 'P', sku: 'S' }],
      variants: [{ id: 'v1', product_id: 'p1', stock_quantity: 0, is_active: true }],
      sources: [
        { id: 'sOld', variant_id: 'v1', quantity: 5, is_active: true, updated_at: '2026-01-01' },
        { id: 'sNew', variant_id: 'v1', quantity: 9, is_active: true, updated_at: '2026-06-01' },
      ],
    });
    const res = await fetchAndProcessStockData();
    // BUG-3 FIX: both sources are active → currentStock = 5 + 9 = 14
    expect(res.productStocks[0].variants[0].currentStock).toBe(14);
  });

  it('multi-source aggregation is order-independent (same sum regardless of input order)', async () => {
    seedAll({
      products: [{ id: 'p1', name: 'P', sku: 'S' }],
      variants: [{ id: 'v1', product_id: 'p1', stock_quantity: 0, is_active: true }],
      sources: [
        { id: 'sNew', variant_id: 'v1', quantity: 9, is_active: true, updated_at: '2026-06-01' },
        { id: 'sOld', variant_id: 'v1', quantity: 5, is_active: true, updated_at: '2026-01-01' },
      ],
    });
    const res = await fetchAndProcessStockData();
    // reversed order — sum must still be 9 + 5 = 14
    expect(res.productStocks[0].variants[0].currentStock).toBe(14);
  });

  it('falls back to supplier-code image when no variant image exists', async () => {
    seedAll({
      products: [{ id: 'p1', name: 'P', sku: 'S' }],
      variants: [
        { id: 'v1', product_id: 'p1', color_code: 'grn', stock_quantity: 1, is_active: true },
      ],
      images: [
        {
          id: 'i1',
          product_id: null,
          variant_id: null,
          supplier_code: 'GRN',
          url_cdn: 'https://img/grn.png',
          is_primary: false,
          is_og_image: true,
          image_type: 'front',
        },
      ],
    });
    const res = await fetchAndProcessStockData();
    expect(res.productStocks[0].variants[0].imageUrl).toBe('https://img/grn.png');
  });

  it('resolves variant/product/supplier-code images (og > primary), skipping image_type box', async () => {
    seedAll({
      products: [{ id: 'p1', name: 'P', sku: 'S', supplier_id: 'sup1' }],
      variants: [
        { id: 'v1', product_id: 'p1', color_code: 'RED', stock_quantity: 1, is_active: true },
      ],
      suppliers: [{ id: 'sup1', name: 'Sup' }],
      images: [
        {
          id: 'i1',
          product_id: 'p1',
          variant_id: null,
          supplier_code: null,
          url_cdn: 'https://img/box.png',
          is_primary: true,
          is_og_image: false,
          image_type: 'box',
        }, // skipped (box)
        {
          id: 'i2',
          product_id: 'p1',
          variant_id: 'v1',
          supplier_code: null,
          url_cdn: 'https://img/v1.png',
          is_primary: false,
          is_og_image: false,
          image_type: 'front',
        },
        {
          id: 'i3',
          product_id: 'p1',
          variant_id: null,
          supplier_code: 'red',
          url_cdn: 'https://img/red.png',
          is_primary: false,
          is_og_image: false,
          image_type: 'front',
        },
      ],
    });
    const res = await fetchAndProcessStockData();
    const v = res.productStocks[0].variants[0];
    // variant image takes priority over supplier-code image
    expect(v.imageUrl).toBe('https://img/v1.png');
    // product image url comes from the (non-box) product image
    expect(res.productStocks[0].productImageUrl).toBe('https://img/v1.png');
  });

  it('falls back supplierName to product.brand when no supplier_id', async () => {
    seedAll({
      products: [{ id: 'p1', name: 'P', sku: 'S', brand: 'MarcaY' }],
      variants: [{ id: 'v1', product_id: 'p1', stock_quantity: 1, is_active: true }],
    });
    const res = await fetchAndProcessStockData();
    expect(res.productStocks[0].supplierName).toBe('MarcaY');
  });

  it('tolerates the product_images fetch rejecting (catch -> [])', async () => {
    seedAll({
      products: [{ id: 'p1', name: 'P', sku: 'S' }],
      variants: [{ id: 'v1', product_id: 'p1', stock_quantity: 1, is_active: true }],
    });
    // product_images query errors generically -> the .catch(() => []) swallows it
    queue('product_images', { data: null, error: { message: 'images boom' } });
    const res = await fetchAndProcessStockData();
    expect(res.productStocks).toHaveLength(1);
    expect(res.productStocks[0].productImageUrl).toBeUndefined();
  });

  it('generates alerts from the aggregated summaries', async () => {
    seedAll({
      products: [{ id: 'p1', name: 'P', sku: 'S', min_quantity: 10 }],
      variants: [{ id: 'v1', product_id: 'p1', stock_quantity: 0, is_active: true }],
    });
    const res = await fetchAndProcessStockData();
    // currentStock 0, no in-transit -> out_of_stock -> at least one alert
    expect(res.alerts.length).toBeGreaterThan(0);
    expect(res.alerts.some((a) => a.type === 'out_of_stock')).toBe(true);
  });

  it('gracefully degrades when categories table fails — products returned, degradedTables populated', async () => {
    // When categories fails, products should still appear but without categoryName.
    // degradedTables must list 'categories' so the UI can surface a partial-data banner.
    seedAll({
      products: [{ id: 'p1', name: 'Caneca', sku: 'CAN', category_id: 'cat1' }],
      variants: [{ id: 'v1', product_id: 'p1', stock_quantity: 5, is_active: true }],
    });
    // Override categories queue with a non-410 fatal error; graceful() catches it.
    queue('categories', { data: null, error: { message: 'connection timeout' } });

    const res = await fetchAndProcessStockData();

    expect(res.productStocks).toHaveLength(1);
    expect(res.productStocks[0].productName).toBe('Caneca');
    // No category data available — categoryName falls back to undefined.
    expect(res.productStocks[0].categoryName).toBeUndefined();
    // degradedTables must report the failed table.
    expect(res.degradedTables).toContain('categories');
    // Other tables unaffected — variant stock is still computed.
    expect(res.productStocks[0].variants[0].currentStock).toBe(5);
  });

  it('aggregates currentStock and inTransitStock from 6 sources across different suppliers', async () => {
    // BUG-H regression guard: ensures multi-supplier aggregation holds for N > 2 sources.
    // Six sources, each from a distinct supplier_id; ALL quantities and future slots
    // must be summed — not just the most-recently-updated supplier's data.
    seedAll({
      products: [{ id: 'p1', name: 'Garrafa', sku: 'GAR-001' }],
      variants: [{ id: 'v1', product_id: 'p1', stock_quantity: 0, is_active: true }],
      sources: Array.from({ length: 6 }, (_, i) => ({
        id: `s${i + 1}`,
        variant_id: 'v1',
        supplier_id: `sup${i + 1}`,
        quantity: (i + 1) * 10, // 10, 20, 30, 40, 50, 60 → sum 210
        is_active: true,
        updated_at: `2026-0${i + 1}-01`,
        next_quantity_1: (i + 1) * 5, // 5, 10, 15, 20, 25, 30 → sum 105
        next_date_1: '2026-10-01',
      })),
    });
    const res = await fetchAndProcessStockData();
    const v = res.productStocks[0].variants[0];
    expect(v.currentStock).toBe(210); // 10+20+30+40+50+60
    expect(v.inTransitStock).toBe(105); // 5+10+15+20+25+30
    expect(v.futureSegments).toHaveLength(6); // one slot-1 segment per source
    expect(res.futureStock).toHaveLength(6); // s1-1 … s6-1
    const ids = res.futureStock.map((e) => e.id).sort();
    expect(ids).toEqual(['s1-1', 's2-1', 's3-1', 's4-1', 's5-1', 's6-1']);
  });
});

// ─── nextStockPairs / buildFutureEntries ────────────────────────────────────
describe('nextStockPairs — sparse slot allocation (only slots 4-6 populated)', () => {
  const sparseSource: ExternalSupplierSource = {
    id: 'sparse',
    variant_id: 'v-sparse',
    quantity: 0,
    // slots 1-3: null (explicit) or omitted (undefined) — no incoming stock yet
    next_quantity_1: null,
    next_date_1: null,
    next_quantity_3: null,
    next_date_3: null,
    // slots 4-6: populated (late-season replenishments)
    next_quantity_4: 100,
    next_date_4: '2026-10-01',
    next_quantity_5: 50,
    next_date_5: '2026-11-01',
    next_quantity_6: 25,
    next_date_6: '2026-12-01',
  };

  it('always returns exactly 6 pairs regardless of how many slots are populated', () => {
    const pairs = nextStockPairs(sparseSource);
    expect(pairs).toHaveLength(6);
  });

  it('preserves null/undefined for unpopulated slots 1-3', () => {
    const pairs = nextStockPairs(sparseSource);
    // Slot 1: explicitly null
    expect(pairs[0].q).toBeNull();
    expect(pairs[0].d).toBeNull();
    expect(pairs[0].suffix).toBe('1');
    expect(pairs[0].status).toBe('confirmed');
    // Slot 2: omitted field → undefined
    expect(pairs[1].q).toBeUndefined();
    expect(pairs[1].d).toBeUndefined();
    expect(pairs[1].suffix).toBe('2');
    expect(pairs[1].status).toBe('pending');
    // Slot 3: explicitly null
    expect(pairs[2].q).toBeNull();
    expect(pairs[2].suffix).toBe('3');
  });

  it('correctly exposes populated slots 4-6 with pending status', () => {
    const pairs = nextStockPairs(sparseSource);
    expect(pairs[3]).toMatchObject({ q: 100, d: '2026-10-01', suffix: '4', status: 'pending' });
    expect(pairs[4]).toMatchObject({ q: 50, d: '2026-11-01', suffix: '5', status: 'pending' });
    expect(pairs[5]).toMatchObject({ q: 25, d: '2026-12-01', suffix: '6', status: 'pending' });
  });

  it('buildFutureEntries emits exactly 3 entries for slots 4-6 (skips null slots 1-3)', () => {
    const entries = buildFutureEntries(
      sparseSource,
      'prod-sparse',
      'v-sparse',
      'Verde',
      'Chaveiro',
      'CHA-001',
    );
    expect(entries).toHaveLength(3);
    const suffixes = entries
      .map((e) => e.id.split('-').pop())
      .sort((a, b) => String(a).localeCompare(String(b)));
    expect(suffixes).toEqual(['4', '5', '6']);
    expect(entries.every((e) => e.status === 'pending')).toBe(true);
    expect(entries.reduce((sum, e) => sum + e.expectedQuantity, 0)).toBe(175); // 100+50+25
    // Metadata correctly propagated
    expect(entries[0].productName).toBe('Chaveiro');
    expect(entries[0].colorName).toBe('Verde');
    expect(entries[0].productSku).toBe('CHA-001');
  });
});
