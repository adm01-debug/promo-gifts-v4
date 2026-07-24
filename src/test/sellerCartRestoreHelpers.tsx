/**
 * sellerCartRestoreHelpers — SSOT de builders/asserts para testes de
 * telemetria do fluxo `delete → undo` do SellerCartContext.
 *
 * O que MORA aqui (compartilhável):
 *   - Constantes canônicas (`TEST_USER_ID`, `TEST_CART_ID`, `RESTORE_SCOPE`).
 *   - Builders de "linha hidratada" que a `.select('*, seller_cart_items(*)').maybeSingle()`
 *     do mock supabase devolve (`buildHydratedRow`, `buildEmptyHydratedRow`).
 *   - Wrapper de render (`makeWrap`) + `mountSellerCart()` que resolve o
 *     `useSellerCartContext` já hidratado.
 *   - Atalhos para consultar o buffer do `mockStructuredLogger` no scope de
 *     restore (`findRestore`, `filterRestore`, `restoreSequence`).
 *   - `assertConsistentSnapshotId` — invariante da cadeia delete→undo.
 *   - `rpcOk` / `rpcErr` — fabricam o shape que a RPC `restore_seller_cart`
 *     devolve em sucesso/erro (evita repetir literais nos casos).
 *
 * O que NÃO mora aqui (por design):
 *   - `vi.mock('@/integrations/supabase/client', ...)` — o `vi.mock` é hoisted
 *     por arquivo e precisa referenciar o `hydratedRow` mutável local do teste.
 *     Cada test file mantém seu próprio bloco de mock; este helper apenas
 *     alimenta os builders que abastecem esse mock.
 *   - Mocks de `sonner`, `AuthContext`, `useDebouncedCartItemActions` — idem.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { expect } from 'vitest';
import {
  filterLoggerEvents,
  findLoggerEvent,
  findLoggerEventsByScope,
  type CapturedLogEvent,
} from '@/test/mockStructuredLogger';
import {
  SellerCartProvider,
  useSellerCartContext,
} from '@/contexts/SellerCartContext';

export const RESTORE_SCOPE = 'seller_cart.restore';
export const TEST_USER_ID = 'seller-test';
export const TEST_CART_ID = 'cart-test-42';

/** Item canônico "Caneta" — 2 unidades, sort 0. */
export function buildItem1(cartId = TEST_CART_ID) {
  return {
    id: 'item-1',
    cart_id: cartId,
    product_id: 'prod-1',
    product_name: 'Caneta',
    product_sku: null,
    product_image_url: null,
    product_price: 5,
    quantity: 2,
    color_name: null,
    color_hex: null,
    notes: null,
    sort_order: 0,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };
}

/** Item canônico "Caneca" — 1 unidade, sort 1. */
export function buildItem2(cartId = TEST_CART_ID) {
  return {
    id: 'item-2',
    cart_id: cartId,
    product_id: 'prod-2',
    product_name: 'Caneca',
    product_sku: null,
    product_image_url: null,
    product_price: 10,
    quantity: 1,
    color_name: null,
    color_hex: null,
    notes: null,
    sort_order: 1,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };
}

/** Pareamento default (2 itens) — coerente com todos os testes atuais. */
export function buildHydratedItems(cartId = TEST_CART_ID) {
  return [buildItem1(cartId), buildItem2(cartId)];
}

/**
 * Snapshot completo devolvido pelo mock supabase para
 * `.select('*, seller_cart_items(*)').maybeSingle()`.
 * Aceita `overrides` para sobrescrever campos pontuais (ex.: trocar items).
 */
export function buildHydratedRow(
  overrides: Record<string, unknown> = {},
  cartId = TEST_CART_ID,
  userId = TEST_USER_ID,
): Record<string, unknown> {
  return {
    id: cartId,
    seller_id: userId,
    company_id: 'c1',
    company_name: 'ACME',
    company_location: null,
    company_logo_url: null,
    notes: null,
    status: 'em_separacao',
    shipping_deadline: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    seller_cart_items: buildHydratedItems(cartId),
    ...overrides,
  };
}

/** Variante do row com `seller_cart_items: []` — aciona a guarda anti-vazio. */
export function buildEmptyHydratedRow(
  cartId = TEST_CART_ID,
  userId = TEST_USER_ID,
): Record<string, unknown> {
  return buildHydratedRow({ seller_cart_items: [] }, cartId, userId);
}

/** Wrapper de render — QueryClient + SellerCartProvider isolados por teste. */
export function makeWrap() {
  return function Wrap({ children }: { children: ReactNode }) {
    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    return (
      <QueryClientProvider client={qc}>
        <SellerCartProvider>{children}</SellerCartProvider>
      </QueryClientProvider>
    );
  };
}

/** Monta o provider e aguarda o context estabilizar. */
export async function mountSellerCart() {
  const wrapper = makeWrap();
  const { result } = renderHook(() => useSellerCartContext(), { wrapper });
  await waitFor(() => expect(result.current).toBeTruthy());
  return result;
}

/** Atalhos de consulta no buffer do `mockStructuredLogger`. */
export const findRestore = (event: string) =>
  findLoggerEvent(RESTORE_SCOPE, event);
export const filterRestore = (event: string) =>
  filterLoggerEvents(RESTORE_SCOPE, event);
export const restoreSequence = (): string[] =>
  findLoggerEventsByScope(RESTORE_SCOPE).map((e) => e.event);

/**
 * Verifica que TODOS os eventos passados carregam o mesmo `snapshot_id`.
 * Invariante da cadeia delete → restore_start → restore_ok|failed|skipped.
 */
export function assertConsistentSnapshotId(
  events: (CapturedLogEvent | undefined)[],
  expectedId: string,
): void {
  for (const ev of events) {
    expect(ev, 'evento não emitido').toBeTruthy();
    expect(ev!.fields.snapshot_id).toBe(expectedId);
  }
}

/** Shape do sucesso da RPC `restore_seller_cart`. */
export function rpcOk({
  cartId = 'restored-x',
  itemsTotal = 2,
  itemsInserted = 2,
  itemsDeduped = 0,
}: {
  cartId?: string;
  itemsTotal?: number;
  itemsInserted?: number;
  itemsDeduped?: number;
} = {}) {
  return {
    data: {
      cart_id: cartId,
      items_total: itemsTotal,
      items_inserted: itemsInserted,
      items_deduped: itemsDeduped,
    },
    error: null as unknown,
  };
}

/** Shape do erro da RPC `restore_seller_cart`. */
export function rpcErr(
  error: Record<string, unknown> = { message: 'boom', code: '23505' },
) {
  return { data: null as unknown, error };
}
