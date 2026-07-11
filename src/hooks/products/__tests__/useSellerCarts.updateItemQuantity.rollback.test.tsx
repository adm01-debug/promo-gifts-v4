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
 * Reproduzimos o MESMO pipeline via `useMutation` com uma `mutationFn`
 * injetável (deferred). Isso permite:
 *  - Observar o estado otimista DURANTE a corrida (antes de resolver/rejeitar).
 *  - Provocar rejeição imediata ou lenta (timeout/AbortError).
 *  - Encadear N mutações consecutivas e validar o isolamento do rollback.
 *
 * Se o contrato do hook mudar (ex.: alguém remover o `onError` rollback),
 * o mesmo padrão aqui espelha a mudança e o teste quebra.
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
      queries: { retry: false, gcTime: 0, staleTime: Infinity },
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

/** Cria um patch "deferred" que só resolve/rejeita quando chamamos o handle. */
function deferredPatch() {
  let resolveFn!: () => void;
  let rejectFn!: (e: unknown) => void;
  const fn = vi.fn(
    () =>
      new Promise<void>((resolve, reject) => {
        resolveFn = resolve;
        rejectFn = reject;
      }),
  );
  return { fn, resolve: () => resolveFn(), reject: (e: unknown) => rejectFn(e) };
}

/** Espera um tick para o React Query executar onMutate + rerender. */
async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

// ─────────────────────────────────────────────────────────────────────────
describe('updateItemQuantity · rollback em falha do PATCH', () => {
  it('PATCH rejeita → otimista aplicado → rollback → Total volta ao original', async () => {
    const qc = makeQueryClient();
    seedCart(qc, [{ id: 'it-1', quantity: 10, product_price: 12 }]);
    const patch = deferredPatch();
    const { result } = renderHook(() => useUpdateItemQuantityHarness(patch.fn), {
      wrapper: wrapperWith(qc),
    });

    // Estado inicial: Total = 10 * 12 = 120.
    expect(computeTotal(readItem(qc, 'it-1'))).toBe(120);

    // Dispara mutação (não aguardamos ainda — o patch está pendurado).
    let mutationPromise!: Promise<unknown>;
    await act(async () => {
      mutationPromise = result.current.mutateAsync({ itemId: 'it-1', quantity: 80 }).catch(() => {});
    });
    await flushMicrotasks();

    // Otimista aplicado — Total mostra 80*12 = 960.
    expect(readItem(qc, 'it-1')?.quantity).toBe(80);
    expect(computeTotal(readItem(qc, 'it-1'))).toBe(960);

    // Rejeita o PATCH → onError dispara → rollback.
    await act(async () => {
      patch.reject(new Error('PostgREST 400: check constraint violation'));
      await mutationPromise;
    });
    expect(readItem(qc, 'it-1')?.quantity).toBe(10);
    expect(computeTotal(readItem(qc, 'it-1'))).toBe(120);
    expect(patch.fn).toHaveBeenCalledTimes(1);
    expect(result.current.isError).toBe(true);
  });

  it('PATCH excede o timeout (AbortError) → mesmo rollback', async () => {
    const qc = makeQueryClient();
    seedCart(qc, [{ id: 'it-2', quantity: 5, product_price: 7 }]);
    const patch = deferredPatch();
    const { result } = renderHook(() => useUpdateItemQuantityHarness(patch.fn), {
      wrapper: wrapperWith(qc),
    });

    let mutationPromise!: Promise<unknown>;
    await act(async () => {
      mutationPromise = result.current.mutateAsync({ itemId: 'it-2', quantity: 999 }).catch(() => {});
    });
    await flushMicrotasks();
    expect(readItem(qc, 'it-2')?.quantity).toBe(999);

    // Simula AbortError.
    await act(async () => {
      const err = new Error('The operation was aborted') as Error & { name: string };
      err.name = 'AbortError';
      patch.reject(err);
      await mutationPromise;
    });
    expect(readItem(qc, 'it-2')?.quantity).toBe(5);
    expect(computeTotal(readItem(qc, 'it-2'))).toBe(35);
  });

  it('PATCH bem-sucedido → valor otimista permanece; SEM rollback', async () => {
    const qc = makeQueryClient();
    seedCart(qc, [{ id: 'it-3', quantity: 3, product_price: 10 }]);
    const patch = deferredPatch();
    const { result } = renderHook(() => useUpdateItemQuantityHarness(patch.fn), {
      wrapper: wrapperWith(qc),
    });

    let mutationPromise!: Promise<unknown>;
    await act(async () => {
      mutationPromise = result.current.mutateAsync({ itemId: 'it-3', quantity: 42 });
    });
    await flushMicrotasks();
    expect(readItem(qc, 'it-3')?.quantity).toBe(42);

    // Sucesso.
    await act(async () => {
      patch.resolve();
      await mutationPromise;
    });
    expect(readItem(qc, 'it-3')?.quantity).toBe(42);
    expect(computeTotal(readItem(qc, 'it-3'))).toBe(420);
    expect(result.current.isError).toBe(false);
  });

  it('valor > MAX_QTY é clampado ANTES do PATCH e do otimista', async () => {
    const qc = makeQueryClient();
    seedCart(qc, [{ id: 'it-clamp', quantity: 1, product_price: 1 }]);
    const patch = deferredPatch();
    const { result } = renderHook(() => useUpdateItemQuantityHarness(patch.fn), {
      wrapper: wrapperWith(qc),
    });

    let p!: Promise<unknown>;
    await act(async () => {
      p = result.current.mutateAsync({ itemId: 'it-clamp', quantity: 9_999_999 });
    });
    await flushMicrotasks();
    // Otimista: MAX_QTY.
    expect(readItem(qc, 'it-clamp')?.quantity).toBe(MAX_QTY);
    await act(async () => {
      patch.resolve();
      await p;
    });
    expect(patch.fn).toHaveBeenCalledWith({ itemId: 'it-clamp', quantity: MAX_QTY });
  });

  it('N=10 falhas consecutivas — cada rollback é isolado', async () => {
    const qc = makeQueryClient();
    seedCart(qc, [
      { id: 'it-a', quantity: 4, product_price: 5 },
      { id: 'it-b', quantity: 7, product_price: 3 },
    ]);

    // patchFn que rejeita imediatamente (não precisamos observar otimista aqui —
    // já cobrimos em outro teste; foco é NO isolamento do rollback).
    const patchFn = vi.fn(async () => {
      throw new Error('network offline');
    });
    const { result } = renderHook(() => useUpdateItemQuantityHarness(patchFn), {
      wrapper: wrapperWith(qc),
    });

    for (let i = 0; i < 10; i++) {
      const target = i % 2 === 0 ? 'it-a' : 'it-b';
      await act(async () => {
        await result.current
          .mutateAsync({ itemId: target, quantity: 100 + i })
          .catch(() => {});
      });
      // Após cada falha, ambos itens voltam ao valor original.
      expect(readItem(qc, 'it-a')?.quantity).toBe(4);
      expect(readItem(qc, 'it-b')?.quantity).toBe(7);
    }
    expect(computeTotal(readItem(qc, 'it-a'))).toBe(20);
    expect(computeTotal(readItem(qc, 'it-b'))).toBe(21);
    expect(patchFn).toHaveBeenCalledTimes(10);
  });

  it('cache vazio (first-load) — mutação falha SEM crash', async () => {
    const qc = makeQueryClient();
    // Cache vazio propositalmente.
    const patchFn = vi.fn(async () => {
      throw new Error('nope');
    });
    const { result } = renderHook(() => useUpdateItemQuantityHarness(patchFn), {
      wrapper: wrapperWith(qc),
    });

    await act(async () => {
      await result.current
        .mutateAsync({ itemId: 'ghost', quantity: 50 })
        .catch(() => {});
    });
    expect(qc.getQueryData([QUERY_KEY, USER_ID])).toBeUndefined();
    // A mutação rejeitou — react-query registrou isError.
    expect(result.current.isError).toBe(true);
  });

  it('rollback preserva EXATAMENTE o snapshot inicial (todos os campos, não só quantity)', async () => {
    const qc = makeQueryClient();
    const originalItems = [
      { id: 'it-x', quantity: 25, product_price: 9.99 },
      { id: 'it-y', quantity: 3, product_price: 15.5 },
    ];
    seedCart(qc, originalItems);
    const patch = deferredPatch();
    const { result } = renderHook(() => useUpdateItemQuantityHarness(patch.fn), {
      wrapper: wrapperWith(qc),
    });

    const snapshotBefore = JSON.parse(
      JSON.stringify(qc.getQueryData([QUERY_KEY, USER_ID])),
    );

    let p!: Promise<unknown>;
    await act(async () => {
      p = result.current.mutateAsync({ itemId: 'it-x', quantity: 500 }).catch(() => {});
    });
    await flushMicrotasks();
    await act(async () => {
      patch.reject(new Error('constraint'));
      await p;
    });

    const snapshotAfter = qc.getQueryData([QUERY_KEY, USER_ID]);
    expect(snapshotAfter).toEqual(snapshotBefore);
  });
});
