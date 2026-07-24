/**
 * useZeroResultSubstitutes — testes unitários do ranking + agregação.
 *
 * Contratos validados:
 *  1. Score = quotes + 2 × orders (peso duplo para pedidos).
 *  2. Agregação por categoria/fornecedor soma quotes e orders de todos os
 *     produtos daquela dimensão antes de aplicar a fórmula.
 *  3. Ranking é ordenado por score desc e truncado por `limit`.
 *  4. O valor atualmente filtrado (categoryId/supplierId/productId) é
 *     excluído do ranking (não recomendamos o mesmo).
 *  5. Culprit `window` desabilita a query (não há dados para amostrar).
 *  6. Culprit `product` respeita filtros ativos (mesma categoria/fornecedor).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ---- Mocks ---------------------------------------------------------------

interface Row {
  product_id: string;
}

let quoteRows: Row[] = [];
let orderRows: Row[] = [];

/**
 * Emula a cadeia `from(table).select().gte().not().order().limit()` do
 * PostgREST builder — cada método retorna `this`; `.limit()` resolve com
 * `{ data, error }` dependendo da tabela consultada.
 */
function makeBuilder(table: string) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = chain;
  builder.gte = chain;
  builder.not = chain;
  builder.order = chain;
  builder.limit = vi.fn(async () => {
    if (table === 'quote_items') return { data: quoteRows, error: null };
    if (table === 'order_items') return { data: orderRows, error: null };
    return { data: [], error: null };
  });
  return builder;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => makeBuilder(table),
  },
}));

interface ExtProduct {
  id: string;
  name: string;
  category_id?: string | null;
  main_category_id?: string | null;
  supplier_id?: string | null;
  brand?: string | null;
}

let extProducts: ExtProduct[] = [];
let extCategories: { id: string; name: string }[] = [];

vi.mock('@/lib/external-db', () => ({
  fetchPromobrindProducts: vi.fn(async () => extProducts),
  fetchPromobrindCategories: vi.fn(async () => extCategories),
}));

// import depois dos mocks
import { useZeroResultSubstitutes } from '../useZeroResultSubstitutes';

function wrap(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

function newQc() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

beforeEach(() => {
  quoteRows = [];
  orderRows = [];
  extProducts = [];
  extCategories = [];
});

// ---- Testes --------------------------------------------------------------

describe('useZeroResultSubstitutes — score & ranking', () => {
  it('score = quotes + 2 × orders (peso duplo em pedidos)', async () => {
    // P1: 3 quotes, 0 orders → score 3
    // P2: 0 quotes, 2 orders → score 4  (deve ficar acima de P1)
    // P3: 1 quote,  1 order  → score 3  (empate com P1, ordem irrelevante entre eles)
    quoteRows = [
      { product_id: 'p1' }, { product_id: 'p1' }, { product_id: 'p1' },
      { product_id: 'p3' },
    ];
    orderRows = [
      { product_id: 'p2' }, { product_id: 'p2' },
      { product_id: 'p3' },
    ];
    extProducts = [
      { id: 'p1', name: 'Produto 1', category_id: 'c1', supplier_id: 's1' },
      { id: 'p2', name: 'Produto 2', category_id: 'c1', supplier_id: 's1' },
      { id: 'p3', name: 'Produto 3', category_id: 'c1', supplier_id: 's1' },
    ];

    const { result } = renderHook(
      () =>
        useZeroResultSubstitutes({
          enabled: true,
          days: 30,
          categoryId: null,
          supplierId: null,
          productId: null,
          culprit: 'product',
        }),
      { wrapper: wrap(newQc()) },
    );

    await waitFor(() => expect(result.current.data).toBeDefined());
    const products = result.current.data!.products;
    expect(products[0]).toMatchObject({ id: 'p2', quotes: 0, orders: 2, score: 4 });
    // p1 e p3 têm score 3 — ambos aparecem depois de p2
    const rest = products.slice(1).map((p) => p.id).sort();
    expect(rest).toEqual(['p1', 'p3']);
    for (const p of products) {
      expect(p.score).toBe(p.quotes + p.orders * 2);
    }
  });

  it('agrega por categoria somando quotes + orders de todos os produtos', async () => {
    // Categoria cA: p1 (2q, 1o) + p2 (0q, 3o) = 2q, 4o → score 2 + 8 = 10
    // Categoria cB: p3 (5q, 0o)              = 5q, 0o → score 5
    quoteRows = [
      { product_id: 'p1' }, { product_id: 'p1' },
      { product_id: 'p3' }, { product_id: 'p3' }, { product_id: 'p3' },
      { product_id: 'p3' }, { product_id: 'p3' },
    ];
    orderRows = [
      { product_id: 'p1' },
      { product_id: 'p2' }, { product_id: 'p2' }, { product_id: 'p2' },
    ];
    extProducts = [
      { id: 'p1', name: 'P1', category_id: 'cA', supplier_id: 's1', brand: 'Marca A' },
      { id: 'p2', name: 'P2', category_id: 'cA', supplier_id: 's1', brand: 'Marca A' },
      { id: 'p3', name: 'P3', category_id: 'cB', supplier_id: 's2', brand: 'Marca B' },
    ];
    extCategories = [
      { id: 'cA', name: 'Canecas' },
      { id: 'cB', name: 'Camisetas' },
    ];

    const { result } = renderHook(
      () =>
        useZeroResultSubstitutes({
          enabled: true,
          days: 30,
          categoryId: null,
          supplierId: null,
          productId: null,
          culprit: 'category',
        }),
      { wrapper: wrap(newQc()) },
    );

    await waitFor(() => expect(result.current.data).toBeDefined());
    const cats = result.current.data!.categories;
    expect(cats).toHaveLength(2);
    expect(cats[0]).toMatchObject({ id: 'cA', name: 'Canecas', quotes: 2, orders: 4, score: 10 });
    expect(cats[1]).toMatchObject({ id: 'cB', name: 'Camisetas', quotes: 5, orders: 0, score: 5 });
  });

  it('agrega por fornecedor e usa `brand` como nome legível', async () => {
    quoteRows = [{ product_id: 'p1' }, { product_id: 'p2' }];
    orderRows = [{ product_id: 'p1' }, { product_id: 'p1' }];
    // p1 + p2 mesmo supplier sA → quotes 2, orders 2, score 6
    extProducts = [
      { id: 'p1', name: 'P1', category_id: 'c1', supplier_id: 'sA', brand: 'Fornecedor A' },
      { id: 'p2', name: 'P2', category_id: 'c1', supplier_id: 'sA', brand: 'Fornecedor A' },
    ];

    const { result } = renderHook(
      () =>
        useZeroResultSubstitutes({
          enabled: true,
          days: 30,
          categoryId: null,
          supplierId: null,
          productId: null,
          culprit: 'supplier',
        }),
      { wrapper: wrap(newQc()) },
    );

    await waitFor(() => expect(result.current.data).toBeDefined());
    const sups = result.current.data!.suppliers;
    expect(sups).toHaveLength(1);
    expect(sups[0]).toMatchObject({ id: 'sA', name: 'Fornecedor A', quotes: 2, orders: 2, score: 6 });
  });

  it('exclui o valor atualmente filtrado (não recomenda o mesmo)', async () => {
    quoteRows = [{ product_id: 'p1' }, { product_id: 'p2' }];
    orderRows = [{ product_id: 'p1' }];
    extProducts = [
      { id: 'p1', name: 'P1', category_id: 'cA' },
      { id: 'p2', name: 'P2', category_id: 'cB' },
    ];
    extCategories = [
      { id: 'cA', name: 'A' },
      { id: 'cB', name: 'B' },
    ];

    const { result } = renderHook(
      () =>
        useZeroResultSubstitutes({
          enabled: true,
          days: 30,
          categoryId: 'cA', // atualmente aplicado → deve ser excluído do ranking
          supplierId: null,
          productId: null,
          culprit: 'category',
        }),
      { wrapper: wrap(newQc()) },
    );

    await waitFor(() => expect(result.current.data).toBeDefined());
    const ids = result.current.data!.categories.map((c) => c.id);
    expect(ids).not.toContain('cA');
    expect(ids).toEqual(['cB']);
  });

  it('respeita `limit` no truncamento do ranking', async () => {
    quoteRows = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'].map((id) => ({ product_id: id }));
    extProducts = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'].map((id, i) => ({
      id,
      name: `P${i + 1}`,
      category_id: `c${i + 1}`,
    }));
    extCategories = extProducts.map((p) => ({
      id: p.category_id!,
      name: `Cat ${p.category_id}`,
    }));

    const { result } = renderHook(
      () =>
        useZeroResultSubstitutes({
          enabled: true,
          days: 30,
          categoryId: null,
          supplierId: null,
          productId: null,
          culprit: 'category',
          limit: 3,
        }),
      { wrapper: wrap(newQc()) },
    );

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data!.categories).toHaveLength(3);
  });

  it('não dispara query quando culprit é `window`', async () => {
    const { result } = renderHook(
      () =>
        useZeroResultSubstitutes({
          enabled: true,
          days: 30,
          categoryId: null,
          supplierId: null,
          productId: null,
          culprit: 'window',
        }),
      { wrapper: wrap(newQc()) },
    );
    // Query desativada → data undefined, sem chamada ao supabase.
    expect(result.current.data).toBeUndefined();
    expect(result.current.isFetching).toBe(false);
  });

  it('culprit `product` filtra por categoria ativa (mesma categoria)', async () => {
    quoteRows = [{ product_id: 'p1' }, { product_id: 'p2' }];
    orderRows = [{ product_id: 'p1' }, { product_id: 'p2' }];
    extProducts = [
      { id: 'p1', name: 'Da mesma cat', category_id: 'cA' },
      { id: 'p2', name: 'De outra cat', category_id: 'cB' },
    ];

    const { result } = renderHook(
      () =>
        useZeroResultSubstitutes({
          enabled: true,
          days: 30,
          categoryId: 'cA', // ancora produtos ao contexto atual
          supplierId: null,
          productId: null,
          culprit: 'product',
        }),
      { wrapper: wrap(newQc()) },
    );

    await waitFor(() => expect(result.current.data).toBeDefined());
    const ids = result.current.data!.products.map((p) => p.id);
    expect(ids).toEqual(['p1']);
  });

  it('culprit `intersection` popula categorias, fornecedores e produtos ao mesmo tempo', async () => {
    quoteRows = [{ product_id: 'p1' }];
    orderRows = [{ product_id: 'p1' }];
    extProducts = [
      { id: 'p1', name: 'P1', category_id: 'cA', supplier_id: 'sA', brand: 'Marca A' },
    ];
    extCategories = [{ id: 'cA', name: 'Canecas' }];

    const { result } = renderHook(
      () =>
        useZeroResultSubstitutes({
          enabled: true,
          days: 30,
          categoryId: null,
          supplierId: null,
          productId: null,
          culprit: 'intersection',
        }),
      { wrapper: wrap(newQc()) },
    );

    await waitFor(() => expect(result.current.data).toBeDefined());
    const d = result.current.data!;
    expect(d.categories).toHaveLength(1);
    expect(d.suppliers).toHaveLength(1);
    expect(d.products).toHaveLength(1);
    // Score consistente em todas as dimensões: 1 quote + 2×1 order = 3
    expect(d.categories[0].score).toBe(3);
    expect(d.suppliers[0].score).toBe(3);
    expect(d.products[0].score).toBe(3);
  });
});
