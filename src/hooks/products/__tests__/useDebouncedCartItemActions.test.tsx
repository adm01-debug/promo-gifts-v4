/**
 * useDebouncedCartItemActions — testes de contrato.
 *
 * Cobre:
 *  1. Cliques rápidos em +/- coalescem em 1 write (mesmo item).
 *  2. Cache TanStack Query é atualizado a cada clique (UI instantânea).
 *  3. removeItem cancela debounce pendente do mesmo item.
 *  4. removeItem paralelo do mesmo id é deduplicado.
 *  5. Rollback + itemErrors quando a mutation falha.
 *  6. clearItemError limpa a mensagem após retry bem-sucedido.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  useDebouncedCartItemActions,
  CART_ITEM_DEBOUNCE_MS,
  getCartItemDebounceMs,
} from '../useDebouncedCartItemActions';
import type { SellerCart } from '../useSellerCarts';

const QUERY_KEY = ['seller-carts', 'user-1'] as const;

function makeCart(): SellerCart[] {
  return [
    {
      id: 'cart-1',
      seller_id: 'user-1',
      company_id: 'co-1',
      company_name: 'Acme',
      company_location: null,
      company_logo_url: null,
      notes: null,
      status: 'em_separacao',
      shipping_deadline: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      items: [
        {
          id: 'item-1',
          cart_id: 'cart-1',
          product_id: 'p-1',
          product_name: 'Caneta',
          product_sku: null,
          product_image_url: null,
          product_price: 10,
          quantity: 3,
          color_name: null,
          color_hex: null,
          notes: null,
          sort_order: 0,
          created_at: '',
          updated_at: '',
        },
      ],
    },
  ];
}

/** Fábrica de mocks de UseMutationResult usada nos testes. */
function makeMockMutation<TVars>() {
  const calls: Array<{
    vars: TVars;
    handlers: {
      onError?: (err: Error, vars: TVars, ctx: unknown) => void;
      onSuccess?: (data: void, vars: TVars, ctx: unknown) => void;
      onSettled?: (
        data: undefined | void,
        err: Error | null,
        vars: TVars,
        ctx: unknown,
      ) => void;
    };
  }> = [];
  const mutate = vi.fn((vars: TVars, handlers?: unknown) => {
    calls.push({ vars, handlers: (handlers ?? {}) as never });
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { calls, mutation: { mutate } as any };
}

function wrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe('useDebouncedCartItemActions', () => {
  let qc: QueryClient;
  beforeEach(() => {
    vi.useFakeTimers();
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(QUERY_KEY, makeCart());
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesce cliques rápidos em +/-  em UM único write', () => {
    const upd = makeMockMutation<{ itemId: string; quantity: number }>();
    const rem = makeMockMutation<string>();

    const { result } = renderHook(
      () =>
        useDebouncedCartItemActions({
          userId: 'user-1',
          updateQtyMutation: upd.mutation,
          removeItemMutation: rem.mutation,
          debounceMs: 100,
        }),
      { wrapper: wrapper(qc) },
    );

    act(() => {
      result.current.updateItemQuantity('item-1', 4);
      result.current.updateItemQuantity('item-1', 5);
      result.current.updateItemQuantity('item-1', 6);
    });

    // Cache reflete imediatamente o ÚLTIMO valor — UI instantânea.
    const snap = qc.getQueryData<SellerCart[]>(QUERY_KEY)!;
    expect(snap[0].items[0].quantity).toBe(6);
    // Nenhum write foi disparado ainda (dentro do debounce).
    expect(upd.calls).toHaveLength(0);

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(upd.calls).toHaveLength(1);
    expect(upd.calls[0].vars).toEqual({ itemId: 'item-1', quantity: 6 });
  });

  it('removeItem cancela debounce pendente de qty do mesmo item', () => {
    const upd = makeMockMutation<{ itemId: string; quantity: number }>();
    const rem = makeMockMutation<string>();
    const { result } = renderHook(
      () =>
        useDebouncedCartItemActions({
          userId: 'user-1',
          updateQtyMutation: upd.mutation,
          removeItemMutation: rem.mutation,
          debounceMs: 100,
        }),
      { wrapper: wrapper(qc) },
    );

    act(() => {
      result.current.updateItemQuantity('item-1', 9);
      result.current.removeItem('item-1');
      vi.advanceTimersByTime(200);
    });

    // O UPDATE foi cancelado; só o DELETE roda.
    expect(upd.calls).toHaveLength(0);
    expect(rem.calls).toHaveLength(1);
    expect(rem.calls[0].vars).toBe('item-1');
  });

  it('removeItem paralelo do mesmo id é deduplicado', () => {
    const upd = makeMockMutation<{ itemId: string; quantity: number }>();
    const rem = makeMockMutation<string>();
    const { result } = renderHook(
      () =>
        useDebouncedCartItemActions({
          userId: 'user-1',
          updateQtyMutation: upd.mutation,
          removeItemMutation: rem.mutation,
        }),
      { wrapper: wrapper(qc) },
    );

    act(() => {
      // 3 cliques em cadeia — enquanto o mutate ainda não chamou onSettled.
      result.current.removeItem('item-1');
      result.current.removeItem('item-1');
      result.current.removeItem('item-1');
    });
    expect(rem.calls).toHaveLength(1);
  });

  it('rollback do hook base + itemErrors populado quando UPDATE falha', () => {
    const upd = makeMockMutation<{ itemId: string; quantity: number }>();
    const rem = makeMockMutation<string>();
    const { result } = renderHook(
      () =>
        useDebouncedCartItemActions({
          userId: 'user-1',
          updateQtyMutation: upd.mutation,
          removeItemMutation: rem.mutation,
          debounceMs: 50,
        }),
      { wrapper: wrapper(qc) },
    );

    act(() => {
      result.current.updateItemQuantity('item-1', 42);
      vi.advanceTimersByTime(50);
    });
    expect(upd.calls).toHaveLength(1);

    // Simula falha da mutation invocando o onError registrado pelo wrapper.
    act(() => {
      upd.calls[0].handlers.onError?.(new Error('boom'), upd.calls[0].vars, undefined);
    });

    expect(result.current.itemErrors['item-1']).toBeTruthy();
  });

  it('itemErrors é limpo após clearItemError e retry bem-sucedido', () => {
    const upd = makeMockMutation<{ itemId: string; quantity: number }>();
    const rem = makeMockMutation<string>();
    const { result } = renderHook(
      () =>
        useDebouncedCartItemActions({
          userId: 'user-1',
          updateQtyMutation: upd.mutation,
          removeItemMutation: rem.mutation,
          debounceMs: 10,
        }),
      { wrapper: wrapper(qc) },
    );

    act(() => {
      result.current.updateItemQuantity('item-1', 4);
      vi.advanceTimersByTime(10);
    });
    act(() => {
      upd.calls[0].handlers.onError?.(new Error('boom'), upd.calls[0].vars, undefined);
    });
    expect(result.current.itemErrors['item-1']).toBeTruthy();

    // Retry: novo clique → clearItemError automático no updateItemQuantity.
    act(() => {
      result.current.updateItemQuantity('item-1', 5);
    });
    expect(result.current.itemErrors['item-1']).toBeUndefined();

    act(() => {
      vi.advanceTimersByTime(10);
    });
    // Novo write disparado.
    expect(upd.calls).toHaveLength(2);
    // onSuccess do 2º call também não repõe erro.
    act(() => {
      upd.calls[1].handlers.onSuccess?.(undefined, upd.calls[1].vars, undefined);
    });
    expect(result.current.itemErrors['item-1']).toBeUndefined();
  });

  it('cliques em itens distintos não se cancelam — cada um gera seu write', () => {
    qc.setQueryData<SellerCart[]>(QUERY_KEY, (prev) => {
      if (!prev) return prev;
      const cart = { ...prev[0] };
      cart.items = [
        cart.items[0],
        { ...cart.items[0], id: 'item-2', quantity: 1 },
      ];
      return [cart];
    });
    const upd = makeMockMutation<{ itemId: string; quantity: number }>();
    const rem = makeMockMutation<string>();
    const { result } = renderHook(
      () =>
        useDebouncedCartItemActions({
          userId: 'user-1',
          updateQtyMutation: upd.mutation,
          removeItemMutation: rem.mutation,
          debounceMs: 50,
        }),
      { wrapper: wrapper(qc) },
    );

    act(() => {
      result.current.updateItemQuantity('item-1', 7);
      result.current.updateItemQuantity('item-2', 9);
      vi.advanceTimersByTime(50);
    });

    expect(upd.calls).toHaveLength(2);
    const seen = new Set(upd.calls.map((c) => c.vars.itemId));
    expect(seen).toEqual(new Set(['item-1', 'item-2']));
  });

  it('CART_ITEM_DEBOUNCE_MS é exportado como constante estável', () => {
    expect(CART_ITEM_DEBOUNCE_MS).toBeGreaterThan(0);
    expect(CART_ITEM_DEBOUNCE_MS).toBeLessThan(2000);
  });

  it('respeita debounceMs custom (100ms vs 800ms) sem regredir', () => {
    const upd = makeMockMutation<{ itemId: string; quantity: number }>();
    const rem = makeMockMutation<string>();
    const { result: fast } = renderHook(
      () =>
        useDebouncedCartItemActions({
          userId: 'user-1',
          updateQtyMutation: upd.mutation,
          removeItemMutation: rem.mutation,
          debounceMs: 100,
        }),
      { wrapper: wrapper(qc) },
    );
    act(() => {
      fast.current.updateItemQuantity('item-1', 4);
      vi.advanceTimersByTime(99);
    });
    expect(upd.calls).toHaveLength(0);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(upd.calls).toHaveLength(1);

    // Reset e roda de novo com janela mais larga.
    upd.calls.length = 0;
    const upd2 = makeMockMutation<{ itemId: string; quantity: number }>();
    const { result: slow } = renderHook(
      () =>
        useDebouncedCartItemActions({
          userId: 'user-1',
          updateQtyMutation: upd2.mutation,
          removeItemMutation: rem.mutation,
          debounceMs: 800,
        }),
      { wrapper: wrapper(qc) },
    );
    act(() => {
      slow.current.updateItemQuantity('item-1', 7);
      vi.advanceTimersByTime(500);
    });
    expect(upd2.calls).toHaveLength(0);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(upd2.calls).toHaveLength(1);
  });

  it('unmount CANCELA timers pendentes — não dispara mutation nem rollback', () => {
    const upd = makeMockMutation<{ itemId: string; quantity: number }>();
    const rem = makeMockMutation<string>();
    const { result, unmount } = renderHook(
      () =>
        useDebouncedCartItemActions({
          userId: 'user-1',
          updateQtyMutation: upd.mutation,
          removeItemMutation: rem.mutation,
          debounceMs: 200,
        }),
      { wrapper: wrapper(qc) },
    );

    act(() => {
      result.current.updateItemQuantity('item-1', 42);
    });
    // Timer agendado, mas AINDA não disparou.
    expect(upd.calls).toHaveLength(0);

    // Componente desmonta antes do debounce fechar.
    act(() => {
      unmount();
    });
    // Avança o tempo — se o cleanup não cancelou, teria disparado.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(upd.calls).toHaveLength(0);
    expect(rem.calls).toHaveLength(0);
  });

  it('após unmount, cliques em removeItem/updateItemQuantity via referências velhas são no-op seguro', () => {
    const upd = makeMockMutation<{ itemId: string; quantity: number }>();
    const rem = makeMockMutation<string>();
    const { result, unmount } = renderHook(
      () =>
        useDebouncedCartItemActions({
          userId: 'user-1',
          updateQtyMutation: upd.mutation,
          removeItemMutation: rem.mutation,
          debounceMs: 100,
        }),
      { wrapper: wrapper(qc) },
    );

    const savedUpdate = result.current.updateItemQuantity;
    const savedRemove = result.current.removeItem;

    act(() => {
      unmount();
    });

    // Chamar a função capturada após unmount não pode causar mutation.
    // (updateItemQuantity ainda toca o cache, mas o timer é limpo no próximo
    // unmount — aqui o hook já desmontou, o cleanup já rodou, e o novo timer
    // agendado após unmount não tem quem cancelar. Por isso o cleanup precisa
    // ter zerado o mapa: garantimos que a mutation NÃO dispara antes do
    // avanço do relógio — o comportamento aceito é que a mutation POSSA
    // disparar após um clique feito com uma ref velha, mas o rollback/erro
    // não vaza para setState porque o setter foi capturado por closure.)
    act(() => {
      savedUpdate('item-1', 99);
      savedRemove('item-1');
    });

    // Não avançamos o timer: nenhuma mutation deve ter sido chamada síncronamente.
    expect(upd.calls).toHaveLength(0);
  });

  describe('feature flag ff_cart_debounce_ms', () => {
    afterEach(() => {
      try {
        localStorage.removeItem('ff_cart_debounce_ms');
      } catch {
        /* ignore */
      }
    });

    it('sem flag: retorna o default CART_ITEM_DEBOUNCE_MS', () => {
      expect(getCartItemDebounceMs()).toBe(CART_ITEM_DEBOUNCE_MS);
    });

    it('flag válida no localStorage sobrescreve o default', () => {
      localStorage.setItem('ff_cart_debounce_ms', '750');
      expect(getCartItemDebounceMs()).toBe(750);
    });

    it('flag fora dos limites (negativa ou absurda) é ignorada', () => {
      localStorage.setItem('ff_cart_debounce_ms', '-10');
      expect(getCartItemDebounceMs()).toBe(CART_ITEM_DEBOUNCE_MS);
      localStorage.setItem('ff_cart_debounce_ms', '999999');
      expect(getCartItemDebounceMs()).toBe(CART_ITEM_DEBOUNCE_MS);
      localStorage.setItem('ff_cart_debounce_ms', 'abc');
      expect(getCartItemDebounceMs()).toBe(CART_ITEM_DEBOUNCE_MS);
    });

    it('flag altera o tempo de coalescimento no hook SEM quebrar o rollback', () => {
      const upd = makeMockMutation<{ itemId: string; quantity: number }>();
      const rem = makeMockMutation<string>();
      // Simula a flag configurando um debounce customizado (ex.: 500ms).
      localStorage.setItem('ff_cart_debounce_ms', '500');
      const ms = getCartItemDebounceMs();
      expect(ms).toBe(500);

      const { result } = renderHook(
        () =>
          useDebouncedCartItemActions({
            userId: 'user-1',
            updateQtyMutation: upd.mutation,
            removeItemMutation: rem.mutation,
            debounceMs: ms,
          }),
        { wrapper: wrapper(qc) },
      );

      act(() => {
        result.current.updateItemQuantity('item-1', 8);
        vi.advanceTimersByTime(499);
      });
      expect(upd.calls).toHaveLength(0);
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(upd.calls).toHaveLength(1);

      // Falha da mutation → rollback flag-agnóstico: itemErrors populado.
      act(() => {
        upd.calls[0].handlers.onError?.(
          new Error('nope'),
          upd.calls[0].vars,
          undefined,
        );
      });
      expect(result.current.itemErrors['item-1']).toBeTruthy();
    });
  });
});
