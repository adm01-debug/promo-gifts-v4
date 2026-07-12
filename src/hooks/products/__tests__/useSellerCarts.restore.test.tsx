/**
 * Unit test — restoreCartWithItems: allowlist estrita do payload de INSERT.
 *
 * Garante que:
 *  1) O INSERT em `seller_carts` inclui APENAS campos semânticos + seller_id;
 *     nunca vaza `id`, `seller_id` do snapshot, `created_at`, `updated_at`,
 *     `items`, ou qualquer chave inesperada do objeto.
 *  2) O INSERT em `seller_cart_items` respeita `sort_order` e clampeia quantidades
 *     fora de [MIN_ITEM_QUANTITY, MAX_ITEM_QUANTITY].
 *  3) Snapshot sem itens (`items: []`) NÃO chama INSERT em `seller_cart_items`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// Mock do supabase client — captura payloads.
const insertCalls: Array<{ table: string; payload: unknown }> = [];

vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      from: (table: string) => {
        const chain = {
          insert: (payload: unknown) => {
            insertCalls.push({ table, payload });
            return {
              select: () => ({
                single: () =>
                  Promise.resolve({
                    data: { id: 'new-cart-id-123', seller_id: 'seller-x' },
                    error: null,
                  }),
              }),
              // seller_cart_items usa insert direto (sem .select().single())
              then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
            };
          },
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
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

import { useSellerCarts, MAX_ITEM_QUANTITY, MIN_ITEM_QUANTITY, type SellerCart } from '@/hooks/products/useSellerCarts';

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

describe('useSellerCarts.restoreCartWithItems — allowlist do payload', () => {
  beforeEach(() => {
    insertCalls.length = 0;
  });

  it('INSERT em seller_carts inclui APENAS campos permitidos', async () => {
    const { result } = renderHook(() => useSellerCarts(), { wrapper });

    await waitFor(() => expect(result.current.restoreCartWithItems).toBeTruthy());

    await result.current.restoreCartWithItems.mutateAsync(BASE_SNAPSHOT);

    const cartInsert = insertCalls.find((c) => c.table === 'seller_carts');
    expect(cartInsert, 'INSERT em seller_carts deve ter sido chamado').toBeTruthy();

    const payload = cartInsert!.payload as Record<string, unknown>;
    const ALLOWED = new Set([
      'seller_id',
      'company_id',
      'company_name',
      'company_location',
      'company_logo_url',
      'notes',
      'status',
      'shipping_deadline',
    ]);
    const FORBIDDEN = ['id', 'created_at', 'updated_at', 'items'];

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

  it('INSERT em seller_cart_items preserva sort_order e clampeia quantity', async () => {
    const { result } = renderHook(() => useSellerCarts(), { wrapper });
    await waitFor(() => expect(result.current.restoreCartWithItems).toBeTruthy());

    await result.current.restoreCartWithItems.mutateAsync(BASE_SNAPSHOT);

    const itemsInsert = insertCalls.find((c) => c.table === 'seller_cart_items');
    expect(itemsInsert, 'INSERT em seller_cart_items deve ter sido chamado').toBeTruthy();
    const rows = itemsInsert!.payload as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    // Ordem preservada
    expect(rows[0].sort_order).toBe(0);
    expect(rows[1].sort_order).toBe(1);
    // Quantidade clampeada ao teto
    expect(rows[1].quantity).toBe(MAX_ITEM_QUANTITY);
    // Piso respeitado (item[0] com qty=10 permanece)
    expect(rows[0].quantity).toBeGreaterThanOrEqual(MIN_ITEM_QUANTITY);
    expect(rows[0].quantity).toBe(10);
    // cart_id aponta para o NOVO carrinho, não o antigo do snapshot.
    expect(rows[0].cart_id).toBe('new-cart-id-123');
    expect(rows[0].cart_id).not.toBe(BASE_SNAPSHOT.id);
  });

  it('Snapshot sem itens NÃO chama INSERT em seller_cart_items', async () => {
    const { result } = renderHook(() => useSellerCarts(), { wrapper });
    await waitFor(() => expect(result.current.restoreCartWithItems).toBeTruthy());

    await result.current.restoreCartWithItems.mutateAsync({
      ...BASE_SNAPSHOT,
      items: [],
    });

    const cartInsert = insertCalls.find((c) => c.table === 'seller_carts');
    const itemsInsert = insertCalls.find((c) => c.table === 'seller_cart_items');
    expect(cartInsert).toBeTruthy();
    expect(itemsInsert, 'seller_cart_items NÃO deveria ter sido chamado').toBeUndefined();
  });
});
