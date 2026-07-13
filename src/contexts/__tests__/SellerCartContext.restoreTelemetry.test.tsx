/**
 * Testes de integração — telemetria do `restoreCart` (Undo) do SellerCartContext.
 *
 * Complementa `SellerCartContext.deleteRestoreTelemetry.test.tsx`:
 *   - Valida `restore_ok` e `restore_failed` com `correlation_id` propagado,
 *     `items_resulting` populado nos dois desfechos e `items_mismatch` refletindo
 *     a divergência (quando houver) entre snapshot enviado e itens resultantes.
 *   - Valida a classificação `restore_result` para os desfechos alcançáveis
 *     pelo caminho de produção: `success | partial | deduped | failed | skipped_empty`.
 *     (`ok_no_metrics` só é alcançável se `restoreCartWithItemsMutation` devolver
 *     um snapshot sem `restore_metrics` — hoje o mutation sempre popula esse
 *     campo, então o ramo é defensivo e não é exercido aqui.)
 *   - Valida que `duration_ms` está preenchido (>= 0, número) nos casos que
 *     invocam a RPC (`restore_ok`/`restore_failed`) e zerado (`0`) no atalho
 *     `restore_skipped_empty_snapshot`.
 *   - E2E LÓGICO: exercita o fluxo completo `delete → undo` e valida a
 *     SEQUÊNCIA canônica dos eventos (`delete_ok → restore_start → restore_ok`
 *     ou `→ restore_failed` ou `→ restore_skipped_empty_snapshot`) com
 *     `snapshot_id` e `correlation_id` consistentes ao longo da cadeia.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const USER_ID = 'seller-y';
const CART_ID = 'cart-to-restore-99';

vi.mock('@/lib/telemetry/structuredLogger', async () => {
  const mod = await import('@/test/mockStructuredLogger');
  return mod.structuredLoggerMockFactory();
});

import {
  resetStructuredLoggerMock,
  findLoggerEvent,
  filterLoggerEvents,
  findLoggerEventsByScope,
  type CapturedLogEvent,
} from '@/test/mockStructuredLogger';

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
      select: () => Promise.resolve({ data: [{ id: CART_ID }], error: null }),
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
    id: 'item-a',
    cart_id: CART_ID,
    product_id: 'prod-a',
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
    id: 'item-b',
    cart_id: CART_ID,
    product_id: 'prod-b',
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

const HYDRATED_ROW_EMPTY = { ...HYDRATED_ROW_FULL, seller_cart_items: [] };

const findRestore = (event: string) =>
  findLoggerEvent('seller_cart.restore', event);

// Helper: renderiza o provider e aguarda o contexto estabilizar.
async function mountContext() {
  const { result } = renderHook(() => useSellerCartContext(), { wrapper: Wrap });
  await waitFor(() => expect(result.current).toBeTruthy());
  return result;
}

describe('SellerCartContext — telemetria do restoreCart (Undo)', () => {
  const originalError = console.error;

  beforeEach(() => {
    rpcMock.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
    hydratedRow = HYDRATED_ROW_FULL;
    resetStructuredLoggerMock();
    console.error = vi.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  describe('restore_ok — desfechos success | partial | deduped', () => {
    it('classifica `success` quando items_inserted === items_total, sem dedup, e items_mismatch=false', async () => {
      rpcMock.mockResolvedValue({
        data: { cart_id: 'new-1', items_total: 2, items_inserted: 2, items_deduped: 0 },
        error: null,
      });
      const result = await mountContext();

      let correlationFromDelete: string | undefined;
      await act(async () => {
        const snap = await result.current.deleteCart(CART_ID);
        correlationFromDelete = (snap as { _correlation_id?: string })._correlation_id;
        await result.current.restoreCart(snap);
      });

      const ok = findRestore('restore_ok');
      expect(ok, 'restore_ok deve ser emitido').toBeTruthy();
      expect(ok!.fields).toMatchObject({
        restore_result: 'success',
        items_total: 2,
        items_inserted: 2,
        items_deduped: 0,
        items_resulting: 2,
        items_mismatch: false,
        hydrated: true,
        snapshot_id: CART_ID,
        new_cart_id: 'new-1',
      });
      // correlation_id propagado do delete_ok até o restore_ok.
      expect(ok!.fields.correlation_id).toBe(correlationFromDelete);
      // duration_ms preenchido, numérico, >= 0.
      expect(typeof ok!.fields.duration_ms).toBe('number');
      expect(ok!.fields.duration_ms as number).toBeGreaterThanOrEqual(0);
    });

    it('classifica `partial` quando items_inserted < items_total e sinaliza items_mismatch=true', async () => {
      rpcMock.mockResolvedValue({
        data: { cart_id: 'new-2', items_total: 2, items_inserted: 1, items_deduped: 0 },
        error: null,
      });
      const result = await mountContext();

      await act(async () => {
        const snap = await result.current.deleteCart(CART_ID);
        await result.current.restoreCart(snap);
      });

      const ok = findRestore('restore_ok');
      expect(ok!.fields).toMatchObject({
        restore_result: 'partial',
        items_total: 2,
        items_inserted: 1,
        items_resulting: 1, // preferência: metrics.items_inserted
        items_mismatch: true, // 1 !== 2
        partial_insert: true,
        has_dedup: false,
      });
      expect(typeof ok!.fields.duration_ms).toBe('number');
    });

    it('classifica `deduped` quando items_deduped > 0 e items_inserted === items_total', async () => {
      rpcMock.mockResolvedValue({
        data: { cart_id: 'new-3', items_total: 2, items_inserted: 2, items_deduped: 1 },
        error: null,
      });
      const result = await mountContext();

      await act(async () => {
        const snap = await result.current.deleteCart(CART_ID);
        await result.current.restoreCart(snap);
      });

      const ok = findRestore('restore_ok');
      expect(ok!.fields).toMatchObject({
        restore_result: 'deduped',
        items_total: 2,
        items_inserted: 2,
        items_deduped: 1,
        items_resulting: 2,
        items_mismatch: false, // 2 === itemsCount (2)
        has_dedup: true,
        partial_insert: false,
      });
    });
  });

  describe('restore_failed — desfecho `failed`', () => {
    it('emite restore_failed com items_resulting=0, items_mismatch=true, duration_ms>=0 e correlation_id propagado', async () => {
      // RPC devolve erro → mutation lança → context cai no catch.
      rpcMock.mockResolvedValue({
        data: null,
        error: { message: 'boom', code: '23505', details: 'dup', hint: null },
      });
      const result = await mountContext();

      let correlationFromDelete: string | undefined;
      await act(async () => {
        const snap = await result.current.deleteCart(CART_ID);
        correlationFromDelete = (snap as { _correlation_id?: string })._correlation_id;
        const returned = await result.current.restoreCart(snap);
        expect(returned).toBeUndefined();
      });

      const failed = findRestore('restore_failed');
      expect(failed, 'restore_failed deve ser emitido').toBeTruthy();
      expect(failed!.level).toBe('error');
      expect(failed!.fields).toMatchObject({
        restore_result: 'failed',
        snapshot_id: CART_ID,
        items_total: 2,
        items_resulting: 0,
        items_mismatch: true,
        items_inserted: null,
        items_deduped: null,
        hydrated: true,
      });
      expect(failed!.fields.correlation_id).toBe(correlationFromDelete);
      expect(typeof failed!.fields.duration_ms).toBe('number');
      expect(failed!.fields.duration_ms as number).toBeGreaterThanOrEqual(0);

      // Não deve haver restore_ok neste desfecho.
      expect(findRestore('restore_ok')).toBeUndefined();
    });
  });

  describe('restore_skipped_empty_snapshot — desfecho `skipped_empty`', () => {
    it('duration_ms=0 (atalho antes do relógio arrancar) e items_mismatch=false', async () => {
      hydratedRow = HYDRATED_ROW_EMPTY;
      const result = await mountContext();

      await act(async () => {
        const snap = await result.current.deleteCart(CART_ID);
        const returned = await result.current.restoreCart(snap);
        expect(returned).toBeUndefined();
      });

      // Invariante forte: no atalho de snapshot vazio NENHUMA RPC de
      // restauração pode ser chamada (evita recriar carrinho vazio silenciosamente).
      expect(rpcMock).not.toHaveBeenCalled();
      // E também não deve emitir os desfechos "normais" da restauração.
      expect(findRestore('restore_start')).toBeUndefined();
      expect(findRestore('restore_ok')).toBeUndefined();
      expect(findRestore('restore_failed')).toBeUndefined();

      const skipped = findRestore('restore_skipped_empty_snapshot');
      expect(skipped, 'restore_skipped_empty_snapshot deve ser emitido').toBeTruthy();
      expect(skipped!.level).toBe('warn');
      expect(skipped!.fields).toMatchObject({
        restore_result: 'skipped_empty',
        items_total: 0,
        items_resulting: 0,
        items_mismatch: false,
        duration_ms: 0,
        hydrated: false,
      });
    });
  });

  describe('correlation_id — geração vs. propagação', () => {
    // Se o snapshot vier SEM `_correlation_id` (ex.: chamada direta em cenário
    // legado, ou perda do campo no cache), o restoreCart PRECISA gerar um novo
    // correlation_id e propagá-lo para `restore_start` e `restore_ok/failed`.
    // Sem isso, os eventos ficam órfãos no Sentry e a correlação quebra.
    it('gera novo correlation_id quando o snapshot não traz `_correlation_id`', async () => {
      rpcMock.mockResolvedValue({
        data: { cart_id: 'new-cid', items_total: 2, items_inserted: 2, items_deduped: 0 },
        error: null,
      });
      const result = await mountContext();

      // Snapshot cru, sem `_correlation_id` — bypass do `deleteCart` de propósito.
      const rawSnapshot = {
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
        items: HYDRATED_ITEMS,
        // sem `_correlation_id` — a expectativa é que o context gere um.
      };

      await act(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await result.current.restoreCart(rawSnapshot as any);
      });

      const start = findRestore('restore_start');
      const ok = findRestore('restore_ok');
      expect(start, 'restore_start deve ser emitido').toBeTruthy();
      expect(ok, 'restore_ok deve ser emitido').toBeTruthy();

      const generatedCid = start!.fields.correlation_id;
      // Foi gerado: string não-vazia (o restoreCart chama `newRequestId()`).
      expect(typeof generatedCid).toBe('string');
      expect((generatedCid as string).length).toBeGreaterThan(0);
      // E propagado — restore_ok herda o MESMO correlation_id do restore_start.
      expect(ok!.fields.correlation_id).toBe(generatedCid);
    });

    it('propaga (NÃO gera) `_correlation_id` quando o snapshot já traz um', async () => {
      rpcMock.mockResolvedValue({
        data: { cart_id: 'new-cid2', items_total: 2, items_inserted: 2, items_deduped: 0 },
        error: null,
      });
      const result = await mountContext();

      const PRESET_CID = 'preset-correlation-abc-123';
      const rawSnapshot = {
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
        items: HYDRATED_ITEMS,
        _correlation_id: PRESET_CID,
      };

      await act(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await result.current.restoreCart(rawSnapshot as any);
      });

      expect(findRestore('restore_start')!.fields.correlation_id).toBe(PRESET_CID);
      expect(findRestore('restore_ok')!.fields.correlation_id).toBe(PRESET_CID);
    });
  });

  describe('E2E lógico — sequência canônica de eventos delete → undo', () => {
    // Helper local: mapeia todos os eventos do scope `seller_cart.restore`
    // em uma sequência ordenada e legível (`event` puro, ignorando `fields`).
    const restoreSequence = (): string[] =>
      findLoggerEventsByScope('seller_cart.restore').map((e) => e.event);

    // Helper local: verifica que TODOS os eventos passados têm o mesmo
    // `snapshot_id` — invariante crítica do fluxo delete→undo.
    const assertConsistentSnapshotId = (
      events: (CapturedLogEvent | undefined)[],
      expectedId: string,
    ): void => {
      for (const ev of events) {
        expect(ev, 'evento não emitido').toBeTruthy();
        expect(ev!.fields.snapshot_id).toBe(expectedId);
      }
    };

    it('happy path: delete_ok → restore_start → restore_ok (snapshot_id e correlation_id consistentes)', async () => {
      rpcMock.mockResolvedValue({
        data: { cart_id: 'new-4', items_total: 2, items_inserted: 2, items_deduped: 0 },
        error: null,
      });
      const result = await mountContext();

      await act(async () => {
        const snap = await result.current.deleteCart(CART_ID);
        await result.current.restoreCart(snap);
      });

      // Ordem canônica dos 3 eventos do scope restore.
      const seq = restoreSequence();
      const relevantIdx = seq.filter((e) =>
        ['delete_ok', 'restore_start', 'restore_ok'].includes(e),
      );
      expect(relevantIdx).toEqual(['delete_ok', 'restore_start', 'restore_ok']);

      const deleteOk = findRestore('delete_ok');
      const start = findRestore('restore_start');
      const ok = findRestore('restore_ok');

      assertConsistentSnapshotId([deleteOk, start, ok], CART_ID);

      // correlation_id atravessa a cadeia inteira.
      const cid = deleteOk!.fields.correlation_id;
      expect(cid).toBeTruthy();
      expect(start!.fields.correlation_id).toBe(cid);
      expect(ok!.fields.correlation_id).toBe(cid);

      // Nenhum evento espúrio de fracasso na trilha feliz.
      expect(findRestore('restore_failed')).toBeUndefined();
      expect(findRestore('restore_skipped_empty_snapshot')).toBeUndefined();
    });

    it('sad path (RPC falha): delete_ok → restore_start → restore_failed com mesma correlação', async () => {
      rpcMock.mockResolvedValue({
        data: null,
        error: { message: 'RLS bloqueou', code: '42501' },
      });
      const result = await mountContext();

      await act(async () => {
        const snap = await result.current.deleteCart(CART_ID);
        await result.current.restoreCart(snap);
      });

      const seq = restoreSequence().filter((e) =>
        ['delete_ok', 'restore_start', 'restore_ok', 'restore_failed'].includes(e),
      );
      expect(seq).toEqual(['delete_ok', 'restore_start', 'restore_failed']);

      const deleteOk = findRestore('delete_ok');
      const start = findRestore('restore_start');
      const failed = findRestore('restore_failed');
      assertConsistentSnapshotId([deleteOk, start, failed], CART_ID);

      const cid = deleteOk!.fields.correlation_id;
      expect(start!.fields.correlation_id).toBe(cid);
      expect(failed!.fields.correlation_id).toBe(cid);

      // Não deve emitir restore_ok no sad path.
      expect(findRestore('restore_ok')).toBeUndefined();
      // Apenas UM restore_failed (não pode duplicar por retry silencioso).
      expect(filterLoggerEvents('seller_cart.restore', 'restore_failed')).toHaveLength(1);
    });

    it('empty path (snapshot sem itens): delete_ok → restore_skipped_empty_snapshot (sem restore_start)', async () => {
      hydratedRow = HYDRATED_ROW_EMPTY;
      const result = await mountContext();

      await act(async () => {
        const snap = await result.current.deleteCart(CART_ID);
        await result.current.restoreCart(snap);
      });

      const seq = restoreSequence().filter((e) =>
        [
          'delete_ok',
          'restore_start',
          'restore_ok',
          'restore_failed',
          'restore_skipped_empty_snapshot',
        ].includes(e),
      );
      expect(seq).toEqual(['delete_ok', 'restore_skipped_empty_snapshot']);

      const deleteOk = findRestore('delete_ok');
      const skipped = findRestore('restore_skipped_empty_snapshot');
      assertConsistentSnapshotId([deleteOk, skipped], CART_ID);
      expect(skipped!.fields.correlation_id).toBe(deleteOk!.fields.correlation_id);
      // Guarda: RPC nunca chamada e restore_start nunca emitido.
      expect(rpcMock).not.toHaveBeenCalled();
      expect(findRestore('restore_start')).toBeUndefined();
    });
  });
});
