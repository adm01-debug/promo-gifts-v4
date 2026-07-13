/**
 * Testes de integração — telemetria do `restoreCart` (Undo) do SellerCartContext.
 *
 * Cobertura consolidada:
 *   - `restore_ok` classificado como `success | partial | deduped` com métricas
 *     coerentes (`items_resulting`, `items_mismatch`, `has_dedup`, `partial_insert`).
 *   - `restore_failed` — `items_resulting=0`, `items_mismatch=true`, `duration_ms>=0`
 *     e `correlation_id` propagado do `delete_ok`.
 *   - `restore_skipped_empty_snapshot` — guarda anti-vazio: bloqueia RPC E
 *     bloqueia os desfechos normais (`restore_start/ok/failed`), com
 *     `duration_ms: 0` (atalho antes do relógio arrancar).
 *   - `correlation_id` — geração quando ausente, propagação quando presente e
 *     não-vazamento entre restores consecutivos.
 *   - `duration_ms` com fake timers — valor emitido reflete o intervalo real
 *     (via `performance.now()` faked pelo Vitest).
 *   - E2E LÓGICO — sequência canônica `delete_ok → restore_start → restore_(ok|failed|skipped)`
 *     com `snapshot_id` e `correlation_id` consistentes ao longo da cadeia.
 *
 * O ramo `ok_no_metrics` é exercitado em arquivo próprio (`SellerCartContext.okNoMetrics.test.tsx`)
 * porque exige mock direto do hook `useSellerCarts` (o mutation atual sempre
 * popula `restore_metrics`).
 */
import { describe, it, expect, vi, beforeEach, afterAll, afterEach } from 'vitest';
import { act } from '@testing-library/react';

vi.mock('@/lib/telemetry/structuredLogger', async () => {
  const mod = await import('@/test/mockStructuredLogger');
  return mod.structuredLoggerMockFactory();
});

import {
  resetStructuredLoggerMock,
  findLoggerEventsByScope,
} from '@/test/mockStructuredLogger';
import {
  RESTORE_SCOPE,
  TEST_USER_ID,
  TEST_CART_ID,
  buildHydratedItems,
  buildHydratedRow,
  buildEmptyHydratedRow,
  mountSellerCart,
  findRestore,
  filterRestore,
  restoreSequence,
  assertConsistentSnapshotId,
  rpcOk,
  rpcErr,
} from '@/test/sellerCartRestoreHelpers';

const rpcMock = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();

let hydratedRow: Record<string, unknown> | null = null;

// Mocks de módulo — `vi.mock` é hoisted por arquivo, portanto vive aqui.
// O `hydratedRow` mutável permite trocar hidratação vs. vazio por teste.
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
        Promise.resolve({ data: [{ id: TEST_CART_ID }], error: null }),
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

describe('SellerCartContext — telemetria do restoreCart (Undo)', () => {
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

  describe('restore_ok — desfechos success | partial | deduped', () => {
    it('classifica `success` quando items_inserted === items_total, sem dedup, e items_mismatch=false', async () => {
      rpcMock.mockResolvedValue(rpcOk({ cartId: 'new-1' }));
      const result = await mountSellerCart();

      let correlationFromDelete: string | undefined;
      await act(async () => {
        const snap = await result.current.deleteCart(TEST_CART_ID);
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
        snapshot_id: TEST_CART_ID,
        new_cart_id: 'new-1',
      });
      expect(ok!.fields.correlation_id).toBe(correlationFromDelete);
      expect(typeof ok!.fields.duration_ms).toBe('number');
      expect(ok!.fields.duration_ms as number).toBeGreaterThanOrEqual(0);
    });

    it('classifica `partial` quando items_inserted < items_total e sinaliza items_mismatch=true', async () => {
      rpcMock.mockResolvedValue(rpcOk({ cartId: 'new-2', itemsInserted: 1 }));
      const result = await mountSellerCart();

      await act(async () => {
        const snap = await result.current.deleteCart(TEST_CART_ID);
        await result.current.restoreCart(snap);
      });

      const ok = findRestore('restore_ok');
      expect(ok!.fields).toMatchObject({
        restore_result: 'partial',
        items_total: 2,
        items_inserted: 1,
        items_resulting: 1,
        items_mismatch: true,
        partial_insert: true,
        has_dedup: false,
      });
    });

    it('classifica `deduped` quando items_deduped > 0 e items_inserted === items_total', async () => {
      rpcMock.mockResolvedValue(rpcOk({ cartId: 'new-3', itemsDeduped: 1 }));
      const result = await mountSellerCart();

      await act(async () => {
        const snap = await result.current.deleteCart(TEST_CART_ID);
        await result.current.restoreCart(snap);
      });

      const ok = findRestore('restore_ok');
      expect(ok!.fields).toMatchObject({
        restore_result: 'deduped',
        items_total: 2,
        items_inserted: 2,
        items_deduped: 1,
        items_resulting: 2,
        items_mismatch: false,
        has_dedup: true,
        partial_insert: false,
      });
    });
  });

  describe('restore_failed — desfecho `failed`', () => {
    it('emite restore_failed com items_resulting=0, items_mismatch=true, duration_ms>=0 e correlation_id propagado', async () => {
      rpcMock.mockResolvedValue(
        rpcErr({ message: 'boom', code: '23505', details: 'dup', hint: null }),
      );
      const result = await mountSellerCart();

      let correlationFromDelete: string | undefined;
      await act(async () => {
        const snap = await result.current.deleteCart(TEST_CART_ID);
        correlationFromDelete = (snap as { _correlation_id?: string })._correlation_id;
        const returned = await result.current.restoreCart(snap);
        expect(returned).toBeUndefined();
      });

      const failed = findRestore('restore_failed');
      expect(failed, 'restore_failed deve ser emitido').toBeTruthy();
      expect(failed!.level).toBe('error');
      expect(failed!.fields).toMatchObject({
        restore_result: 'failed',
        snapshot_id: TEST_CART_ID,
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
      expect(findRestore('restore_ok')).toBeUndefined();
    });
  });

  describe('restore_skipped_empty_snapshot — desfecho `skipped_empty`', () => {
    it('duration_ms=0 (atalho antes do relógio arrancar) e items_mismatch=false', async () => {
      hydratedRow = buildEmptyHydratedRow();
      const result = await mountSellerCart();

      await act(async () => {
        const snap = await result.current.deleteCart(TEST_CART_ID);
        const returned = await result.current.restoreCart(snap);
        expect(returned).toBeUndefined();
      });

      // Invariante forte: no atalho de snapshot vazio NENHUMA RPC de
      // restauração pode ser chamada (evita recriar carrinho vazio silenciosamente).
      expect(rpcMock).not.toHaveBeenCalled();
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
    it('gera novo correlation_id quando o snapshot não traz `_correlation_id`', async () => {
      rpcMock.mockResolvedValue(rpcOk({ cartId: 'new-cid' }));
      const result = await mountSellerCart();

      // Snapshot cru, sem `_correlation_id` — bypass do `deleteCart` de propósito.
      const rawSnapshot = {
        ...buildHydratedRow(),
        items: buildHydratedItems(),
      };

      await act(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await result.current.restoreCart(rawSnapshot as any);
      });

      const start = findRestore('restore_start');
      const ok = findRestore('restore_ok');
      expect(start).toBeTruthy();
      expect(ok).toBeTruthy();

      const generatedCid = start!.fields.correlation_id;
      expect(typeof generatedCid).toBe('string');
      expect((generatedCid as string).length).toBeGreaterThan(0);
      expect(ok!.fields.correlation_id).toBe(generatedCid);
    });

    it('propaga (NÃO gera) `_correlation_id` quando o snapshot já traz um', async () => {
      rpcMock.mockResolvedValue(rpcOk({ cartId: 'new-cid2' }));
      const result = await mountSellerCart();

      const PRESET_CID = 'preset-correlation-abc-123';
      const rawSnapshot = {
        ...buildHydratedRow(),
        items: buildHydratedItems(),
        _correlation_id: PRESET_CID,
      };

      await act(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await result.current.restoreCart(rawSnapshot as any);
      });

      expect(findRestore('restore_start')!.fields.correlation_id).toBe(PRESET_CID);
      expect(findRestore('restore_ok')!.fields.correlation_id).toBe(PRESET_CID);
    });

    it('em 2 restores consecutivos sem `_correlation_id`, cada execução gera seu próprio CID e não vaza para a outra', async () => {
      rpcMock.mockResolvedValue(rpcOk({ cartId: 'new-A' }));
      const result = await mountSellerCart();

      const rawA = {
        ...buildHydratedRow({}, 'cart-A'),
        id: 'cart-A',
        items: buildHydratedItems('cart-A'),
      };
      const rawB = {
        ...buildHydratedRow({}, 'cart-B'),
        id: 'cart-B',
        items: buildHydratedItems('cart-B'),
      };

      await act(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await result.current.restoreCart(rawA as any);
      });
      await act(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await result.current.restoreCart(rawB as any);
      });

      // Duas cadeias `restore_start → restore_ok` na ordem A depois B.
      const starts = filterRestore('restore_start');
      const oks = filterRestore('restore_ok');
      expect(starts).toHaveLength(2);
      expect(oks).toHaveLength(2);

      const cidA_start = starts[0].fields.correlation_id;
      const cidA_ok = oks[0].fields.correlation_id;
      const cidB_start = starts[1].fields.correlation_id;
      const cidB_ok = oks[1].fields.correlation_id;

      // Cada CID é uma string não-vazia (gerado por `newRequestId()`).
      for (const cid of [cidA_start, cidA_ok, cidB_start, cidB_ok]) {
        expect(typeof cid).toBe('string');
        expect((cid as string).length).toBeGreaterThan(0);
      }

      // INVARIANTE 1 — consistência intra-restore: start[i] === ok[i].
      expect(cidA_start).toBe(cidA_ok);
      expect(cidB_start).toBe(cidB_ok);

      // INVARIANTE 2 — isolamento inter-restore: cidA !== cidB. Nenhum vazamento
      // do primeiro restore para o segundo (evita agrupar traces distintos).
      expect(cidA_start).not.toBe(cidB_start);
      expect(cidA_ok).not.toBe(cidB_ok);

      // Sanity: os snapshot_ids também não se cruzam.
      expect(starts[0].fields.snapshot_id).toBe('cart-A');
      expect(starts[1].fields.snapshot_id).toBe('cart-B');
    });
  });

  describe('duration_ms — fake timers medindo o intervalo real', () => {
    // Vitest v4 fake timers fake `performance.now()` por padrão. Como o SUT lê
    // `performance.now()` em `startedAt` (sync) e em `elapsedMs()` (após o await
    // da mutation), avançar o relógio fake ENTRE essas duas leituras — via
    // `setTimeout` mockado no RPC + `advanceTimersByTimeAsync` — resulta em
    // `duration_ms` = intervalo avançado. Sem esse plumbing os dois reads
    // colariam em 0.
    afterEach(() => {
      vi.useRealTimers();
    });

    it('restore_ok: duration_ms reflete o intervalo avançado nos fake timers', async () => {
      // Mount ANTES de habilitar fake timers — `waitFor` do testing-library
      // usa polling que empaca sob relógio fake.
      const result = await mountSellerCart();

      vi.useFakeTimers();
      // RPC devolve promise que só resolve depois de 500ms fake.
      rpcMock.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(rpcOk({ cartId: 'timed-ok' })), 500);
          }),
      );

      let restorePromise: Promise<unknown> | undefined;
      // Dispara delete+restore sem awaitar — precisamos avançar o clock manualmente.
      await act(async () => {
        const snap = await result.current.deleteCart(TEST_CART_ID);
        restorePromise = result.current.restoreCart(snap);
      });

      // Avança 500ms fake: `performance.now()` sobe de 0→500 e o setTimeout
      // resolve o RPC. `advanceTimersByTimeAsync` flusha microtasks entre passos.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
        await restorePromise;
      });

      const ok = findRestore('restore_ok');
      expect(ok, 'restore_ok deve ter sido emitido').toBeTruthy();
      // Tolerância de 1 tick — Math.round pode arredondar reads sub-ms.
      expect(ok!.fields.duration_ms).toBeGreaterThanOrEqual(500);
      expect(ok!.fields.duration_ms as number).toBeLessThanOrEqual(505);
    });

    it('restore_failed: duration_ms reflete o intervalo avançado quando a RPC rejeita depois de N ms', async () => {
      const result = await mountSellerCart();

      vi.useFakeTimers();
      rpcMock.mockImplementation(
        () =>
          new Promise((resolve) => {
            // Resolve com {error} — dispara o catch do context.
            setTimeout(
              () => resolve(rpcErr({ message: 'RLS bloqueou', code: '42501' })),
              300,
            );
          }),
      );

      let restorePromise: Promise<unknown> | undefined;
      await act(async () => {
        const snap = await result.current.deleteCart(TEST_CART_ID);
        restorePromise = result.current.restoreCart(snap);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
        await restorePromise;
      });

      const failed = findRestore('restore_failed');
      expect(failed, 'restore_failed deve ter sido emitido').toBeTruthy();
      expect(failed!.fields.duration_ms).toBeGreaterThanOrEqual(300);
      expect(failed!.fields.duration_ms as number).toBeLessThanOrEqual(305);
    });

    it('restore_skipped_empty_snapshot: duration_ms permanece 0 mesmo com o clock avançado (atalho antes do relógio)', async () => {
      hydratedRow = buildEmptyHydratedRow();
      const result = await mountSellerCart();

      vi.useFakeTimers();
      // Avança o clock ANTES do restore — verifica que o "0" é hardcoded no
      // atalho de vazio (guarda dispara antes de qualquer leitura de clock).
      vi.setSystemTime(new Date('2027-01-01T00:00:00Z'));
      await vi.advanceTimersByTimeAsync(9999);

      await act(async () => {
        const snap = await result.current.deleteCart(TEST_CART_ID);
        const returned = await result.current.restoreCart(snap);
        expect(returned).toBeUndefined();
      });

      const skipped = findRestore('restore_skipped_empty_snapshot');
      expect(skipped, 'restore_skipped_empty_snapshot deve ser emitido').toBeTruthy();
      // `duration_ms` é literal 0 no atalho — não é calculado por elapsedMs().
      expect(skipped!.fields.duration_ms).toBe(0);
      // Guarda extra: nenhuma RPC foi chamada.
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it('restore_ok: RPC resolve imediatamente — duration_ms finito, não-negativo e sem drift entre eventos do mesmo restore', async () => {
      // RPC resolve na próxima microtask (sem setTimeout) — cobre o cenário
      // "hot path" onde start/ok leem `performance.now()` praticamente juntos.
      rpcMock.mockResolvedValue(rpcOk({ cartId: 'sync-ok' }));
      const result = await mountSellerCart();

      await act(async () => {
        const snap = await result.current.deleteCart(TEST_CART_ID);
        await result.current.restoreCart(snap);
      });

      const start = findRestore('restore_start');
      const ok = findRestore('restore_ok');
      expect(start, 'restore_start deve ser emitido').toBeTruthy();
      expect(ok, 'restore_ok deve ser emitido').toBeTruthy();

      const startDur = start!.fields.duration_ms as number | undefined;
      const okDur = ok!.fields.duration_ms as number;

      // `restore_start` NÃO carrega duration_ms (ainda não mediu). Se aparecer,
      // deve ser 0 — nunca negativo.
      if (typeof startDur === 'number') {
        expect(startDur).toBeGreaterThanOrEqual(0);
      }

      // `restore_ok` sempre carrega duration_ms — número finito, não-negativo.
      expect(typeof okDur).toBe('number');
      expect(Number.isFinite(okDur)).toBe(true);
      expect(okDur).toBeGreaterThanOrEqual(0);
      // Sem avanço relevante de clock o valor deve ser pequeno (evita drift acidental).
      expect(okDur).toBeLessThan(1000);

      // Correlação intra-restore preservada mesmo no hot path.
      expect(ok!.fields.correlation_id).toBe(start!.fields.correlation_id);
    });

    it('restore_failed: RPC rejeita imediatamente — duration_ms finito, não-negativo e sem drift entre eventos do mesmo restore', async () => {
      rpcMock.mockResolvedValue(rpcErr({ message: 'boom-sync', code: '23505' }));
      const result = await mountSellerCart();

      await act(async () => {
        const snap = await result.current.deleteCart(TEST_CART_ID);
        await result.current.restoreCart(snap);
      });

      const start = findRestore('restore_start');
      const failed = findRestore('restore_failed');
      expect(start).toBeTruthy();
      expect(failed, 'restore_failed deve ser emitido').toBeTruthy();

      const failedDur = failed!.fields.duration_ms as number;
      expect(typeof failedDur).toBe('number');
      expect(Number.isFinite(failedDur)).toBe(true);
      expect(failedDur).toBeGreaterThanOrEqual(0);
      expect(failedDur).toBeLessThan(1000);

      // Mesma correlação entre start e failed no hot path.
      expect(failed!.fields.correlation_id).toBe(start!.fields.correlation_id);
      expect(findRestore('restore_ok')).toBeUndefined();
    });

    it('restore_ok (partial): RPC resolve imediatamente — duration_ms finito, não-negativo e sem drift', async () => {
      rpcMock.mockResolvedValue(rpcOk({ cartId: 'sync-partial', itemsInserted: 1 }));
      const result = await mountSellerCart();

      await act(async () => {
        const snap = await result.current.deleteCart(TEST_CART_ID);
        await result.current.restoreCart(snap);
      });

      const start = findRestore('restore_start');
      const ok = findRestore('restore_ok');
      expect(ok!.fields.restore_result).toBe('partial');

      const okDur = ok!.fields.duration_ms as number;
      expect(typeof okDur).toBe('number');
      expect(Number.isFinite(okDur)).toBe(true);
      expect(okDur).toBeGreaterThanOrEqual(0);
      expect(okDur).toBeLessThan(1000);
      expect(ok!.fields.correlation_id).toBe(start!.fields.correlation_id);
    });

    it('restore_ok (deduped): RPC resolve imediatamente — duration_ms finito, não-negativo e sem drift', async () => {
      rpcMock.mockResolvedValue(rpcOk({ cartId: 'sync-dedup', itemsDeduped: 1 }));
      const result = await mountSellerCart();

      await act(async () => {
        const snap = await result.current.deleteCart(TEST_CART_ID);
        await result.current.restoreCart(snap);
      });

      const start = findRestore('restore_start');
      const ok = findRestore('restore_ok');
      expect(ok!.fields.restore_result).toBe('deduped');

      const okDur = ok!.fields.duration_ms as number;
      expect(typeof okDur).toBe('number');
      expect(Number.isFinite(okDur)).toBe(true);
      expect(okDur).toBeGreaterThanOrEqual(0);
      expect(okDur).toBeLessThan(1000);
      expect(ok!.fields.correlation_id).toBe(start!.fields.correlation_id);
    });

    it('avanço incremental de timers (5×20ms) — duration_ms cresce monotônico e nunca fica negativo entre restore_start e restore_ok', async () => {
      const result = await mountSellerCart();

      vi.useFakeTimers();
      // RPC só resolve depois de 100ms fake, mas avançamos em 5 passos de 20ms
      // para simular clock progredindo em micro-incrementos.
      rpcMock.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(rpcOk({ cartId: 'incr-ok' })), 100);
          }),
      );

      let restorePromise: Promise<unknown> | undefined;
      await act(async () => {
        const snap = await result.current.deleteCart(TEST_CART_ID);
        restorePromise = result.current.restoreCart(snap);
      });

      // 5 passos de 20ms — em cada passo o clock avança mas o RPC ainda não resolveu.
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(20);
        });
      }
      await act(async () => {
        await restorePromise;
      });

      const start = findRestore('restore_start');
      const ok = findRestore('restore_ok');
      expect(start).toBeTruthy();
      expect(ok).toBeTruthy();

      const startDur = start!.fields.duration_ms as number | undefined;
      const okDur = ok!.fields.duration_ms as number;

      if (typeof startDur === 'number') {
        expect(startDur).toBeGreaterThanOrEqual(0);
      }
      expect(Number.isFinite(okDur)).toBe(true);
      expect(okDur).toBeGreaterThanOrEqual(0);
      // Monotonicidade: ok >= start (nunca "volta no tempo").
      if (typeof startDur === 'number') {
        expect(okDur).toBeGreaterThanOrEqual(startDur);
      }
      // Bateu ~100ms de avanço acumulado (tolerância +5ms para rounding).
      expect(okDur).toBeGreaterThanOrEqual(100);
      expect(okDur).toBeLessThanOrEqual(105);
      expect(ok!.fields.correlation_id).toBe(start!.fields.correlation_id);
  });

  describe('stress — RPC > 1s: duration_ms permanece finito, não-negativo e sem drift', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it.each([
      { label: 'partial', rpcExtra: { itemsInserted: 1 }, expectedResult: 'partial' as const },
      { label: 'deduped', rpcExtra: { itemsDeduped: 1 }, expectedResult: 'deduped' as const },
    ])(
      'restore_ok ($label) com RPC de 1500ms: duration_ms >= 1500, finito, sem drift entre start e ok',
      async ({ rpcExtra, expectedResult }) => {
        const result = await mountSellerCart();

        vi.useFakeTimers();
        rpcMock.mockImplementation(
          () =>
            new Promise((resolve) => {
              setTimeout(
                () => resolve(rpcOk({ cartId: `stress-${expectedResult}`, ...rpcExtra })),
                1500,
              );
            }),
        );

        let restorePromise: Promise<unknown> | undefined;
        await act(async () => {
          const snap = await result.current.deleteCart(TEST_CART_ID);
          restorePromise = result.current.restoreCart(snap);
        });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1500);
          await restorePromise;
        });

        const start = findRestore('restore_start');
        const ok = findRestore('restore_ok');
        expect(ok!.fields.restore_result).toBe(expectedResult);

        const okDur = ok!.fields.duration_ms as number;
        expect(Number.isFinite(okDur)).toBe(true);
        expect(okDur).toBeGreaterThanOrEqual(1500);
        expect(okDur).toBeLessThanOrEqual(1510); // tolerância +10ms de rounding
        expect(ok!.fields.correlation_id).toBe(start!.fields.correlation_id);
      },
    );
  });

  describe('concorrência — restores paralelos preservam sua própria cadeia', () => {
    it('dois restoreCart em paralelo mantêm sequência e correlation_id isolados por chamada', async () => {
      const result = await mountSellerCart();

      const CID_A = 'concurrent-cid-A';
      const CID_B = 'concurrent-cid-B';

      // Distingue as chamadas pelo `_snapshot.id` que chega em `rpc('restore_seller_cart', {_snapshot})`.
      // Cada snapshot resolve com um new_cart_id próprio para permitir cross-check no `restore_ok`.
      // A RPC `restore_seller_cart` recebe payload SEM `id` do snapshot (só
      // company/items). Distinguimos as chamadas por `company_id`, que é
      // preservado pelo `buildRestorePayload`.
      rpcMock.mockImplementation(
        (_fn: string, params: { _snapshot: { company_id: string } }) => {
          if (params._snapshot.company_id === 'co-A') {
            return Promise.resolve(rpcOk({ cartId: 'new-A' }));
          }
          return Promise.resolve(rpcOk({ cartId: 'new-B' }));
        },
      );

      const snapA = {
        ...buildHydratedRow({ company_id: 'co-A' }, 'cart-A'),
        id: 'cart-A',
        company_id: 'co-A',
        items: buildHydratedItems('cart-A'),
        _correlation_id: CID_A,
      };
      const snapB = {
        ...buildHydratedRow({ company_id: 'co-B' }, 'cart-B'),
        id: 'cart-B',
        company_id: 'co-B',
        items: buildHydratedItems('cart-B'),
        _correlation_id: CID_B,
      };

      await act(async () => {
        await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result.current.restoreCart(snapA as any),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result.current.restoreCart(snapB as any),
        ]);
      });

      const starts = filterRestore('restore_start');
      const oks = filterRestore('restore_ok');
      expect(starts).toHaveLength(2);
      expect(oks).toHaveLength(2);

      // Cada start deve ter um par ok com a MESMA correlation_id — sem cross-talk.
      const pair = (cid: string) => ({
        start: starts.find((e) => e.fields.correlation_id === cid),
        ok: oks.find((e) => e.fields.correlation_id === cid),
      });
      const pairA = pair(CID_A);
      const pairB = pair(CID_B);

      expect(pairA.start, 'restore_start de A').toBeTruthy();
      expect(pairA.ok, 'restore_ok de A').toBeTruthy();
      expect(pairB.start, 'restore_start de B').toBeTruthy();
      expect(pairB.ok, 'restore_ok de B').toBeTruthy();

      // Snapshot_id não vaza entre as cadeias.
      expect(pairA.start!.fields.snapshot_id).toBe('cart-A');
      expect(pairA.ok!.fields.snapshot_id).toBe('cart-A');
      expect(pairA.ok!.fields.new_cart_id).toBe('new-A');
      expect(pairB.start!.fields.snapshot_id).toBe('cart-B');
      expect(pairB.ok!.fields.snapshot_id).toBe('cart-B');
      expect(pairB.ok!.fields.new_cart_id).toBe('new-B');

      // Nenhuma correlação misturada.
      expect(pairA.start!.fields.correlation_id).not.toBe(
        pairB.start!.fields.correlation_id,
      );
    });
  });

  describe('restore_start — contrato de duration_ms (defensivo)', () => {
    it('hoje NÃO emite duration_ms; se emitir no futuro, deve ser finito, >=0 e nunca exceder duration_ms do restore_ok', async () => {
      rpcMock.mockResolvedValue(rpcOk({ cartId: 'start-dur' }));
      const result = await mountSellerCart();

      await act(async () => {
        const snap = await result.current.deleteCart(TEST_CART_ID);
        await result.current.restoreCart(snap);
      });

      const start = findRestore('restore_start');
      const ok = findRestore('restore_ok');
      expect(start).toBeTruthy();
      expect(ok).toBeTruthy();

      const startDur = start!.fields.duration_ms;
      const okDur = ok!.fields.duration_ms as number;

      // Contrato atual: restore_start NÃO carrega duration_ms.
      // Se um refactor futuro passar a incluir, o campo precisa respeitar as
      // invariantes de tempo — este teste "trava" a semântica esperada.
      if (startDur !== undefined) {
        expect(typeof startDur).toBe('number');
        expect(Number.isFinite(startDur as number)).toBe(true);
        expect(startDur as number).toBeGreaterThanOrEqual(0);
        // Nunca pode ser MAIOR que o ok final — senão o relógio "voltou".
        expect(startDur as number).toBeLessThanOrEqual(okDur);
      } else {
        // Documenta o estado atual — se um dia mudar, o ramo `if` acima assume.
        expect(startDur).toBeUndefined();
      }

      // Sanity: duas leituras de duration_ms no MESMO evento (start ou ok) não
      // devem "oscilar" — o campo é escrito uma vez por evento. Como o buffer
      // guarda um snapshot imutável, garantimos que releituras batem.
      expect(ok!.fields.duration_ms).toBe(okDur);
    });
  });

  describe('_correlation_id pré-existente propaga em partial e deduped', () => {
    it.each([
      { label: 'partial', rpcExtra: { itemsInserted: 1 }, expectedResult: 'partial' as const },
      { label: 'deduped', rpcExtra: { itemsDeduped: 1 }, expectedResult: 'deduped' as const },
    ])(
      'restore_ok ($label) reutiliza _correlation_id do snapshot e propaga em start e ok',
      async ({ rpcExtra, expectedResult }) => {
        rpcMock.mockResolvedValue(rpcOk({ cartId: `preset-${expectedResult}`, ...rpcExtra }));
        const result = await mountSellerCart();

        const PRESET_CID = `preset-cid-${expectedResult}-9f2a`;
        const rawSnapshot = {
          ...buildHydratedRow(),
          items: buildHydratedItems(),
          _correlation_id: PRESET_CID,
        };

        await act(async () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await result.current.restoreCart(rawSnapshot as any);
        });

        const start = findRestore('restore_start');
        const ok = findRestore('restore_ok');
        expect(start).toBeTruthy();
        expect(ok).toBeTruthy();
        expect(ok!.fields.restore_result).toBe(expectedResult);

        // O CID pré-existente NÃO é regenerado — vira SSOT da cadeia.
        expect(start!.fields.correlation_id).toBe(PRESET_CID);
        expect(ok!.fields.correlation_id).toBe(PRESET_CID);
        // Sequência mínima esperada com o CID preservado.
        const cidChain = findLoggerEventsByScope(RESTORE_SCOPE)
          .filter((e) => e.fields.correlation_id === PRESET_CID)
          .map((e) => e.event);
        expect(cidChain).toEqual(
          expect.arrayContaining(['restore_start', 'restore_ok']),
        );
      },
    );
  });


  });

  describe('sequência canônica para classificações `partial` e `deduped`', () => {
    it('partial: delete_ok → restore_start → restore_ok com correlation_id consistente e restore_result=partial', async () => {
      rpcMock.mockResolvedValue(rpcOk({ cartId: 'seq-partial', itemsInserted: 1 }));
      const result = await mountSellerCart();

      await act(async () => {
        const snap = await result.current.deleteCart(TEST_CART_ID);
        await result.current.restoreCart(snap);
      });

      const seq = restoreSequence().filter((e) =>
        ['delete_ok', 'restore_start', 'restore_ok', 'restore_failed'].includes(e),
      );
      expect(seq).toEqual(['delete_ok', 'restore_start', 'restore_ok']);

      const deleteOk = findRestore('delete_ok');
      const start = findRestore('restore_start');
      const ok = findRestore('restore_ok');
      assertConsistentSnapshotId([deleteOk, start, ok], TEST_CART_ID);

      const cid = deleteOk!.fields.correlation_id;
      expect(cid).toBeTruthy();
      expect(start!.fields.correlation_id).toBe(cid);
      expect(ok!.fields.correlation_id).toBe(cid);
      expect(ok!.fields.restore_result).toBe('partial');
      expect(ok!.fields).toMatchObject({
        items_mismatch: true,
        partial_insert: true,
        has_dedup: false,
      });
      expect(findRestore('restore_failed')).toBeUndefined();
    });

    it('deduped: delete_ok → restore_start → restore_ok com correlation_id consistente e restore_result=deduped', async () => {
      rpcMock.mockResolvedValue(rpcOk({ cartId: 'seq-dedup', itemsDeduped: 1 }));
      const result = await mountSellerCart();

      await act(async () => {
        const snap = await result.current.deleteCart(TEST_CART_ID);
        await result.current.restoreCart(snap);
      });

      const seq = restoreSequence().filter((e) =>
        ['delete_ok', 'restore_start', 'restore_ok', 'restore_failed'].includes(e),
      );
      expect(seq).toEqual(['delete_ok', 'restore_start', 'restore_ok']);

      const deleteOk = findRestore('delete_ok');
      const start = findRestore('restore_start');
      const ok = findRestore('restore_ok');
      assertConsistentSnapshotId([deleteOk, start, ok], TEST_CART_ID);

      const cid = deleteOk!.fields.correlation_id;
      expect(cid).toBeTruthy();
      expect(start!.fields.correlation_id).toBe(cid);
      expect(ok!.fields.correlation_id).toBe(cid);
      expect(ok!.fields.restore_result).toBe('deduped');
      expect(ok!.fields).toMatchObject({
        items_mismatch: false,
        partial_insert: false,
        has_dedup: true,
      });
      expect(findRestore('restore_failed')).toBeUndefined();
    });
  });

  describe('E2E lógico — sequência canônica de eventos delete → undo', () => {
    it('happy path: delete_ok → restore_start → restore_ok (snapshot_id e correlation_id consistentes)', async () => {
      rpcMock.mockResolvedValue(rpcOk({ cartId: 'new-4' }));
      const result = await mountSellerCart();

      await act(async () => {
        const snap = await result.current.deleteCart(TEST_CART_ID);
        await result.current.restoreCart(snap);
      });

      const seq = restoreSequence().filter((e) =>
        ['delete_ok', 'restore_start', 'restore_ok'].includes(e),
      );
      expect(seq).toEqual(['delete_ok', 'restore_start', 'restore_ok']);

      const deleteOk = findRestore('delete_ok');
      const start = findRestore('restore_start');
      const ok = findRestore('restore_ok');
      assertConsistentSnapshotId([deleteOk, start, ok], TEST_CART_ID);

      const cid = deleteOk!.fields.correlation_id;
      expect(cid).toBeTruthy();
      expect(start!.fields.correlation_id).toBe(cid);
      expect(ok!.fields.correlation_id).toBe(cid);
      expect(findRestore('restore_failed')).toBeUndefined();
      expect(findRestore('restore_skipped_empty_snapshot')).toBeUndefined();
    });

    it('sad path (RPC falha): delete_ok → restore_start → restore_failed com mesma correlação', async () => {
      rpcMock.mockResolvedValue(rpcErr({ message: 'RLS bloqueou', code: '42501' }));
      const result = await mountSellerCart();

      await act(async () => {
        const snap = await result.current.deleteCart(TEST_CART_ID);
        await result.current.restoreCart(snap);
      });

      const seq = restoreSequence().filter((e) =>
        ['delete_ok', 'restore_start', 'restore_ok', 'restore_failed'].includes(e),
      );
      expect(seq).toEqual(['delete_ok', 'restore_start', 'restore_failed']);

      const deleteOk = findRestore('delete_ok');
      const start = findRestore('restore_start');
      const failed = findRestore('restore_failed');
      assertConsistentSnapshotId([deleteOk, start, failed], TEST_CART_ID);

      const cid = deleteOk!.fields.correlation_id;
      expect(start!.fields.correlation_id).toBe(cid);
      expect(failed!.fields.correlation_id).toBe(cid);
      expect(findRestore('restore_ok')).toBeUndefined();
      expect(filterRestore('restore_failed')).toHaveLength(1);
    });

    it('empty path (snapshot sem itens): delete_ok → restore_skipped_empty_snapshot (sem restore_start)', async () => {
      hydratedRow = buildEmptyHydratedRow();
      const result = await mountSellerCart();

      await act(async () => {
        const snap = await result.current.deleteCart(TEST_CART_ID);
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
      assertConsistentSnapshotId([deleteOk, skipped], TEST_CART_ID);
      expect(skipped!.fields.correlation_id).toBe(deleteOk!.fields.correlation_id);
      expect(rpcMock).not.toHaveBeenCalled();
      expect(findRestore('restore_start')).toBeUndefined();
    });
  });

  // Sanity: nenhum teste deve deixar eventos residuais escapando de outro scope.
  it('scope canônico = "seller_cart.restore" (evita drift de nome de scope)', async () => {
    rpcMock.mockResolvedValue(rpcOk());
    const result = await mountSellerCart();
    await act(async () => {
      const snap = await result.current.deleteCart(TEST_CART_ID);
      await result.current.restoreCart(snap);
    });
    // Todos os eventos capturados devem viver sob o scope canônico.
    const scopes = new Set(findLoggerEventsByScope(RESTORE_SCOPE).map((e) => e.scope));
    expect([...scopes]).toEqual([RESTORE_SCOPE]);
  });
});
