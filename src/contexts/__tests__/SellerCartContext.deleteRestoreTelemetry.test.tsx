/**
 * Testes de integração — fluxo `delete → undo` do SellerCartContext.
 *
 * Cobre a telemetria estruturada dos primeiros eventos da cadeia:
 *   1. `delete_ok` com `snapshot_id`, `hydrated`, `correlation_id`.
 *   2. `restore_start` herdando o MESMO `correlation_id`.
 *   3. Snapshot vazio → `restore_skipped_empty_snapshot` e RPC bloqueada.
 *
 * Builders/mount/asserts vivem no helper SSOT `sellerCartRestoreHelpers`
 * para eliminar duplicação com `SellerCartContext.restoreTelemetry.test.tsx`.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { act } from '@testing-library/react';

vi.mock('@/lib/telemetry/structuredLogger', async () => {
  const mod = await import('@/test/mockStructuredLogger');
  return mod.structuredLoggerMockFactory();
});

import { resetStructuredLoggerMock } from '@/test/mockStructuredLogger';
import {
  TEST_USER_ID,
  TEST_CART_ID,
  buildHydratedRow,
  buildEmptyHydratedRow,
  mountSellerCart,
  findRestore,
  rpcOk,
} from '@/test/sellerCartRestoreHelpers';

const rpcMock = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();

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
      select: () => Promise.resolve({ data: [{ id: TEST_CART_ID }], error: null }),
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
          if (columns === '*, seller_cart_items(*)') return buildSelectMaybeSingle();
          return buildEmptySelectChain();
        },
        delete: () => buildDeleteChain(),
      }),
      auth: {
        // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
        getUser: async () => ({ data: { user: { id: TEST_USER_ID } }, error: null }),
      },
    },
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: TEST_USER_ID } }),
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

describe('SellerCartContext — telemetria integrada do fluxo delete→undo', () => {
  const originalError = console.error;

  beforeEach(() => {
    rpcMock.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
    hydratedRow = buildHydratedRow();
    resetStructuredLoggerMock();
    console.error = vi.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  it('emite `delete_ok` com hydrated=true e snapshot_id correto quando o snapshot tem itens', async () => {
    rpcMock.mockResolvedValue(rpcOk({ cartId: 'restored-1' }));
    const result = await mountSellerCart();

    await act(async () => {
      const snapshot = await result.current.deleteCart(TEST_CART_ID);
      expect(snapshot.items).toHaveLength(2);
    });

    const deleteOk = findRestore('delete_ok');
    expect(deleteOk, '`delete_ok` deve ter sido emitido').toBeTruthy();
    expect(deleteOk!.fields).toMatchObject({
      snapshot_id: TEST_CART_ID,
      items_total: 2,
      hydrated: true,
    });
    expect(typeof deleteOk!.fields.correlation_id).toBe('string');
    expect((deleteOk!.fields.correlation_id as string).length).toBeGreaterThan(0);
  });

  it('emite `delete_ok` com hydrated=false quando o snapshot volta sem itens', async () => {
    hydratedRow = buildEmptyHydratedRow();
    const result = await mountSellerCart();

    await act(async () => {
      const snapshot = await result.current.deleteCart(TEST_CART_ID);
      expect(snapshot.items).toHaveLength(0);
    });

    const deleteOk = findRestore('delete_ok');
    expect(deleteOk!.fields).toMatchObject({
      snapshot_id: TEST_CART_ID,
      items_total: 0,
      hydrated: false,
    });
  });

  it('emite `restore_start` com hydrated=true, snapshot_id correto e MESMO correlation_id do delete_ok', async () => {
    rpcMock.mockResolvedValue(rpcOk({ cartId: 'restored-2' }));
    const result = await mountSellerCart();

    await act(async () => {
      const deletedSnapshot = await result.current.deleteCart(TEST_CART_ID);
      await result.current.restoreCart(deletedSnapshot);
    });

    const deleteOk = findRestore('delete_ok');
    const restoreStart = findRestore('restore_start');
    expect(deleteOk).toBeTruthy();
    expect(restoreStart).toBeTruthy();
    expect(restoreStart!.fields).toMatchObject({
      snapshot_id: TEST_CART_ID,
      items_total: 2,
      hydrated: true,
    });
    expect(restoreStart!.fields.correlation_id).toBe(deleteOk!.fields.correlation_id);
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock.mock.calls[0][0]).toBe('restore_seller_cart');
  });

  it('snapshot vazio pula RPC, emite `restore_skipped_empty_snapshot` e NUNCA emite `restore_start`', async () => {
    hydratedRow = buildEmptyHydratedRow();
    const result = await mountSellerCart();

    await act(async () => {
      const deletedSnapshot = await result.current.deleteCart(TEST_CART_ID);
      const returned = await result.current.restoreCart(deletedSnapshot);
      expect(returned).toBeUndefined();
    });

    expect(rpcMock).not.toHaveBeenCalled();

    const skipped = findRestore('restore_skipped_empty_snapshot');
    expect(skipped, '`restore_skipped_empty_snapshot` deve ter sido emitido').toBeTruthy();
    expect(skipped!.level).toBe('warn');
    expect(skipped!.fields).toMatchObject({
      snapshot_id: TEST_CART_ID,
      items_total: 0,
      hydrated: false,
      restore_result: 'skipped_empty',
    });
    expect(findRestore('restore_start')).toBeUndefined();
  });

  it('correlation_id de delete_ok é propagado pelo snapshot devolvido', async () => {
    rpcMock.mockResolvedValue(rpcOk({ cartId: 'restored-3' }));
    const result = await mountSellerCart();

    let snapshotCorrelation: string | undefined;
    await act(async () => {
      const deleted = await result.current.deleteCart(TEST_CART_ID);
      snapshotCorrelation = (deleted as { _correlation_id?: string })._correlation_id;
    });

    const deleteOk = findRestore('delete_ok');
    expect(snapshotCorrelation).toBeTruthy();
    expect(snapshotCorrelation).toBe(deleteOk!.fields.correlation_id);
  });
});
