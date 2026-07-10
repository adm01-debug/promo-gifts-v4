/**
 * useDebouncedCartItemActions
 * ===========================
 *
 * Envolve as mutations `updateItemQuantity` e `removeItem` de `useSellerCarts`
 * com uma camada de coalescência (debounce) + tracking de erro por item, sem
 * quebrar o comportamento otimista já existente no hook base.
 *
 * Objetivos:
 *  1. **Reduzir writes no banco** em cliques rápidos de +/-/lixeira.
 *     Cliques em sequência (< DEBOUNCE_MS) colapsam em um único UPDATE. A UI
 *     do popover reflete cada clique instantaneamente porque o cache
 *     TanStack Query é atualizado *localmente* a cada chamada — só a chamada
 *     de rede é debounced.
 *  2. **Rollback + erro claro por item.** Quando a mutation falha, o
 *     `onError` do hook base já restaura o snapshot no cache. Este wrapper
 *     adiciona um mapa `itemErrors[itemId] = mensagem`, para a UI destacar o
 *     item específico que falhou.
 *  3. **Deduplicação de DELETE.** Cliques rápidos na lixeira do mesmo item
 *     não disparam DELETEs paralelos.
 *  4. **Reconciliação garantida.** O `onSettled` das mutations base já chama
 *     `invalidateQueries`, então o estado converge ao servidor após qualquer
 *     mutation (sucesso ou erro).
 *
 * Não substitui o hook base — recebe as mutations dele por parâmetro. É
 * um adaptador puro, testável isoladamente.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { sanitizeError } from '@/lib/security/sanitize-error';
import { clampQuantity, type SellerCart } from './useSellerCarts';

/** Janela de debounce para coalescer cliques consecutivos no mesmo item. */
export const CART_ITEM_DEBOUNCE_MS = 300;

const QUERY_KEY = 'seller-carts';

type UpdateQtyMutation = UseMutationResult<
  void,
  Error,
  { itemId: string; quantity: number },
  unknown
>;
type RemoveItemMutation = UseMutationResult<void, Error, string, unknown>;

export interface DebouncedCartItemActions {
  /** Registra novo valor otimista + agenda o UPDATE. */
  updateItemQuantity: (itemId: string, quantity: number) => void;
  /** Deleta o item (dedupe se já houver DELETE em voo para o mesmo id). */
  removeItem: (itemId: string) => void;
  /** Força o flush dos writes pendentes (útil antes de navegação). */
  flushPendingWrites: () => void;
  /** Erros por item (mensagem sanitizada). */
  itemErrors: Record<string, string>;
  /** Limpa o erro de um item específico (após retry). */
  clearItemError: (itemId: string) => void;
}

export interface UseDebouncedCartItemActionsParams {
  userId: string | undefined;
  updateQtyMutation: UpdateQtyMutation;
  removeItemMutation: RemoveItemMutation;
  /** Override do debounce (usado nos testes p/ eliminar espera). */
  debounceMs?: number;
}

export function useDebouncedCartItemActions(
  params: UseDebouncedCartItemActionsParams,
): DebouncedCartItemActions {
  const {
    userId,
    updateQtyMutation,
    removeItemMutation,
    debounceMs = CART_ITEM_DEBOUNCE_MS,
  } = params;
  const queryClient = useQueryClient();

  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pendingQty = useRef(new Map<string, number>());
  const removingIds = useRef(new Set<string>());
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});

  const clearItemError = useCallback((itemId: string) => {
    setItemErrors((prev) => {
      if (!(itemId in prev)) return prev;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [itemId]: _drop, ...rest } = prev;
      return rest;
    });
  }, []);

  const setItemError = useCallback((itemId: string, err: unknown) => {
    setItemErrors((prev) => ({ ...prev, [itemId]: sanitizeError(err) }));
  }, []);

  /** Atualiza o cache TanStack Query — reflete o novo qty no popover imediatamente. */
  const applyOptimisticQty = useCallback(
    (itemId: string, quantity: number) => {
      queryClient.setQueryData<SellerCart[]>([QUERY_KEY, userId], (prev) =>
        prev
          ? prev.map((c) => ({
              ...c,
              items: c.items.map((it) =>
                it.id === itemId ? { ...it, quantity } : it,
              ),
            }))
          : prev,
      );
    },
    [queryClient, userId],
  );

  const flushWrite = useCallback(
    (itemId: string) => {
      const qty = pendingQty.current.get(itemId);
      if (qty === undefined) return;
      pendingQty.current.delete(itemId);
      updateQtyMutation.mutate(
        { itemId, quantity: qty },
        {
          onError: (err) => setItemError(itemId, err),
          onSuccess: () => clearItemError(itemId),
        },
      );
    },
    [updateQtyMutation, setItemError, clearItemError],
  );

  const scheduleWrite = useCallback(
    (itemId: string) => {
      const existing = timers.current.get(itemId);
      if (existing) clearTimeout(existing);
      const handle = setTimeout(() => {
        timers.current.delete(itemId);
        flushWrite(itemId);
      }, debounceMs);
      timers.current.set(itemId, handle);
    },
    [debounceMs, flushWrite],
  );

  const updateItemQuantity = useCallback(
    (itemId: string, quantity: number) => {
      const clamped = clampQuantity(quantity);
      pendingQty.current.set(itemId, clamped);
      applyOptimisticQty(itemId, clamped);
      clearItemError(itemId);
      scheduleWrite(itemId);
    },
    [applyOptimisticQty, clearItemError, scheduleWrite],
  );

  const removeItem = useCallback(
    (itemId: string) => {
      if (removingIds.current.has(itemId)) return;
      // Se havia um UPDATE de qty pendente, cancela — o DELETE torna irrelevante.
      const timer = timers.current.get(itemId);
      if (timer) {
        clearTimeout(timer);
        timers.current.delete(itemId);
        pendingQty.current.delete(itemId);
      }
      removingIds.current.add(itemId);
      removeItemMutation.mutate(itemId, {
        onError: (err) => setItemError(itemId, err),
        onSuccess: () => clearItemError(itemId),
        onSettled: () => {
          removingIds.current.delete(itemId);
        },
      });
    },
    [removeItemMutation, setItemError, clearItemError],
  );

  const flushPendingWrites = useCallback(() => {
    const ids = Array.from(timers.current.keys());
    for (const itemId of ids) {
      const t = timers.current.get(itemId);
      if (t) clearTimeout(t);
      timers.current.delete(itemId);
      flushWrite(itemId);
    }
  }, [flushWrite]);

  // Cleanup: flush best-effort dos writes pendentes ao desmontar
  useEffect(() => {
    const timersMap = timers.current;
    const pendingMap = pendingQty.current;
    return () => {
      for (const [itemId, timer] of timersMap) {
        clearTimeout(timer);
        const qty = pendingMap.get(itemId);
        if (qty !== undefined) {
          pendingMap.delete(itemId);
          try {
            updateQtyMutation.mutate({ itemId, quantity: qty });
          } catch {
            /* no-op — o cleanup não pode lançar */
          }
        }
      }
      timersMap.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    updateItemQuantity,
    removeItem,
    flushPendingWrites,
    itemErrors,
    clearItemError,
  };
}
