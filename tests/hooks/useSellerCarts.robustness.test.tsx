/**
 * Robustez sob falha parcial: como o client não tem transação, operações
 * multi-statement (move-merge, duplicate-cart) precisam compensar falhas no
 * meio do caminho para não corromper dados (quantidade dobrada, carrinho órfão).
 *
 * Usa um mock do supabase com INJEÇÃO DE FALHA: `failNext` força a próxima
 * operação que casar (op + tabela) a retornar erro uma única vez.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'seller-1' }, role: 'vendedor', isLoading: false, profile: null }),
}));
vi.mock('@/lib/security/sanitize-error', () => ({ sanitizeError: (e: Error) => e.message }));

type Row = {
  id: string; cart_id: string; product_id: string; product_name: string;
  product_sku: string | null; product_image_url: string | null; product_price: number;
  quantity: number; color_name: string | null; color_hex: string | null;
  notes: string | null; sort_order: number | null; created_at: string; updated_at: string;
};
type CartRow = {
  id: string; seller_id: string; company_id: string; company_name: string;
  company_location: string | null; company_logo_url: string | null;
  notes: string | null; status: string; created_at: string; updated_at: string;
};

const ops: Array<{ kind: string; table: string; [k: string]: unknown }> = [];
let itemsTable: Row[] = [];
let cartsTable: CartRow[] = [];
// Fila de falhas a injetar: { op, table } — consumida na ordem.
let failNext: Array<{ op: string; table: string }> = [];
// id determinístico para inserts de carrinho
let cartSeq = 0;

function makeBuilder(table: string) {
  const state: {
    op: 'select' | 'insert' | 'update' | 'delete';
    payload?: Record<string, unknown> | Record<string, unknown>[];
    filters: Array<[string, string, unknown]>;
  } = { op: 'select', filters: [] };

  const tableRows = (): Array<Row | CartRow> =>
    table === 'seller_carts' ? cartsTable : itemsTable;

  const applyFilters = <T,>(rows: T[]) =>
    rows.filter((r) =>
      state.filters.every(([kind, col, val]) => {
        const cell = (r as Record<string, unknown>)[col];
        if (kind === 'is') return cell === val;
        if (kind === 'in') return (val as unknown[]).includes(cell);
        return cell === val;
      }),
    );

  const consumeFail = () => {
    const idx = failNext.findIndex((f) => f.op === state.op && f.table === table);
    if (idx >= 0) {
      failNext.splice(idx, 1);
      return { data: null, error: { message: `injected ${state.op} failure`, code: 'XXFAIL' } };
    }
    return null;
  };

  const resolveList = () => ({ data: applyFilters(tableRows()), error: null });
  const resolveSingle = () => {
    const injected = consumeFail();
    if (injected) return injected;
    return { data: applyFilters(tableRows())[0] ?? null, error: null };
  };

  const runMutation = () => {
    const injected = consumeFail();
    if (injected) {
      ops.push({ kind: `${state.op}:failed`, table });
      return injected;
    }
    if (state.op === 'update') {
      const targets = applyFilters(tableRows());
      targets.forEach((r) => Object.assign(r, state.payload));
      ops.push({ kind: 'update', table, payload: state.payload, ids: targets.map((t) => (t as Row).id) });
    } else if (state.op === 'delete') {
      const targets = applyFilters(tableRows());
      if (table === 'seller_carts') cartsTable = cartsTable.filter((r) => !(targets as CartRow[]).includes(r));
      else itemsTable = itemsTable.filter((r) => !(targets as Row[]).includes(r));
      ops.push({ kind: 'delete', table, ids: targets.map((t) => (t as Row).id) });
    } else if (state.op === 'insert') {
      ops.push({ kind: 'insert', table, payload: state.payload });
      if (table === 'seller_carts') {
        const row = { ...(state.payload as Record<string, unknown>), id: `cart-new-${++cartSeq}` } as unknown as CartRow;
        cartsTable.push(row);
        return { data: row, error: null };
      }
    }
    return { data: null, error: null };
  };

  const b: Record<string, unknown> = {
    select() { return b; },
    insert(payload: Record<string, unknown> | Record<string, unknown>[]) { state.op = 'insert'; state.payload = payload; return b; },
    update(payload: Record<string, unknown>) { state.op = 'update'; state.payload = payload; return b; },
    delete() { state.op = 'delete'; return b; },
    eq(col: string, val: unknown) { state.filters.push(['eq', col, val]); return b; },
    is(col: string, val: unknown) { state.filters.push(['is', col, val]); return b; },
    in(col: string, val: unknown) { state.filters.push(['in', col, val]); return b; },
    order() { return Promise.resolve(resolveList()); },
    maybeSingle() { return Promise.resolve(resolveSingle()); },
    single() { return Promise.resolve(state.op === 'insert' ? runMutation() : resolveSingle()); },
    then(onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) {
      const result = state.op === 'select' ? resolveList() : runMutation();
      return Promise.resolve(result).then(onF, onR);
    },
  };
  return b;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (table: string) => makeBuilder(table) },
}));

import { useSellerCarts } from '@/hooks/products/useSellerCarts';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

const mkRow = (over: Partial<Row>): Row => ({
  id: 'x', cart_id: 'cart-A', product_id: 'p1', product_name: 'Prod', product_sku: null,
  product_image_url: null, product_price: 10, quantity: 1, color_name: null, color_hex: null,
  notes: null, sort_order: 0, created_at: '', updated_at: '', ...over,
});
const mkCart = (over: Partial<CartRow>): CartRow => ({
  id: 'cart-A', seller_id: 'seller-1', company_id: 'co', company_name: 'A', company_location: null,
  company_logo_url: null, notes: null, status: 'novo', created_at: '', updated_at: '', ...over,
});

beforeEach(() => {
  ops.length = 0;
  failNext = [];
  cartSeq = 0;
  cartsTable = [mkCart({ id: 'cart-A', company_name: 'A' }), mkCart({ id: 'cart-B', company_name: 'B' })];
  itemsTable = [];
});

describe('moveItemToCart — compensação sob falha do delete', () => {
  it('se o DELETE da origem falha após o merge, reverte a quantidade do destino (sem dobrar)', async () => {
    itemsTable = [
      mkRow({ id: 'src', cart_id: 'cart-A', product_id: 'p1', color_name: null, quantity: 2 }),
      mkRow({ id: 'dst', cart_id: 'cart-B', product_id: 'p1', color_name: null, quantity: 3 }),
    ];
    failNext = [{ op: 'delete', table: 'seller_cart_items' }];

    const { result } = renderHook(() => useSellerCarts(), { wrapper });
    await waitFor(() => expect(result.current.carts.length).toBe(2));

    await expect(
      result.current.moveItemToCart.mutateAsync({ itemId: 'src', targetCartId: 'cart-B' }),
    ).rejects.toBeTruthy();

    // destino deve ter voltado a 3 (compensação) — NUNCA permanecer em 5 com src vivo
    const dst = itemsTable.find((r) => r.id === 'dst');
    const src = itemsTable.find((r) => r.id === 'src');
    expect(dst?.quantity).toBe(3);
    expect(src).toBeTruthy(); // origem permanece (move falhou)
    // houve a tentativa de delete e a compensação (segundo update no dst)
    expect(ops.some((o) => o.kind === 'delete:failed')).toBe(true);
    const dstUpdates = ops.filter((o) => o.kind === 'update' && (o.ids as string[])?.includes('dst'));
    expect(dstUpdates.length).toBe(2);
  });
});
