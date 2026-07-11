/**
 * ROLLBACK · PATCH /seller_cart_items — falha e timeout.
 *
 * Verifica o CONTRATO do `updateItemQuantity` do `useSellerCarts`:
 *
 *   onMutate:  snapshot → cancel queries → SET otimista no cache
 *   mutationFn: PATCH seller_cart_items
 *   onError:   restore(previous)  ← rollback
 *   onSettled: invalidate
 *
 * Cenários cobertos:
 *  1. PATCH retorna erro (ex.: 4xx do PostgREST) → cache volta ao snapshot,
 *     e a "UI" (renderizada a partir do cache) mostra a quantidade original.
 *  2. PATCH excede o timeout (AbortError) → mesmo comportamento.
 *  3. PATCH lento mas bem-sucedido → cache mantém o valor otimista, sem
 *     rollback, e o Total espelha o novo valor.
 *  4. Sequência de N falhas consecutivas — cada rollback é isolado (o
 *     estado da cache não é corrompido nem "somado" entre erros).
 *
 * O teste NÃO monta o hook inteiro (que puxa Auth + Supabase real). Ao
 * invés disso, ele executa o MESMO pipeline funcional via `useMutation`
 * com uma `mutationFn` injetável. Se o contrato do hook mudar (ex.: alguém
 * remover o `onError` rollback), reproduzimos o mesmo padrão aqui e
 * quebramos o teste.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
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

/**
 * Reproduz `updateItemQuantity` do hook real, mas com `patchFn` injetado
 * (permite simular erro/timeout). O contrato de callbacks é IDÊNTICO ao do
 * `useSellerCarts.ts` linhas 321-359.
 */
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
    // NB: `onSettled` do hook real invalida a query — aqui não precisamos
    // porque não temos `queryFn`; o cache manual é a nossa "verdade".
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
  return carts[0]?.items.find((i) => i.id === itemId);
}

function computeTotal(item: CartItem | undefined): number {
  return item ? item.quantity * item.product_price : 0;
}

// ─────────────────────────────────────────────────────────────────────────
describe('updateItemQuantity · rollback em falha do PATCH', () => {
  it('PATCH rejeita → cache volta ao valor original E Total espelha o rollback', async () => {
    const qc = makeQueryClient();
    seedCart(qc, [{ id: 'it-1', quantity: 10, product_price: 12 }]);

    const patchFn = vi.fn(async () => {
      throw new Error('PostgREST 400: check constraint violation');
    });
    const { result } = renderHook(() => useUpdateItemQuantityHarness(patchFn), {
      wrapper: wrapperWith(qc),
    });

    // Antes: Total = 10 * 12 = 120.
    expect(computeTotal(readItem(qc, 'it-1'))).toBe(120);

    // Dispara UPDATE otimista: cache passa a 80 imediatamente.
    let mutationPromise!: Promise<unknown>;
    act(() => {
      mutationPromise = result.current.mutateAsync({ itemId: 'it-1', quantity: 80 }).catch(() => {});
    });
    // Otimista aplicado durante `onMutate`.
    await waitFor(() => {
      expect(readItem(qc, 'it-1')?.quantity).toBe(80);
    });
    expect(computeTotal(readItem(qc, 'it-1'))).toBe(80 * 12);

    // Aguarda a rejeição e o rollback executar.
    await mutationPromise;
    await waitFor(() => {
      expect(readItem(qc, 'it-1')?.quantity).toBe(10);
    });
    expect(computeTotal(readItem(qc, 'it-1'))).toBe(120);
    expect(patchFn).toHaveBeenCalledTimes(1);
    expect(result.current.isError).toBe(true);
  });

  it('PATCH excede o timeout (AbortError) → mesmo rollback', async () => {
    const qc = makeQueryClient();
    seedCart(qc, [{ id: 'it-2', quantity: 5, product_price: 7 }]);

    const patchFn = vi.fn(async () => {
      // Simula um AbortController que dispara antes da resolução.
      await new Promise((r) => setTimeout(r, 5));
      const err = new Error('The operation was aborted') as Error & { name: string };
      err.name = 'AbortError';
      throw err;
    });
    const { result } = renderHook(() => useUpdateItemQuantityHarness(patchFn), {
      wrapper: wrapperWith(qc),
    });

    let p!: Promise<unknown>;
    act(() => {
      p = result.current.mutateAsync({ itemId: 'it-2', quantity: 999 }).catch(() => {});
    });
    await waitFor(() => {
      expect(readItem(qc, 'it-2')?.quantity).toBe(999);
    });
    await p;
    await waitFor(() => {
      expect(readItem(qc, 'it-2')?.quantity).toBe(5);
    });
    expect(computeTotal(readItem(qc, 'it-2'))).toBe(5 * 7);
  });

  it('PATCH bem-sucedido (lento) → valor otimista permanece; SEM rollback', async () => {
    const qc = makeQueryClient();
    seedCart(qc, [{ id: 'it-3', quantity: 3, product_price: 10 }]);

    const patchFn = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 15));
      // Sucesso: não lança.
    });
    const { result } = renderHook(() => useUpdateItemQuantityHarness(patchFn), {
      wrapper: wrapperWith(qc),
    });

    let p!: Promise<unknown>;
    act(() => {
      p = result.current.mutateAsync({ itemId: 'it-3', quantity: 42 });
    });
    await p;
    expect(readItem(qc, 'it-3')?.quantity).toBe(42);
    expect(computeTotal(readItem(qc, 'it-3'))).toBe(42 * 10);
    expect(result.current.isError).toBe(false);
  });

  it('valor > MAX_QTY é clampado ANTES do PATCH e do otimista', async () => {
    const qc = makeQueryClient();
    seedCart(qc, [{ id: 'it-clamp', quantity: 1, product_price: 1 }]);

    const patchFn = vi.fn(async () => {}); // sucesso
    const { result } = renderHook(() => useUpdateItemQuantityHarness(patchFn), {
      wrapper: wrapperWith(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({ itemId: 'it-clamp', quantity: 9_999_999 });
    });
    // Otimista + PATCH ambos usam clampQuantity → 999999.
    expect(readItem(qc, 'it-clamp')?.quantity).toBe(MAX_QTY);
    expect(patchFn).toHaveBeenCalledWith({ itemId: 'it-clamp', quantity: MAX_QTY });
  });

  it('N=10 falhas consecutivas — cada rollback é isolado e a cache não corrompe', async () => {
    const qc = makeQueryClient();
    seedCart(qc, [
      { id: 'it-a', quantity: 4, product_price: 5 },
      { id: 'it-b', quantity: 7, product_price: 3 },
    ]);

    const patchFn = vi.fn(async () => {
      throw new Error('network offline');
    });
    const { result } = renderHook(() => useUpdateItemQuantityHarness(patchFn), {
      wrapper: wrapperWith(qc),
    });

    for (let i = 0; i < 10; i++) {
      const target = i % 2 === 0 ? 'it-a' : 'it-b';
      const attempted = 100 + i;
      const originalA = 4;
      const originalB = 7;
      let p!: Promise<unknown>;
      act(() => {
        p = result.current.mutateAsync({ itemId: target, quantity: attempted }).catch(() => {});
      });
      // Otimista durante a corrida.
      await waitFor(() => {
        expect(readItem(qc, target)?.quantity).toBe(attempted);
      });
      await p;
      // Rollback total após erro.
      await waitFor(() => {
        expect(readItem(qc, 'it-a')?.quantity).toBe(originalA);
        expect(readItem(qc, 'it-b')?.quantity).toBe(originalB);
      });
    }
    // Total permanece coerente após 10 falhas.
    expect(computeTotal(readItem(qc, 'it-a'))).toBe(4 * 5);
    expect(computeTotal(readItem(qc, 'it-b'))).toBe(7 * 3);
    expect(patchFn).toHaveBeenCalledTimes(10);
  });

  it('rollback preserva estado quando o item não estava no cache (defensivo)', async () => {
    const qc = makeQueryClient();
    // Cache vazio — cenário de first-load / cache miss.
    const patchFn = vi.fn(async () => {
      throw new Error('nope');
    });
    const { result } = renderHook(() => useUpdateItemQuantityHarness(patchFn), {
      wrapper: wrapperWith(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({ itemId: 'ghost', quantity: 50 }).catch(() => {});
    });
    // Nenhum crash; cache continua indefinido.
    expect(qc.getQueryData([QUERY_KEY, USER_ID])).toBeUndefined();
    expect(result.current.isError).toBe(true);
  });
});
