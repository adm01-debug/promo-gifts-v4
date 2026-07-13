/**
 * Testes de integração — fluxo `delete → undo` do SellerCartContext.
 *
 * Cobre a telemetria estruturada emitida pelos hooks/contexto:
 *
 *   1. `deleteCart` dispara `[seller_cart.restore:delete_ok]` com:
 *      - `snapshot_id` = id do carrinho deletado (não o cartId "cru");
 *      - `hydrated: true`  quando o snapshot volta do servidor com >= 1 item;
 *      - `hydrated: false` quando o snapshot volta sem itens;
 *      - `correlation_id` presente (propagado no snapshot devolvido).
 *
 *   2. `restoreCart` dispara `[seller_cart.restore:restore_start]` com:
 *      - `snapshot_id` idêntico ao do `delete_ok`;
 *      - `hydrated: true` (a guarda anti-vazio já bloqueou snapshot vazio);
 *      - `correlation_id` idêntico ao emitido em `delete_ok`.
 *
 *   3. Snapshot hidratado com 0 itens NÃO chama a RPC de restore e emite
 *      `[seller_cart.restore:restore_skipped_empty_snapshot]` em `console.warn`.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const USER_ID = 'seller-x';
const CART_ID = 'cart-to-delete-42';

// Telemetria capturada via helper compartilhado (`mockStructuredLogger`) —
// evita duplicar o factory de captura em cada arquivo de teste de logger.
vi.mock('@/lib/telemetry/structuredLogger', async () => {
  const mod = await import('@/test/mockStructuredLogger');
  return mod.structuredLoggerMockFactory();
});

import {
  resetStructuredLoggerMock,
  findLoggerEvent,
} from '@/test/mockStructuredLogger';

const rpcMock = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();


// Snapshot que o servidor devolve em `.select('*, seller_cart_items(*)').maybeSingle()`.
// É reatribuído em cada teste para simular hidratação parcial vs. completa.
let hydratedRow: Record<string, unknown> | null = null;

vi.mock('@/integrations/supabase/client', () => {
  const buildSelectMaybeSingle = () => ({
    eq: () => buildSelectMaybeSingle(),
    order: () => buildSelectMaybeSingle(),
    maybeSingle: () => Promise.resolve({ data: hydratedRow, error: null }),
  });

  const buildDeleteChain = () => {
    const chain = {
      eq: () => chain,
      select: () =>
        Promise.resolve({ data: [{ id: CART_ID }], error: null }),
    };
    return chain;
  };

  const buildEmptySelectChain = () => ({
    eq: () => ({
      order: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
    }),
  });

  return {
    supabase: {
      rpc: (...args: unknown[]) => rpcMock(...args),
      from: (_table: string) => ({
        select: (columns?: string) => {
          if (columns === '*, seller_cart_items(*)') {
            return buildSelectMaybeSingle();
          }
          return buildEmptySelectChain();
        },
        delete: () => buildDeleteChain(),
      }),
      auth: {
        getUser: async () => ({ data: { user: { id: USER_ID } }, error: null }),
      },
    },
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: USER_ID } }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/lib/security/sanitize-error', () => ({
  sanitizeError: (e: unknown) =>
    e instanceof Error ? e.message : String(e),
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

const HYDRATED_ITEMS = [
  {
    id: 'item-1',
    cart_id: CART_ID,
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
  },
  {
    id: 'item-2',
    cart_id: CART_ID,
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
  },
];

const HYDRATED_ROW_FULL = {
  id: CART_ID,
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
  seller_cart_items: HYDRATED_ITEMS,
};

const HYDRATED_ROW_EMPTY = {
  ...HYDRATED_ROW_FULL,
  seller_cart_items: [],
};

// Adaptador local: preserva `findEvent(name)` que os casos existentes usam.
const findEvent = (name: string) =>
  findLoggerEvent('seller_cart.restore', name);

describe('SellerCartContext — telemetria integrada do fluxo delete→undo', () => {
  const originalError = console.error;

  beforeEach(() => {
    rpcMock.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
    hydratedRow = HYDRATED_ROW_FULL;
    resetStructuredLoggerMock();
    console.error = vi.fn();
  });

  it('emite `delete_ok` com hydrated=true e snapshot_id correto quando o snapshot tem itens', async () => {
    rpcMock.mockResolvedValue({
      data: { cart_id: 'restored-1', items_total: 2, items_inserted: 2, items_deduped: 0 },
      error: null,
    });

    const { result } = renderHook(() => useSellerCartContext(), { wrapper: Wrap });
    await waitFor(() => expect(result.current).toBeTruthy());

    await act(async () => {
      const snapshot = await result.current.deleteCart(CART_ID);
      // Sanity: o snapshot voltou hidratado do "servidor".
      expect(snapshot.items).toHaveLength(2);
    });

    const deleteOk = findEvent('delete_ok');
    expect(deleteOk, '`delete_ok` deve ter sido emitido').toBeTruthy();
    expect(deleteOk!.fields).toMatchObject({
      snapshot_id: CART_ID,
      items_total: 2,
      hydrated: true,
    });
    expect(typeof deleteOk!.fields.correlation_id).toBe('string');
    expect((deleteOk!.fields.correlation_id as string).length).toBeGreaterThan(0);
  });

  it('emite `delete_ok` com hydrated=false quando o snapshot volta sem itens', async () => {
    hydratedRow = HYDRATED_ROW_EMPTY;

    const { result } = renderHook(() => useSellerCartContext(), { wrapper: Wrap });
    await waitFor(() => expect(result.current).toBeTruthy());

    await act(async () => {
      const snapshot = await result.current.deleteCart(CART_ID);
      expect(snapshot.items).toHaveLength(0);
    });

    const deleteOk = findEvent('delete_ok');
    expect(deleteOk!.fields).toMatchObject({
      snapshot_id: CART_ID,
      items_total: 0,
      hydrated: false,
    });
  });

  it('emite `restore_start` com hydrated=true, snapshot_id correto e MESMO correlation_id do delete_ok', async () => {
    rpcMock.mockResolvedValue({
      data: { cart_id: 'restored-2', items_total: 2, items_inserted: 2, items_deduped: 0 },
      error: null,
    });

    const { result } = renderHook(() => useSellerCartContext(), { wrapper: Wrap });
    await waitFor(() => expect(result.current).toBeTruthy());

    await act(async () => {
      const deletedSnapshot = await result.current.deleteCart(CART_ID);
      await result.current.restoreCart(deletedSnapshot);
    });

    const deleteOk = findEvent('delete_ok');
    const restoreStart = findEvent('restore_start');

    expect(deleteOk, '`delete_ok` deve ter sido emitido').toBeTruthy();
    expect(restoreStart, '`restore_start` deve ter sido emitido').toBeTruthy();

    expect(restoreStart!.fields).toMatchObject({
      snapshot_id: CART_ID,
      items_total: 2,
      hydrated: true,
    });

    // Invariante central: correlation_id atravessa delete_ok → restore_start.
    expect(restoreStart!.fields.correlation_id).toBe(deleteOk!.fields.correlation_id);

    // E a RPC de fato foi chamada — não caiu na guarda anti-vazio.
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock.mock.calls[0][0]).toBe('restore_seller_cart');
  });

  it('snapshot vazio pula RPC, emite `restore_skipped_empty_snapshot` e NUNCA emite `restore_start`', async () => {
    hydratedRow = HYDRATED_ROW_EMPTY;

    const { result } = renderHook(() => useSellerCartContext(), { wrapper: Wrap });
    await waitFor(() => expect(result.current).toBeTruthy());

    await act(async () => {
      const deletedSnapshot = await result.current.deleteCart(CART_ID);
      const returned = await result.current.restoreCart(deletedSnapshot);
      expect(returned).toBeUndefined();
    });

    // Guarda ativou: RPC nunca chamada.
    expect(rpcMock).not.toHaveBeenCalled();

    const skipped = findEvent('restore_skipped_empty_snapshot');
    expect(skipped, '`restore_skipped_empty_snapshot` deve ter sido emitido').toBeTruthy();
    expect(skipped!.level).toBe('warn');
    expect(skipped!.fields).toMatchObject({
      snapshot_id: CART_ID,
      items_total: 0,
      hydrated: false,
      restore_result: 'skipped_empty',
    });

    // E `restore_start` NÃO deve aparecer no fluxo abortado.
    expect(findEvent('restore_start')).toBeUndefined();
  });

  it('correlation_id de delete_ok é propagado pelo snapshot devolvido', async () => {
    rpcMock.mockResolvedValue({
      data: { cart_id: 'restored-3', items_total: 2, items_inserted: 2, items_deduped: 0 },
      error: null,
    });
    const { result } = renderHook(() => useSellerCartContext(), { wrapper: Wrap });
    await waitFor(() => expect(result.current).toBeTruthy());

    let snapshotCorrelation: string | undefined;
    await act(async () => {
      const deleted = await result.current.deleteCart(CART_ID);
      snapshotCorrelation = (deleted as { _correlation_id?: string })._correlation_id;
    });

    const deleteOk = findEvent('delete_ok');
    expect(snapshotCorrelation).toBeTruthy();
    expect(snapshotCorrelation).toBe(deleteOk!.fields.correlation_id);
  });

  afterAll(() => {
    console.error = originalError;
  });
});

