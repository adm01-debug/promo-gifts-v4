/**
 * Cobre o FIX de mesclagem (merge) ao mover/duplicar itens entre carrinhos.
 *
 * O constraint unique_cart_item_variant (cart_id, product_id, color_name)
 * NULLS NOT DISTINCT impede que o item exista duplicado num mesmo carrinho.
 * Antes do fix, mover/duplicar um item para um carrinho que JÁ contém a mesma
 * variante estourava 23505 e falhava silenciosamente. Agora deve MESCLAR as
 * quantidades.
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

// ---- Estado in-memory dos itens ----
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

  const resolveSingle = () => {
    const rows = applyFilters(itemsTable);
    return { data: rows[0] ?? null, error: null };
  };

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

beforeEach(() => {
  ops.length = 0;
});

describe('useSellerCarts — merge ao mover/duplicar', () => {
  it('mover para carrinho que já tem a variante soma quantidades e remove a origem', async () => {
    itemsTable = [
      mkRow({ id: 'src', cart_id: 'cart-A', product_id: 'p1', color_name: null, quantity: 2 }),
      mkRow({ id: 'dst', cart_id: 'cart-B', product_id: 'p1', color_name: null, quantity: 3 }),
    ];
    const { result } = renderHook(() => useSellerCarts(), { wrapper });
    await waitFor(() => expect(result.current.carts.length).toBe(2));

    await result.current.moveItemToCart.mutateAsync({ itemId: 'src', targetCartId: 'cart-B' });

    const update = ops.find((o) => o.kind === 'update');
    const del = ops.find((o) => o.kind === 'delete');
    expect(update?.payload).toMatchObject({ quantity: 5 });
    expect((update?.ids as string[])).toContain('dst');
    expect((del?.ids as string[])).toContain('src');
    // nunca deve ter feito UPDATE de cart_id (que estouraria o constraint)
    expect(ops.some((o) => o.kind === 'update' && (o.payload as Row).cart_id)).toBe(false);
  });

  it('mover para carrinho sem a variante apenas troca o cart_id', async () => {
    itemsTable = [mkRow({ id: 'src', cart_id: 'cart-A', product_id: 'p9', quantity: 2 })];
    const { result } = renderHook(() => useSellerCarts(), { wrapper });
    await waitFor(() => expect(result.current.carts.length).toBe(2));

    await result.current.moveItemToCart.mutateAsync({ itemId: 'src', targetCartId: 'cart-B' });

    const update = ops.find((o) => o.kind === 'update');
    expect(update?.payload).toMatchObject({ cart_id: 'cart-B' });
    expect(ops.some((o) => o.kind === 'delete')).toBe(false);
  });

  it('duplicar para carrinho que já tem a variante soma no item existente (sem insert)', async () => {
    itemsTable = [
      mkRow({ id: 'src', cart_id: 'cart-A', product_id: 'p1', color_name: 'Azul', quantity: 4 }),
      mkRow({ id: 'dst', cart_id: 'cart-B', product_id: 'p1', color_name: 'Azul', quantity: 1 }),
    ];
    const { result } = renderHook(() => useSellerCarts(), { wrapper });
    await waitFor(() => expect(result.current.carts.length).toBe(2));

    await result.current.duplicateItemToCart.mutateAsync({ itemId: 'src', targetCartId: 'cart-B' });

    const update = ops.find((o) => o.kind === 'update');
    expect(update?.payload).toMatchObject({ quantity: 5 });
    expect((update?.ids as string[])).toContain('dst');
    expect(ops.some((o) => o.kind === 'insert')).toBe(false);
  });

  it('duplicar para carrinho sem a variante insere novo item sem sort_order fixo', async () => {
    itemsTable = [mkRow({ id: 'src', cart_id: 'cart-A', product_id: 'p1', color_name: null, quantity: 2 })];
    const { result } = renderHook(() => useSellerCarts(), { wrapper });
    await waitFor(() => expect(result.current.carts.length).toBe(2));

    await result.current.duplicateItemToCart.mutateAsync({ itemId: 'src', targetCartId: 'cart-B' });

    const insert = ops.find((o) => o.kind === 'insert');
    expect(insert?.payload).toMatchObject({ cart_id: 'cart-B', product_id: 'p1', quantity: 2 });
    // sort_order é omitido de propósito (trigger atribui no destino)
    expect((insert?.payload as Record<string, unknown>).sort_order).toBeUndefined();
  });
});
