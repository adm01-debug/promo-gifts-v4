/**
 * Cobre o invariante de quantidade 1 <= q <= 999999 em TODOS os caminhos de
 * escrita do useSellerCarts — não só na edição direta (updateItemQuantity), mas
 * também nos caminhos de mesclagem (add/move/duplicate), que antes somavam
 * `existing + qty` sem teto.
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
  id: string;
  cart_id: string;
  product_id: string;
  product_name: string;
  product_sku: string | null;
  product_image_url: string | null;
  product_price: number;
  quantity: number;
  color_name: string | null;
  color_hex: string | null;
  notes: string | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
};

const ops: Array<{ kind: string; [k: string]: unknown }> = [];
let itemsTable: Row[] = [];
const cartsTable = [
  { id: 'cart-A', seller_id: 'seller-1', company_id: 'co', company_name: 'A', company_location: null, company_logo_url: null, notes: null, status: 'novo', created_at: '', updated_at: '' },
  { id: 'cart-B', seller_id: 'seller-1', company_id: 'co', company_name: 'B', company_location: null, company_logo_url: null, notes: null, status: 'novo', created_at: '', updated_at: '' },
];

function makeBuilder(table: string) {
  const state: {
    op: 'select' | 'insert' | 'update' | 'delete';
    payload?: Record<string, unknown>;
    filters: Array<[string, string, unknown]>;
  } = { op: 'select', filters: [] };

  const applyFilters = (rows: Row[]) =>
    rows.filter((r) =>
      state.filters.every(([kind, col, val]) => {
        const cell = (r as Record<string, unknown>)[col];
        if (kind === 'is') return cell === val;
        if (kind === 'in') return (val as unknown[]).includes(cell);
        return cell === val;
      }),
    );

  const resolveList = () => {
    if (table === 'seller_carts') return { data: cartsTable, error: null };
    return { data: applyFilters(itemsTable), error: null };
  };
  const resolveSingle = () => ({ data: applyFilters(itemsTable)[0] ?? null, error: null });

  const runMutation = () => {
    if (table !== 'seller_cart_items') return { data: null, error: null };
    if (state.op === 'update') {
      const targets = applyFilters(itemsTable);
      targets.forEach((r) => Object.assign(r, state.payload));
      ops.push({ kind: 'update', payload: state.payload, ids: targets.map((t) => t.id) });
    } else if (state.op === 'delete') {
      const targets = applyFilters(itemsTable);
      itemsTable = itemsTable.filter((r) => !targets.includes(r));
      ops.push({ kind: 'delete', ids: targets.map((t) => t.id) });
    } else if (state.op === 'insert') {
      ops.push({ kind: 'insert', payload: state.payload });
    }
    return { data: null, error: null };
  };

  const b: Record<string, unknown> = {
    select() { return b; },
    insert(payload: Record<string, unknown>) { state.op = 'insert'; state.payload = payload; return b; },
    update(payload: Record<string, unknown>) { state.op = 'update'; state.payload = payload; return b; },
    delete() { state.op = 'delete'; return b; },
    eq(col: string, val: unknown) { state.filters.push(['eq', col, val]); return b; },
    is(col: string, val: unknown) { state.filters.push(['is', col, val]); return b; },
    in(col: string, val: unknown) { state.filters.push(['in', col, val]); return b; },
    order() { return Promise.resolve(resolveList()); },
    maybeSingle() { return Promise.resolve(resolveSingle()); },
    single() { return Promise.resolve(resolveSingle()); },
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

import { useSellerCarts, MAX_ITEM_QUANTITY, clampQuantity } from '@/hooks/products/useSellerCarts';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

const mkRow = (over: Partial<Row>): Row => ({
  id: 'x', cart_id: 'cart-A', product_id: 'p1', product_name: 'Prod', product_sku: null,
  product_image_url: null, product_price: 10, quantity: 1, color_name: null, color_hex: null,
  notes: null, sort_order: 0, created_at: '', updated_at: '', ...over,
});

const lastUpdate = () => [...ops].reverse().find((o) => o.kind === 'update');

beforeEach(() => { ops.length = 0; });

describe('clampQuantity (unidade)', () => {
  it('aplica piso 1, teto 999999 e trunca/sanea entradas inválidas', () => {
    expect(clampQuantity(0)).toBe(1);
    expect(clampQuantity(-5)).toBe(1);
    expect(clampQuantity(1.9)).toBe(1);
    expect(clampQuantity(10)).toBe(10);
    expect(clampQuantity(MAX_ITEM_QUANTITY + 1)).toBe(MAX_ITEM_QUANTITY);
    expect(clampQuantity(Number.NaN)).toBe(1);
    expect(clampQuantity(Infinity)).toBe(MAX_ITEM_QUANTITY);
  });
});

describe('useSellerCarts — invariante de quantidade nos caminhos de escrita', () => {
  it('addItem em variante existente clampa a SOMA no teto', async () => {
    itemsTable = [mkRow({ id: 'dst', cart_id: 'cart-A', product_id: 'p1', color_name: null, quantity: 999998 })];
    const { result } = renderHook(() => useSellerCarts(), { wrapper });
    await waitFor(() => expect(result.current.carts.length).toBe(2));

    await result.current.addItem.mutateAsync({
      cartId: 'cart-A',
      item: { product_id: 'p1', product_name: 'Prod', product_price: 10, quantity: 50 },
    });

    expect(lastUpdate()?.payload).toMatchObject({ quantity: MAX_ITEM_QUANTITY });
  });

  it('addItem novo item clampa a quantidade pedida no teto', async () => {
    itemsTable = [];
    const { result } = renderHook(() => useSellerCarts(), { wrapper });
    await waitFor(() => expect(result.current.carts.length).toBe(2));

    await result.current.addItem.mutateAsync({
      cartId: 'cart-A',
      item: { product_id: 'p1', product_name: 'Prod', product_price: 10, quantity: 5_000_000 },
    });

    const insert = ops.find((o) => o.kind === 'insert');
    expect(insert?.payload).toMatchObject({ quantity: MAX_ITEM_QUANTITY });
  });

  it('updateItemQuantity clampa piso e teto', async () => {
    itemsTable = [mkRow({ id: 'it', cart_id: 'cart-A', quantity: 5 })];
    const { result } = renderHook(() => useSellerCarts(), { wrapper });
    await waitFor(() => expect(result.current.carts.length).toBe(2));

    await result.current.updateItemQuantity.mutateAsync({ itemId: 'it', quantity: 0 });
    expect(lastUpdate()?.payload).toMatchObject({ quantity: 1 });

    await result.current.updateItemQuantity.mutateAsync({ itemId: 'it', quantity: 9_999_999 });
    expect(lastUpdate()?.payload).toMatchObject({ quantity: MAX_ITEM_QUANTITY });
  });

  it('moveItemToCart com mesclagem clampa a soma no teto', async () => {
    itemsTable = [
      mkRow({ id: 'src', cart_id: 'cart-A', product_id: 'p1', color_name: null, quantity: 600000 }),
      mkRow({ id: 'dst', cart_id: 'cart-B', product_id: 'p1', color_name: null, quantity: 600000 }),
    ];
    const { result } = renderHook(() => useSellerCarts(), { wrapper });
    await waitFor(() => expect(result.current.carts.length).toBe(2));

    await result.current.moveItemToCart.mutateAsync({ itemId: 'src', targetCartId: 'cart-B' });

    const update = ops.find((o) => o.kind === 'update');
    expect(update?.payload).toMatchObject({ quantity: MAX_ITEM_QUANTITY });
    expect((update?.ids as string[])).toContain('dst');
  });

  it('duplicateItemToCart com mesclagem clampa a soma no teto', async () => {
    itemsTable = [
      mkRow({ id: 'src', cart_id: 'cart-A', product_id: 'p1', color_name: 'Azul', quantity: 700000 }),
      mkRow({ id: 'dst', cart_id: 'cart-B', product_id: 'p1', color_name: 'Azul', quantity: 700000 }),
    ];
    const { result } = renderHook(() => useSellerCarts(), { wrapper });
    await waitFor(() => expect(result.current.carts.length).toBe(2));

    await result.current.duplicateItemToCart.mutateAsync({ itemId: 'src', targetCartId: 'cart-B' });

    expect(lastUpdate()?.payload).toMatchObject({ quantity: MAX_ITEM_QUANTITY });
  });

  it('duplicateItemToCart sem variante existente no destino clampa a quantidade no teto', async () => {
    // Fonte tem quantidade acima do teto (dado legado corrompido hipotético).
    // Sem variante no destino → INSERT novo. quantity deve ser clampado.
    itemsTable = [
      mkRow({ id: 'src', cart_id: 'cart-A', product_id: 'p2', color_name: 'Verde', quantity: 5_000_000 }),
    ];
    const { result } = renderHook(() => useSellerCarts(), { wrapper });
    await waitFor(() => expect(result.current.carts.length).toBe(2));

    await result.current.duplicateItemToCart.mutateAsync({ itemId: 'src', targetCartId: 'cart-B' });

    const insert = ops.find((o) => o.kind === 'insert');
    expect(insert?.payload).toMatchObject({ quantity: MAX_ITEM_QUANTITY });
  });

  it('restoreItems clampa quantidade acima do teto antes de inserir (lote)', async () => {
    itemsTable = [];
    const { result } = renderHook(() => useSellerCarts(), { wrapper });
    await waitFor(() => expect(result.current.carts.length).toBe(2));

    await result.current.restoreItems.mutateAsync({
      cartId: 'cart-A',
      items: [
        { product_id: 'p3', product_name: 'A', product_price: 5, quantity: 2_000_000 },
        { product_id: 'p4', product_name: 'B', product_price: 5, quantity: 0 },
        { product_id: 'p5', product_name: 'C', product_price: 5, quantity: -99 },
        { product_id: 'p6', product_name: 'D', product_price: 5 }, // quantity undefined → 1
      ],
    });

    const insert = ops.find((o) => o.kind === 'insert');
    const rows = insert?.payload as Array<{ product_id: string; quantity: number }>;
    expect(rows).toHaveLength(4);
    expect(rows.find((r) => r.product_id === 'p3')?.quantity).toBe(MAX_ITEM_QUANTITY);
    expect(rows.find((r) => r.product_id === 'p4')?.quantity).toBe(1);  // 0 → piso 1
    expect(rows.find((r) => r.product_id === 'p5')?.quantity).toBe(1);  // -99 → piso 1
    expect(rows.find((r) => r.product_id === 'p6')?.quantity).toBe(1);  // undefined → 1
  });
});
