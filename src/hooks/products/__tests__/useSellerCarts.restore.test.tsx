/**
 * Unit test — restoreCartWithItems/deleteCart: snapshot fiel para Undo.
 *
 * Garante que:
 *  1) A restauração envia à RPC apenas campos permitidos e itens clampeados.
 *  2) Snapshot sem itens envia `items: []` sem inventar linhas.
 *  3) Se a RPC ainda não estiver disponível no banco alvo, o fallback client-side
 *     restaura cart + itens e deduplica variantes iguais.
 *  4) `deleteCart` resolve com snapshot hidratado do servidor, evitando o bug em
 *     que telas com cache parcial passavam `items: []` ao Undo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// Mock do supabase client — captura payloads.
const rpcMock = vi.fn();
const insertCalls: Array<{ table: string; payload: unknown }> = [];
const deleteCalls: Array<{ table: string; filters: Record<string, unknown> }> = [];

function makeQueryChain(data: unknown, error: unknown = null) {
  const chain = {
    eq: () => chain,
    order: () => chain,
    maybeSingle: () => Promise.resolve({ data, error }),
    single: () => Promise.resolve({ data, error }),
    then: (
      resolve: (value: { data: unknown; error: unknown }) => void,
      reject?: (reason: unknown) => void,
    ) => Promise.resolve({ data, error }).then(resolve, reject),
  };
  return chain;
}

function makeSellerCartsSelectChain() {
  const chain = {
    eq: () => chain,
    order: () => chain,
    maybeSingle: () => Promise.resolve({ data: HYDRATED_CART_ROW, error: null }),
    single: () => Promise.resolve({ data: HYDRATED_CART_ROW, error: null }),
    then: (
      resolve: (value: { data: unknown[]; error: null }) => void,
      reject?: (reason: unknown) => void,
    ) => Promise.resolve({ data: [HYDRATED_CART_ROW], error: null }).then(resolve, reject),
  };
  return chain;
}

function makeDeleteChain(table: string) {
  const filters: Record<string, unknown> = {};
  const chain = {
    eq: (column: string, value: unknown) => {
      filters[column] = value;
      deleteCalls.push({ table, filters: { ...filters } });
      return chain;
    },
    in: (column: string, value: unknown) => {
      filters[column] = value;
      deleteCalls.push({ table, filters: { ...filters } });
      return Promise.resolve({ data: [], error: null });
    },
    select: () => Promise.resolve({ data: [{ id: filters.id ?? 'deleted-cart' }], error: null }),
    then: (
      resolve: (value: { data: unknown[]; error: null }) => void,
      reject?: (reason: unknown) => void,
    ) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
  };
  return chain;
}

vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      rpc: (...args: unknown[]) => rpcMock(...args),
      from: (table: string) => {
        const chain = {
          delete: () => makeDeleteChain(table),
          insert: (payload: unknown) => {
            insertCalls.push({ table, payload });
            return {
              select: () => {
                if (table === 'seller_carts') {
                  return {
                    single: () =>
                      Promise.resolve({
                        data: { id: 'fallback-cart-id-123', seller_id: 'seller-x' },
                        error: null,
                      }),
                  };
                }
                return Promise.resolve({
                  data: [{ id: 'fallback-item-1' }, { id: 'fallback-item-2' }],
                  error: null,
                });
              },
            };
          },
          select: (columns?: string) => {
            if (table === 'seller_carts' && columns === '*, seller_cart_items(*)') {
              return makeSellerCartsSelectChain();
            }
            return makeQueryChain([]);
          },
        };
        return chain;
      },
    },
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'seller-x' } }),
}));

vi.mock('@/lib/security/sanitize-error', () => ({
  sanitizeError: (e: Error) => e.message,
}));

vi.mock('@/lib/telemetry/structuredLogger', () => ({
  createClientLogger: () => ({ info: () => {}, warn: () => {}, error: () => {} }),
}));

vi.mock('sonner', () => ({
  toast: { success: () => {}, error: () => {}, info: () => {}, warning: () => {} },
}));

import {
  useSellerCarts,
  MAX_ITEM_QUANTITY,
  MIN_ITEM_QUANTITY,
  type SellerCart,
} from '@/hooks/products/useSellerCarts';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const BASE_SNAPSHOT: SellerCart = {
  id: 'old-cart-uuid-should-not-leak',
  seller_id: 'old-seller-should-not-leak',
  company_id: 'company-42',
  company_name: 'Yakult Brasil',
  company_location: 'SP',
  company_logo_url: 'https://cdn/logo.png',
  notes: 'Cliente prioritário',
  status: 'em_separacao',
  shipping_deadline: '2026-07-30',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
  items: [
    {
      id: 'item-old-1',
      cart_id: 'old-cart-uuid-should-not-leak',
      product_id: 'prod-1',
      product_name: 'Caneta',
      product_sku: 'SKU1',
      product_image_url: null,
      product_price: 5.5,
      quantity: 10,
      color_name: 'Azul',
      color_hex: '#0000ff',
      notes: null,
      sort_order: 0,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'item-old-2',
      cart_id: 'old-cart-uuid-should-not-leak',
      product_id: 'prod-2',
      product_name: 'Caneca',
      product_sku: null,
      product_image_url: null,
      product_price: 20,
      quantity: MAX_ITEM_QUANTITY + 500, // deve ser clampeado
      color_name: null,
      color_hex: null,
      notes: 'Personalizada',
      sort_order: 1,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ],
};

const HYDRATED_CART_ROW = {
  ...BASE_SNAPSHOT,
  seller_id: 'seller-x',
  seller_cart_items: BASE_SNAPSHOT.items,
};

describe('useSellerCarts.restoreCartWithItems — snapshot fiel + fallback', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    insertCalls.length = 0;
    deleteCalls.length = 0;
  });

  it('RPC recebe APENAS campos permitidos no snapshot', async () => {
    rpcMock.mockResolvedValue({
      data: { cart_id: 'new-cart-id-123', items_total: 2, items_inserted: 2, items_deduped: 0 },
      error: null,
    });

    const { result } = renderHook(() => useSellerCarts(), { wrapper });

    await waitFor(() => expect(result.current.restoreCartWithItems).toBeTruthy());

    await result.current.restoreCartWithItems.mutateAsync(BASE_SNAPSHOT);

    expect(rpcMock).toHaveBeenCalledTimes(1);
    const [, rpcPayload] = rpcMock.mock.calls[0] as [string, { _snapshot: Record<string, unknown> }];
    const payload = rpcPayload._snapshot;

    const ALLOWED = new Set([
      'seller_id',
      'company_id',
      'company_name',
      'company_location',
      'company_logo_url',
      'notes',
      'status',
      'shipping_deadline',
      'items',
    ]);
    const FORBIDDEN = ['id', 'created_at', 'updated_at'];

    // Todo campo do payload deve estar na allowlist.
    for (const key of Object.keys(payload)) {
      expect(ALLOWED.has(key), `Campo "${key}" NÃO permitido no INSERT`).toBe(true);
    }
    // Campos internos jamais vazam.
    for (const forbidden of FORBIDDEN) {
      expect(forbidden in payload, `Campo interno "${forbidden}" vazou`).toBe(false);
    }
    // seller_id vem do usuário autenticado, NÃO do snapshot.
    expect(payload.seller_id).toBe('seller-x');
    expect(payload.seller_id).not.toBe(BASE_SNAPSHOT.seller_id);
  });

  it('RPC preserva sort_order e clampeia quantity dos itens', async () => {
    rpcMock.mockResolvedValue({
      data: { cart_id: 'new-cart-id-123', items_total: 2, items_inserted: 2, items_deduped: 0 },
      error: null,
    });

    const { result } = renderHook(() => useSellerCarts(), { wrapper });
    await waitFor(() => expect(result.current.restoreCartWithItems).toBeTruthy());

    await result.current.restoreCartWithItems.mutateAsync(BASE_SNAPSHOT);

    const [, rpcPayload] = rpcMock.mock.calls[0] as [string, { _snapshot: { items: Array<Record<string, unknown>> } }];
    const rows = rpcPayload._snapshot.items;
    expect(rows).toHaveLength(2);
    // Ordem preservada
    expect(rows[0].sort_order).toBe(0);
    expect(rows[1].sort_order).toBe(1);
    // Quantidade clampeada ao teto
    expect(rows[1].quantity).toBe(MAX_ITEM_QUANTITY);
    // Piso respeitado (item[0] com qty=10 permanece)
    expect(rows[0].quantity).toBeGreaterThanOrEqual(MIN_ITEM_QUANTITY);
    expect(rows[0].quantity).toBe(10);
    // O payload da RPC nunca envia cart_id de item antigo.
    expect('cart_id' in rows[0]).toBe(false);
  });

  it('Snapshot sem itens envia items vazio e NÃO chama fallback de INSERT', async () => {
    rpcMock.mockResolvedValue({
      data: { cart_id: 'new-empty', items_total: 0, items_inserted: 0, items_deduped: 0 },
      error: null,
    });

    const { result } = renderHook(() => useSellerCarts(), { wrapper });
    await waitFor(() => expect(result.current.restoreCartWithItems).toBeTruthy());

    await result.current.restoreCartWithItems.mutateAsync({
      ...BASE_SNAPSHOT,
      items: [],
    });

    const [, rpcPayload] = rpcMock.mock.calls[0] as [string, { _snapshot: { items: unknown[] } }];
    expect(rpcPayload._snapshot.items).toEqual([]);
    expect(insertCalls).toEqual([]);
  });

  it('fallback quando RPC não existe restaura cart + itens deduplicados', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: 'PGRST202',
        message: 'Could not find the function public.restore_seller_cart in the schema cache',
      },
    });

    const { result } = renderHook(() => useSellerCarts(), { wrapper });
    await waitFor(() => expect(result.current.restoreCartWithItems).toBeTruthy());

    const restored = await result.current.restoreCartWithItems.mutateAsync({
      ...BASE_SNAPSHOT,
      items: [BASE_SNAPSHOT.items[0], { ...BASE_SNAPSHOT.items[0], id: 'dup-null', quantity: 4 }],
    });

    expect(restored?.id).toBe('fallback-cart-id-123');
    const cartInsert = insertCalls.find((c) => c.table === 'seller_carts');
    const itemsInsert = insertCalls.find((c) => c.table === 'seller_cart_items');
    expect(cartInsert).toBeTruthy();
    expect(itemsInsert).toBeTruthy();
    const itemRows = itemsInsert!.payload as Array<Record<string, unknown>>;
    expect(itemRows).toHaveLength(1);
    expect(itemRows[0].cart_id).toBe('fallback-cart-id-123');
    expect(itemRows[0].quantity).toBe(14);
    expect(restored?.restore_metrics).toEqual({
      items_total: 1,
      items_inserted: 1,
      items_deduped: 1,
    });
  });

  it('deleteCart resolve com snapshot hidratado do servidor antes de remover', async () => {
    const { result } = renderHook(() => useSellerCarts(), { wrapper });
    await waitFor(() => expect(result.current.deleteCart).toBeTruthy());

    const deletedSnapshot = await result.current.deleteCart.mutateAsync(BASE_SNAPSHOT.id);

    expect(deletedSnapshot.id).toBe(BASE_SNAPSHOT.id);
    expect(deletedSnapshot.items).toHaveLength(2);
    expect(deletedSnapshot.items[0].product_id).toBe('prod-1');
    expect(deleteCalls.some((call) => call.table === 'seller_carts')).toBe(true);
  });
});
