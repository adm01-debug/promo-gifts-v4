/**
 * SellerCartContext - Contexto global para carrinhos de vendedor
 * Expõe dados e operações do carrinho em toda a aplicação
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import {
  useSellerCarts,
  type SellerCart,
  type AddToCartInput,
  type CreateCartInput,
  type CartStatus,
} from '@/hooks/products';
import { useDebouncedCartItemActions, getCartItemDebounceMs } from '@/hooks/products/useDebouncedCartItemActions';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';
import { mapRestoreCartError } from '@/pages/products/seller-carts/mapRestoreCartError';
import { createClientLogger } from '@/lib/telemetry/structuredLogger';

// Logger de escopo dedicado — emite JSON estruturado em PROD e encaminha
// falhas ao Sentry automaticamente (level=error → captureException com tags
// `scope`, `event`, `request_id`).
const restoreLog = createClientLogger('seller_cart.restore');


interface SellerCartContextType {
  // Data
  carts: SellerCart[];
  activeCart: SellerCart | null;
  activeCartId: string | null;
  isLoading: boolean;
  totalItems: number;
  canCreateCart: boolean;

  // Active cart management
  setActiveCartId: (id: string | null) => void;

  // Operations
  createCart: (input: CreateCartInput) => Promise<SellerCart | undefined>;
  deleteCart: (cartId: string) => Promise<SellerCart>;
  /** Recria um carrinho a partir do snapshot (Undo). Resolve com o novo `id` ou `undefined` em falha. */
  restoreCart: (snapshot: SellerCart) => Promise<string | undefined>;
  isDeletingCart: boolean;
  addToActiveCart: (
    item: AddToCartInput,
    cartId?: string,
    options?: { silent?: boolean },
  ) => Promise<boolean>;
  removeItem: (itemId: string) => void;
  updateItemQuantity: (itemId: string, quantity: number) => void;
  updateItemNotes: (itemId: string, notes: string) => void;
  updateItemSortOrder: (items: { id: string; sort_order: number }[]) => void;
  updateCartNotes: (cartId: string, notes: string) => void;
  flushCartNotes: (cartId: string, notes: string) => Promise<boolean>;
  updateCartStatus: (cartId: string, status: CartStatus) => void;
  updateCartShippingDeadline: (cartId: string, shippingDeadline: string | null) => void;
  duplicateCart: (cartId: string) => void;
  moveItemToCart: (itemId: string, targetCartId: string) => void;
  duplicateItemToCart: (itemId: string, targetCartId: string) => void;
  clearCart: (cartId: string) => Promise<void>;
  restoreItems: (cartId: string, items: AddToCartInput[]) => void;
  /** Mapa de erros por item (rollback aplicado; UI mostra mensagem clara). */
  itemErrors: Record<string, string>;
  /** Limpa o erro exibido para um item (após retry pelo usuário). */
  clearItemError: (itemId: string) => void;
}

const SellerCartContext = createContext<SellerCartContextType | undefined>(undefined);
const ACTIVE_CART_STORAGE_KEY = 'seller:active-cart-id';

export function SellerCartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const {
    carts,
    isLoading,
    totalItems,
    canCreateCart,
    createCart: createCartMutation,
    deleteCart: deleteCartMutation,
    addItem,
    removeItem: removeItemMutation,
    updateItemQuantity: updateQtyMutation,
    updateItemNotes: updateNotesMutation,
    updateItemSortOrder: updateSortMutation,
    updateCartNotes: updateCartNotesMutation,
    updateCartStatus: updateCartStatusMutation,
    updateCartShippingDeadline: updateCartShippingDeadlineMutation,
    duplicateCart: duplicateCartMutation,
    moveItemToCart: moveItemMutation,
    duplicateItemToCart: duplicateItemMutation,
    clearCart: clearCartMutation,
    restoreItems: restoreItemsMutation,
    restoreCartWithItems: restoreCartWithItemsMutation,
  } = useSellerCarts();

  const [activeCartId, setActiveCartId] = useState<string | null>(null);

  // Hidrata o carrinho ativo persistido com chave namespeada por usuario — evita que,
  // numa estacao compartilhada, um vendedor herde o carrinho ativo de outro. Enquanto
  // nao hidrata, resolvedActiveCartId ja cai em carts[0] (sem UX quebrada).
  useEffect(() => {
    if (!user?.id) {
      setActiveCartId(null);
      return;
    }
    try {
      setActiveCartId(localStorage.getItem(`${ACTIVE_CART_STORAGE_KEY}:${user.id}`));
    } catch {
      setActiveCartId(null);
    }
  }, [user?.id]);

  const resolvedActiveCartId = useMemo(
    () =>
      activeCartId && carts.find((c) => c.id === activeCartId)
        ? activeCartId
        : carts.length > 0
          ? carts[0].id
          : null,
    [activeCartId, carts],
  );

  const activeCart = useMemo(
    () => carts.find((c) => c.id === resolvedActiveCartId) ?? null,
    [carts, resolvedActiveCartId],
  );

  // Persiste apenas selecoes explicitas (nao-nulas) sob a chave do usuario. Nao
  // persistir null impede o clobber do valor recem-hidratado no primeiro render.
  useEffect(() => {
    if (!user?.id || !activeCartId) return;
    try {
      localStorage.setItem(`${ACTIVE_CART_STORAGE_KEY}:${user.id}`, activeCartId);
    } catch {
      // no-op: storage unavailable
    }
  }, [activeCartId, user?.id]);

  const createCart = useCallback(
    async (input: CreateCartInput) => {
      try {
        const result = await createCartMutation.mutateAsync(input);
        if (result) {
          setActiveCartId(result.id);
          toast.success(`Carrinho criado para ${input.company_name}`);
        }
        return result;
      } catch (err) {
        toast.error('Erro ao criar carrinho', {
          description: sanitizeError(err),
        });
        return undefined;
      }
    },
    [createCartMutation],
  );

  const deleteCart = useCallback(
    async (cartId: string): Promise<SellerCart> => {
      // Limpa histórico/seleção SOMENTE após o delete confirmar. Antes isso rodava
      // de forma otimista: se o DELETE falhasse (RLS/rede), o carrinho reaparecia
      // na lista mas com o histórico de ações perdido e a seleção ativa descartada.
      const deletedSnapshot = await deleteCartMutation.mutateAsync(cartId);
      if (activeCartId === cartId) {
        setActiveCartId(null);
        if (user?.id) {
          try {
            localStorage.removeItem(`${ACTIVE_CART_STORAGE_KEY}:${user.id}`);
          } catch {
            // no-op: storage unavailable
          }
        }
      }
      return deletedSnapshot;
    },
    [deleteCartMutation, activeCartId, user?.id],
  );

  // Retorna Promise<boolean> (true = adicionado) para que chamadores em lote
  // (bulk/template) consigam aguardar e reportar contagem real de sucesso/falha
  // em vez de assumir sucesso (fire-and-forget). Nunca rejeita: o onError do
  // mutation já exibe o toast de falha; aqui devolvemos false.
  const addToActiveCart = useCallback(
    async (
      item: AddToCartInput,
      cartId?: string,
      options?: { silent?: boolean },
    ): Promise<boolean> => {
      const targetId = cartId || resolvedActiveCartId;

      if (!targetId) {
        toast.error('Selecione uma empresa antes de adicionar produtos', {
          description: 'Crie um carrinho vinculado a uma empresa primeiro.',
        });
        return false;
      }

      const targetCart = carts.find((c) => c.id === targetId);

      try {
        await addItem.mutateAsync({ cartId: targetId, item });
        // silent: usado em lote (template/bulk) onde o chamador exibe um
        // único toast agregado — evita N toasts empilhados.
        if (!options?.silent) {
          toast.success(`${item.product_name} adicionado ao carrinho`, {
            description: targetCart?.company_name,
          });
        }
        // Update active cart if we explicitly added to a specific one
        if (cartId && cartId !== resolvedActiveCartId) {
          setActiveCartId(cartId);
        }
        return true;
      } catch {
        return false;
      }
    },
    [resolvedActiveCartId, addItem, carts],
  );

  // Camada de debounce + tracking de erro por item. Cliques rápidos em +/- e
  // lixeira colapsam em um único write (economizando round-trips) enquanto a
  // UI reflete cada clique instantaneamente via update otimista no cache.
  const {
    updateItemQuantity,
    removeItem,
    itemErrors,
    clearItemError,
  } = useDebouncedCartItemActions({
    userId: user?.id,
    updateQtyMutation,
    removeItemMutation,
    debounceMs: getCartItemDebounceMs(),
  });

  const updateItemNotes = useCallback(
    (itemId: string, notes: string) => {
      updateNotesMutation.mutate({ itemId, notes });
    },
    [updateNotesMutation],
  );

  const updateItemSortOrder = useCallback(
    (items: { id: string; sort_order: number }[]) => {
      updateSortMutation.mutate(items);
    },
    [updateSortMutation],
  );

  const updateCartNotes = useCallback(
    (cartId: string, notes: string) => {
      updateCartNotesMutation.mutate({ cartId, notes });
    },
    [updateCartNotesMutation],
  );

  // Awaitable version of updateCartNotes for the pre-navigation flush path.
  // Returns true when the save succeeds, false on error — caller decides
  // whether to warn the user. Navigation always proceeds (non-blocking).
  const flushCartNotes = useCallback(
    async (cartId: string, notes: string): Promise<boolean> => {
      try {
        await updateCartNotesMutation.mutateAsync({ cartId, notes });
        return true;
      } catch {
        return false;
      }
    },
    [updateCartNotesMutation],
  );

  const updateCartStatus = useCallback(
    (cartId: string, status: CartStatus) => {
      updateCartStatusMutation.mutate({ cartId, status });
    },
    [updateCartStatusMutation],
  );

  const updateCartShippingDeadline = useCallback(
    (cartId: string, shippingDeadline: string | null) => {
      updateCartShippingDeadlineMutation.mutate({ cartId, shippingDeadline });
    },
    [updateCartShippingDeadlineMutation],
  );

  const duplicateCartFn = useCallback(
    (cartId: string) => {
      duplicateCartMutation.mutate(cartId);
    },
    [duplicateCartMutation],
  );

  const moveItemToCart = useCallback(
    (itemId: string, targetCartId: string) => {
      moveItemMutation.mutate({ itemId, targetCartId });
    },
    [moveItemMutation],
  );

  const duplicateItemToCart = useCallback(
    (itemId: string, targetCartId: string) => {
      duplicateItemMutation.mutate({ itemId, targetCartId });
    },
    [duplicateItemMutation],
  );

  const clearCart = useCallback(
    async (cartId: string) => {
      try {
        await clearCartMutation(cartId);
        setActiveCartId(cartId);
      } catch (err) {
        toast.error('Erro ao limpar carrinho');
        throw err; // propaga para o caller poder abortar o fluxo pós-clear (ex: undo toast)
      }
    },
    [clearCartMutation],
  );

  const restoreItems = useCallback(
    (cartId: string, items: AddToCartInput[]) => {
      restoreItemsMutation.mutate({ cartId, items });
    },
    [restoreItemsMutation],
  );

  const restoreCart = useCallback(
    async (snapshot: SellerCart): Promise<string | undefined> => {
      const itemsCount = snapshot?.items?.length ?? 0;
      try {
        const created = await restoreCartWithItemsMutation.mutateAsync(snapshot);
        // Após restaurar, garante que o ponteiro do carrinho ativo (localStorage)
        // não fique apontando para o id ANTIGO/inexistente do snapshot. Se não há
        // seleção ativa (típico após excluir o carrinho ativo), auto-foca no
        // carrinho restaurado; se o ponteiro atual coincide com o id do snapshot
        // (defensivo — não deveria acontecer, pois deleteCart já limpou), corrige.
        if (created?.id) {
          setActiveCartId((prev) => {
            if (!prev) return created.id;
            if (prev === snapshot.id) return created.id;
            return prev;
          });
        }

        // Métricas da RPC — telemetria estruturada (JSON + Sentry) + toast
        // com contagem inteligente quando houver dedup ou divergência entre
        // `items_total` e `items_inserted` (senão o toast fica limpo).
        const metrics = created?.restore_metrics;
        if (metrics) {
          restoreLog.info('restore_ok', {
            snapshot_id: snapshot?.id ?? null,
            new_cart_id: created.id,
            company_id: snapshot?.company_id ?? null,
            items_total: metrics.items_total,
            items_inserted: metrics.items_inserted,
            items_deduped: metrics.items_deduped,
            // Sinaliza para dashboards quando o payload chegou "sujo" (dedup
            // necessária ou algum ON CONFLICT DO NOTHING descartou linha).
            has_dedup: metrics.items_deduped > 0,
            partial_insert: metrics.items_inserted !== metrics.items_total,
          });

          const parts: string[] = [`snapshot ${snapshot?.id ?? '—'}`];
          if (metrics.items_deduped > 0 || metrics.items_inserted !== metrics.items_total) {
            parts.push(
              `${metrics.items_inserted}/${metrics.items_total} itens inseridos` +
                (metrics.items_deduped > 0
                  ? ` · ${metrics.items_deduped} deduplicado(s)`
                  : ''),
            );
          } else {
            parts.push(`${metrics.items_total} item(ns)`);
          }
          toast.success('Carrinho restaurado.', { description: parts.join(' · ') });
        }

        return created?.id;
      } catch (err) {
        // Sem este bloco o erro real (RLS, coluna, unique, FK) era engolido
        // pelo `catch {}` original e o usuário só via um toast genérico sem
        // pista. Agora: telemetria estruturada (level=error → Sentry) +
        // description específica por SQLSTATE + snapshot_id / items_count.
        // O fallback usa `sanitizeError` para garantir que nada sensível vaze.
        const rawMessage =
          err instanceof Error
            ? err.message
            : err && typeof err === 'object' && 'message' in err
              ? String((err as { message: unknown }).message)
              : String(err);
        const pgCode =
          err && typeof err === 'object' && 'code' in err
            ? String((err as { code: unknown }).code ?? '')
            : '';
        const pgDetails =
          err && typeof err === 'object' && 'details' in err
            ? String((err as { details: unknown }).details ?? '')
            : '';
        const pgHint =
          err && typeof err === 'object' && 'hint' in err
            ? String((err as { hint: unknown }).hint ?? '')
            : '';
        const mapped = mapRestoreCartError(err);
        // `err` no payload aciona `captureException` no Sentry via structuredLogger
        // e é serializado como { name, message, stack } no log JSON.
        restoreLog.error('restore_failed', {
          snapshot_id: snapshot?.id ?? null,
          items_count: itemsCount,
          company_id: snapshot?.company_id ?? null,
          pg_code: pgCode || null,
          pg_details: pgDetails || null,
          pg_hint: pgHint || null,
          reason: mapped.reason,
          // Métricas vazias no erro (a RPC não retornou nada), mas o schema
          // permanece consistente para dashboards agregarem success + failure.
          items_total: null,
          items_inserted: null,
          items_deduped: null,
          raw_error: rawMessage,
          err,
        });
        toast.error(mapped.title ?? 'Não foi possível restaurar o carrinho.', {
          description: `${mapped.description} · snapshot ${snapshot?.id ?? '—'} · ${itemsCount} item(ns)`,
        });
        return undefined;
      }
    },
    [restoreCartWithItemsMutation],
  );

  const ctxValue = useMemo(
    () => ({
      carts,
      activeCart,
      activeCartId: resolvedActiveCartId,
      isLoading,
      totalItems,
      canCreateCart,
      setActiveCartId,
      createCart,
      deleteCart,
      restoreCart,
      isDeletingCart: deleteCartMutation.isPending,
      addToActiveCart,
      removeItem,
      updateItemQuantity,
      updateItemNotes,
      updateItemSortOrder,
      updateCartNotes,
      flushCartNotes,
      updateCartStatus,
      updateCartShippingDeadline,
      duplicateCart: duplicateCartFn,
      moveItemToCart,
      duplicateItemToCart,
      clearCart,
      restoreItems,
      itemErrors,
      clearItemError,
    }),
    [
      carts,
      activeCart,
      resolvedActiveCartId,
      isLoading,
      totalItems,
      canCreateCart,
      setActiveCartId,
      createCart,
      deleteCart,
      restoreCart,
      deleteCartMutation.isPending,
      addToActiveCart,
      removeItem,
      updateItemQuantity,
      updateItemNotes,
      updateItemSortOrder,
      updateCartNotes,
      flushCartNotes,
      updateCartStatus,
      updateCartShippingDeadline,
      duplicateCartFn,
      moveItemToCart,
      duplicateItemToCart,
      clearCart,
      restoreItems,
      itemErrors,
      clearItemError,
    ],
  );

  return <SellerCartContext.Provider value={ctxValue}>{children}</SellerCartContext.Provider>;
}

/** useSellerCartContext — lança erro se o contexto estiver ausente (uso normal). */
export function useSellerCartContext() {
  const context = useContext(SellerCartContext);
  if (!context) {
    throw new Error('useSellerCartContext must be used within SellerCartProvider');
  }
  return context;
}

/**
 * useSellerCartContextSafe — retorna null em vez de lançar erro quando o contexto está ausente.
 *
 * Usar em componentes que precisam renderizar dentro de Suspense fallbacks, durante HMR
 * ou em qualquer contexto onde o SellerCartProvider pode não ter montado ainda.
 * O componente consumidor é responsável por lidar com o retorno null.
 *
 * Resolve: 21.664 unhandled_error + 5.123 React_Boundary_Error em frontend_telemetry.
 */
export function useSellerCartContextSafe() {
  return useContext(SellerCartContext) ?? null;
}
