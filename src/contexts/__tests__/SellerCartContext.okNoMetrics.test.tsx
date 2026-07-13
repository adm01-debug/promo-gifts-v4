/**
 * Testes de integração — desfecho `restore_result: 'ok_no_metrics'`.
 *
 * Este é o ramo DEFENSIVO do `restoreCart` (SellerCartContext) que dispara
 * quando `restoreCartWithItems.mutateAsync` devolve um `RestoredSellerCart`
 * SEM o campo `restore_metrics` — cenário atualmente inalcançável pelo
 * caminho de produção (o mutation sempre popula métricas), mas mantido no
 * schema para lidar com:
 *   - schema legado da RPC que não devolve contagens;
 *   - fallback client-side simplificado (feature-flag futura);
 *   - regressão silenciosa no shape da resposta.
 *
 * Para exercitá-lo, mockamos `@/hooks/products/useSellerCarts` diretamente
 * e devolvemos um objeto "cru" sem `restore_metrics`. Verificamos:
 *   - `restore_result === 'ok_no_metrics'`
 *   - `items_inserted === null` (não veio da RPC)
 *   - `items_deduped === null`
 *   - `items_resulting` cai no fallback `created.items.length`
 *   - `items_mismatch` reflete `itemsResulting !== itemsCount`
 *   - `duration_ms` é numérico e >= 0
 *   - `has_dedup === false` e `partial_insert === false` (sem métricas)
 *   - `correlation_id` propagado do snapshot para o `restore_ok`
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const USER_ID = 'seller-nometrics';
const CART_ID = 'cart-nometrics-1';
const NEW_CART_ID = 'cart-nometrics-2';

// Telemetria capturada via helper SSOT.
vi.mock('@/lib/telemetry/structuredLogger', async () => {
  const mod = await import('@/test/mockStructuredLogger');
  return mod.structuredLoggerMockFactory();
});

// Mock direto do hook `useSellerCarts` — devolve um objeto com o shape mínimo
// que o `SellerCartProvider` consome. Todas as mutations são stubs; só
// `restoreCartWithItems.mutateAsync` importa para este teste.
const restoreMutateAsync = vi.fn();
const deleteMutateAsync = vi.fn();

// Helper: fabrica um "mutation-like" stub para satisfazer o destructuring do
// provider (`mutateAsync`, `mutate`, `isPending`, `reset`, `data`, etc.).
function stubMutation<TArg = unknown, TRet = unknown>(
  impl?: (arg: TArg) => Promise<TRet> | TRet,
) {
  const fn = impl ?? ((async () => undefined) as (arg: TArg) => Promise<TRet>);
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn(fn),
    isPending: false,
    isError: false,
    isSuccess: false,
    reset: vi.fn(),
    data: undefined,
    error: null,
  };
}

vi.mock('@/hooks/products/useSellerCarts', () => ({
  useSellerCarts: () => ({
    carts: [],
    isLoading: false,
    totalItems: 0,
    canCreateCart: true,
    createCart: stubMutation(),
    deleteCart: { ...stubMutation(), mutateAsync: deleteMutateAsync },
    addItem: stubMutation(),
    removeItem: stubMutation(),
    updateItemQuantity: stubMutation(),
    updateItemNotes: stubMutation(),
    updateItemSortOrder: stubMutation(),
    updateCartNotes: stubMutation(),
    updateCartStatus: stubMutation(),
    updateCartShippingDeadline: stubMutation(),
    duplicateCart: stubMutation(),
    moveItemToCart: stubMutation(),
    duplicateItemToCart: stubMutation(),
    clearCart: stubMutation(),
    restoreItems: stubMutation(),
    restoreCartWithItems: { ...stubMutation(), mutateAsync: restoreMutateAsync },
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: USER_ID } }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/lib/security/sanitize-error', () => ({
  sanitizeError: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

vi.mock('@/hooks/products/useDebouncedCartItemActions', () => ({
  useDebouncedCartItemActions: () => ({
    updateItemQuantity: vi.fn(),
    removeItem: vi.fn(),
    itemErrors: {},
    clearItemError: vi.fn(),
  }),
  getCartItemDebounceMs: () => 0,
}));

import {
  resetStructuredLoggerMock,
  findLoggerEvent,
} from '@/test/mockStructuredLogger';
import { SellerCartProvider, useSellerCartContext } from '../SellerCartContext';

function Wrap({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={qc}>
      <SellerCartProvider>{children}</SellerCartProvider>
    </QueryClientProvider>
  );
}

const ITEMS = [
  {
    id: 'i1',
    cart_id: CART_ID,
    product_id: 'p1',
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
  },
  {
    id: 'i2',
    cart_id: CART_ID,
    product_id: 'p2',
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
  },
];

const SNAPSHOT_BASE = {
  id: CART_ID,
  seller_id: USER_ID,
  company_id: 'c1',
  company_name: 'ACME',
  company_location: null,
  company_logo_url: null,
  notes: null,
  status: 'em_separacao' as const,
  shipping_deadline: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  items: ITEMS,
};

const findRestore = (event: string) =>
  findLoggerEvent('seller_cart.restore', event);

describe('SellerCartContext — restore_result: ok_no_metrics', () => {
  beforeEach(() => {
    restoreMutateAsync.mockReset();
    deleteMutateAsync.mockReset();
    resetStructuredLoggerMock();
  });

  it('classifica `ok_no_metrics` quando o mutation devolve resultado SEM `restore_metrics`', async () => {
    // Mutation devolve um `RestoredSellerCart` cru — SEM `restore_metrics`.
    // Isso força o ramo `restoreResult = 'ok_no_metrics'` na linha
    // do SellerCartContext que classifica o desfecho por presença de métricas.
    restoreMutateAsync.mockResolvedValue({
      id: NEW_CART_ID,
      seller_id: USER_ID,
      company_id: 'c1',
      company_name: 'ACME',
      company_location: null,
      company_logo_url: null,
      notes: null,
      status: 'em_separacao',
      shipping_deadline: null,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
      items: ITEMS, // 2 itens — fallback para `items_resulting`.
      // restore_metrics: AUSENTE de propósito.
    });

    const { result } = renderHook(() => useSellerCartContext(), { wrapper: Wrap });
    await waitFor(() => expect(result.current).toBeTruthy());

    const PRESET_CID = 'cid-nometrics-fixed';
    await act(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const returned = await result.current.restoreCart({
        ...SNAPSHOT_BASE,
        _correlation_id: PRESET_CID,
      } as any);
      expect(returned).toBe(NEW_CART_ID);
    });

    const ok = findRestore('restore_ok');
    expect(ok, 'restore_ok deve ser emitido').toBeTruthy();
    expect(ok!.level).toBe('info');
    expect(ok!.fields).toMatchObject({
      restore_result: 'ok_no_metrics',
      snapshot_id: CART_ID,
      new_cart_id: NEW_CART_ID,
      correlation_id: PRESET_CID,
      // Sem métricas — nulos por schema uniforme.
      items_inserted: null,
      items_deduped: null,
      // items_total cai no fallback do snapshot original (2 itens).
      items_total: 2,
      // items_resulting cai no fallback `created.items.length` (2).
      items_resulting: 2,
      // 2 === 2 → sem mismatch.
      items_mismatch: false,
      hydrated: true,
      has_dedup: false,
      partial_insert: false,
    });
    // duration_ms preenchido, numérico, >= 0.
    expect(typeof ok!.fields.duration_ms).toBe('number');
    expect(ok!.fields.duration_ms as number).toBeGreaterThanOrEqual(0);

    // Sanity: RPC-wrapping do mutation foi chamada exatamente uma vez.
    expect(restoreMutateAsync).toHaveBeenCalledTimes(1);
    // Não emitiu desfechos de erro / skip.
    expect(findRestore('restore_failed')).toBeUndefined();
    expect(findRestore('restore_skipped_empty_snapshot')).toBeUndefined();
  });

  it('ok_no_metrics + items divergentes: items_mismatch=true quando `created.items.length` !== snapshot.items.length', async () => {
    // O mutation devolve um `created.items` MENOR que o snapshot original
    // (2 → 1). Sem métricas para dizer o que foi inserido, o fallback usa
    // `created.items.length` e o `items_mismatch` DEVE acender (regressão
    // silenciosa: RLS parcial ou ON CONFLICT descartou linhas).
    restoreMutateAsync.mockResolvedValue({
      id: NEW_CART_ID,
      seller_id: USER_ID,
      company_id: 'c1',
      company_name: 'ACME',
      company_location: null,
      company_logo_url: null,
      notes: null,
      status: 'em_separacao',
      shipping_deadline: null,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
      items: [ITEMS[0]], // apenas 1 dos 2 itens do snapshot original.
    });

    const { result } = renderHook(() => useSellerCartContext(), { wrapper: Wrap });
    await waitFor(() => expect(result.current).toBeTruthy());

    await act(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await result.current.restoreCart(SNAPSHOT_BASE as any);
    });

    const ok = findRestore('restore_ok');
    expect(ok!.fields).toMatchObject({
      restore_result: 'ok_no_metrics',
      items_total: 2,
      items_resulting: 1,
      items_mismatch: true, // 1 !== 2 — alerta acende para dashboards.
      items_inserted: null,
      items_deduped: null,
    });
  });
});
