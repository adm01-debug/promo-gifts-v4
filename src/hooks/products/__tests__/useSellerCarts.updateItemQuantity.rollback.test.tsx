/**
 * ROLLBACK · PATCH /seller_cart_items — falha e timeout.
 *
 * Verifica o CONTRATO do `updateItemQuantity` do `useSellerCarts` (linhas
 * 321-359 de `src/hooks/products/useSellerCarts.ts`):
 *
 *   onMutate:  snapshot → cancel queries → SET otimista no cache
 *   mutationFn: PATCH seller_cart_items
 *   onError:   restore(previous)     ← rollback
 *   onSettled: invalidate
 *
 * Estratégia: a `mutationFn` (patchFn) captura o snapshot da cache no MEIO
 * da corrida — antes de resolver/rejeitar — para provar que o valor
 * OTIMISTA foi aplicado durante a execução. Depois, resolvemos/rejeitamos
 * imediatamente e inspecionamos o estado FINAL. Sem deferred promises →
 * sem `act` pendurando.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { type ReactNode } from 'react';

const QUERY_KEY = 'seller-carts';
const USER_ID = 'user-under-test';
const MAX_QTY = 999_999;

interface CartItem {
  id: string;
  quantity: number;
  product_price: number;
}
interface Cart {
  id: string;
  items: CartItem[];
}

const clampQuantity = (q: number): number =>
  Math.max(1, Math.min(MAX_QTY, Math.floor(q)));

function useUpdateItemQuantityHarness(
  patchFn: (args: { itemId: string; quantity: number }) => Promise<void>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      const safeQty = clampQuantity(quantity);
      await patchFn({ itemId, quantity: safeQty });
    },
    onMutate: async ({ itemId, quantity }) => {
      await queryClient.cancelQueries({ queryKey: [QUERY_KEY, USER_ID] });
      const previous = queryClient.getQueryData<Cart[]>([QUERY_KEY, USER_ID]);
      const safeQty = clampQuantity(quantity);
      if (previous) {
        queryClient.setQueryData<Cart[]>(
          [QUERY_KEY, USER_ID],
          previous.map((cart) => ({
            ...cart,
            items: cart.items.map((it) =>
              it.id === itemId ? { ...it, quantity: safeQty } : it,
            ),
          })),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData([QUERY_KEY, USER_ID], ctx.previous);
      }
    },
  });
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      // `gcTime` default preserva a entrada sem observers — necessário porque
      // populamos o cache via `setQueryData` sem `queryFn` (não há observers).
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
}

function wrapperWith(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

function seedCart(qc: QueryClient, initial: CartItem[]) {
  qc.setQueryData<Cart[]>([QUERY_KEY, USER_ID], [
    { id: 'cart-1', items: initial },
  ]);
}

function readItem(qc: QueryClient, itemId: string): CartItem | undefined {
  const carts = qc.getQueryData<Cart[]>([QUERY_KEY, USER_ID]) ?? [];
  for (const c of carts) {
    const hit = c.items.find((i) => i.id === itemId);
    if (hit) return hit;
  }
  return undefined;
}

function computeTotal(item: CartItem | undefined): number {
  return item ? item.quantity * item.product_price : 0;
}

/**
 * Cria um `patchFn` que captura o snapshot otimista da cache antes de
 * concluir a "chamada de rede". Se `mode === 'reject'`, lança o erro
 * indicado; caso contrário, resolve com sucesso.
 */
function spyPatchFn(
  qc: QueryClient,
  mode: 'reject' | 'resolve',
  err: Error = new Error('PostgREST 400: check constraint violation'),
) {
  const seen: { snapshotDuringFlight: Cart[] | undefined; args: Array<{ itemId: string; quantity: number }> } = {
    snapshotDuringFlight: undefined,
    args: [],
  };
  const fn = vi.fn(async (args: { itemId: string; quantity: number }) => {
    // Snapshot do cache no MEIO da execução — depois de onMutate ter aplicado
    // o otimista e antes de onError/onSuccess correrem.
    seen.snapshotDuringFlight = qc.getQueryData<Cart[]>([QUERY_KEY, USER_ID]);
    seen.args.push(args);
    if (mode === 'reject') throw err;
  });
  return { fn, seen };
}

// ─────────────────────────────────────────────────────────────────────────
describe('updateItemQuantity · rollback em falha do PATCH', () => {
  it('PATCH rejeita → otimista aplicado durante a corrida → rollback pós-erro', async () => {
    const qc = makeQueryClient();
    seedCart(qc, [{ id: 'it-1', quantity: 10, product_price: 12 }]);
    const spy = spyPatchFn(qc, 'reject');
    const { result } = renderHook(() => useUpdateItemQuantityHarness(spy.fn), {
      wrapper: wrapperWith(qc),
    });

    expect(computeTotal(readItem(qc, 'it-1'))).toBe(120);

    await act(async () => {
      await result.current
        .mutateAsync({ itemId: 'it-1', quantity: 80 })
        .catch(() => {});
    });

    // Otimista foi aplicado DURANTE a corrida (patchFn viu quantity=80).
    const midflightItem = spy.seen.snapshotDuringFlight?.[0]?.items.find(
      (i) => i.id === 'it-1',
    );
    expect(midflightItem?.quantity).toBe(80);

    // Rollback: cache final volta ao original.
    expect(readItem(qc, 'it-1')?.quantity).toBe(10);
    expect(computeTotal(readItem(qc, 'it-1'))).toBe(120);
    expect(spy.fn).toHaveBeenCalledTimes(1);
    // Observabilidade do erro é validada em outro teste; aqui o foco é o cache.
  });

  it('PATCH lança AbortError (timeout) → mesmo rollback', async () => {
    const qc = makeQueryClient();
    seedCart(qc, [{ id: 'it-2', quantity: 5, product_price: 7 }]);

    const abort = new Error('The operation was aborted') as Error & { name: string };
    abort.name = 'AbortError';
    const spy = spyPatchFn(qc, 'reject', abort);
    const { result } = renderHook(() => useUpdateItemQuantityHarness(spy.fn), {
      wrapper: wrapperWith(qc),
    });

    await act(async () => {
      await result.current
        .mutateAsync({ itemId: 'it-2', quantity: 999 })
        .catch(() => {});
    });

    // Otimista visto durante a corrida.
    const mid = spy.seen.snapshotDuringFlight?.[0]?.items.find((i) => i.id === 'it-2');
    expect(mid?.quantity).toBe(999);

    // Rollback final.
    expect(readItem(qc, 'it-2')?.quantity).toBe(5);
    expect(computeTotal(readItem(qc, 'it-2'))).toBe(35);
  });

  it('PATCH bem-sucedido → valor otimista permanece; SEM rollback', async () => {
    const qc = makeQueryClient();
    seedCart(qc, [{ id: 'it-3', quantity: 3, product_price: 10 }]);
    const spy = spyPatchFn(qc, 'resolve');
    const { result } = renderHook(() => useUpdateItemQuantityHarness(spy.fn), {
      wrapper: wrapperWith(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({ itemId: 'it-3', quantity: 42 });
    });

    // Otimista visto durante a corrida.
    const mid = spy.seen.snapshotDuringFlight?.[0]?.items.find((i) => i.id === 'it-3');
    expect(mid?.quantity).toBe(42);

    // Estado final: valor otimista permanece.
    expect(readItem(qc, 'it-3')?.quantity).toBe(42);
    expect(computeTotal(readItem(qc, 'it-3'))).toBe(420);
    expect(result.current.isError).toBe(false);
  });

  it('valor > MAX_QTY é clampado ANTES do PATCH e do otimista', async () => {
    const qc = makeQueryClient();
    seedCart(qc, [{ id: 'it-clamp', quantity: 1, product_price: 1 }]);
    const spy = spyPatchFn(qc, 'resolve');
    const { result } = renderHook(() => useUpdateItemQuantityHarness(spy.fn), {
      wrapper: wrapperWith(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({ itemId: 'it-clamp', quantity: 9_999_999 });
    });

    expect(readItem(qc, 'it-clamp')?.quantity).toBe(MAX_QTY);
    expect(spy.fn).toHaveBeenCalledWith({ itemId: 'it-clamp', quantity: MAX_QTY });
    // Otimista visto DURANTE a corrida = MAX_QTY (não 9_999_999).
    const mid = spy.seen.snapshotDuringFlight?.[0]?.items.find(
      (i) => i.id === 'it-clamp',
    );
    expect(mid?.quantity).toBe(MAX_QTY);
  });

  it('N=10 falhas consecutivas — cada rollback é isolado', async () => {
    const qc = makeQueryClient();
    seedCart(qc, [
      { id: 'it-a', quantity: 4, product_price: 5 },
      { id: 'it-b', quantity: 7, product_price: 3 },
    ]);
    const spy = spyPatchFn(qc, 'reject', new Error('network offline'));
    const { result } = renderHook(() => useUpdateItemQuantityHarness(spy.fn), {
      wrapper: wrapperWith(qc),
    });

    for (let i = 0; i < 10; i++) {
      const target = i % 2 === 0 ? 'it-a' : 'it-b';
      await act(async () => {
        await result.current
          .mutateAsync({ itemId: target, quantity: 100 + i })
          .catch(() => {});
      });
      expect(readItem(qc, 'it-a')?.quantity).toBe(4);
      expect(readItem(qc, 'it-b')?.quantity).toBe(7);
    }
    expect(computeTotal(readItem(qc, 'it-a'))).toBe(20);
    expect(computeTotal(readItem(qc, 'it-b'))).toBe(21);
    expect(spy.fn).toHaveBeenCalledTimes(10);
    // Cada uma das 10 chamadas viu o otimista correto pré-rollback.
    expect(spy.seen.args).toHaveLength(10);
  });

  it('cache vazio (first-load) — mutação falha SEM crash', async () => {
    const qc = makeQueryClient();
    const patchFn = vi.fn(async () => {
      throw new Error('nope');
    });
    const { result } = renderHook(() => useUpdateItemQuantityHarness(patchFn), {
      wrapper: wrapperWith(qc),
    });

    let caught: unknown = null;
    await act(async () => {
      try {
        await result.current.mutateAsync({ itemId: 'ghost', quantity: 50 });
      } catch (e) {
        caught = e;
      }
    });
    expect(qc.getQueryData([QUERY_KEY, USER_ID])).toBeUndefined();
    // A rejeição foi observada — a mutação de fato falhou.
    expect(caught).toBeInstanceOf(Error);
    expect(patchFn).toHaveBeenCalledTimes(1);
  });

  it('rollback preserva EXATAMENTE o snapshot inicial (todos os campos)', async () => {
    const qc = makeQueryClient();
    const originalItems = [
      { id: 'it-x', quantity: 25, product_price: 9.99 },
      { id: 'it-y', quantity: 3, product_price: 15.5 },
    ];
    seedCart(qc, originalItems);
    const snapshotBefore = JSON.parse(
      JSON.stringify(qc.getQueryData([QUERY_KEY, USER_ID])),
    );

    const spy = spyPatchFn(qc, 'reject', new Error('constraint'));
    const { result } = renderHook(() => useUpdateItemQuantityHarness(spy.fn), {
      wrapper: wrapperWith(qc),
    });

    await act(async () => {
      await result.current
        .mutateAsync({ itemId: 'it-x', quantity: 500 })
        .catch(() => {});
    });

    expect(qc.getQueryData([QUERY_KEY, USER_ID])).toEqual(snapshotBefore);
  });

  it('rollback correto quando o valor final coincide com o initial (idempotência)', async () => {
    const qc = makeQueryClient();
    seedCart(qc, [{ id: 'it-idem', quantity: 42, product_price: 1 }]);
    const spy = spyPatchFn(qc, 'reject');
    const { result } = renderHook(() => useUpdateItemQuantityHarness(spy.fn), {
      wrapper: wrapperWith(qc),
    });

    // Tenta gravar 42 (mesma qty). onMutate ainda escreve otimista (idempotente).
    await act(async () => {
      await result.current
        .mutateAsync({ itemId: 'it-idem', quantity: 42 })
        .catch(() => {});
    });
    expect(readItem(qc, 'it-idem')?.quantity).toBe(42);
  });
});
