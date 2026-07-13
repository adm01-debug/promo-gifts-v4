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
import { newRequestId } from '@/lib/telemetry/requestId';

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
      // Correlation ID transitório do fluxo delete→undo. Anexado ao snapshot
      // devolvido para que `restoreCart` propague o MESMO id nos eventos
      // subsequentes (`restore_start` / `restore_ok` / `restore_failed`),
      // permitindo agrupar traces no Sentry e no logger por `correlation_id`.
      const correlationId = newRequestId();
      const deletedItemsTotal = deletedSnapshot?.items?.length ?? 0;
      restoreLog.info('delete_ok', {
        correlation_id: correlationId,
        snapshot_id: deletedSnapshot?.id ?? cartId,
        company_id: deletedSnapshot?.company_id ?? null,
        items_total: deletedItemsTotal,
        hydrated: deletedItemsTotal > 0,
      });
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
      return { ...deletedSnapshot, _correlation_id: correlationId };
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
      // Correlation ID propagado do `deleteCart` (ver `_correlation_id`).
      // Se o snapshot chegou por outro caminho (ex.: chamada direta em testes
      // ou fluxo legado), geramos um novo aqui para manter o schema estável.
      const correlationId = snapshot?._correlation_id ?? newRequestId();


      // Guarda anti-restore vazio: se o snapshot chegou sem itens (ex.: cache
      // parcial no momento do delete), NÃO chama a RPC — ela reconstruiria um
      // carrinho vazio silenciosamente. Emitimos telemetria + toast orientando
      // o usuário a recarregar antes de tentar de novo.
      if (itemsCount === 0) {
        restoreLog.warn('restore_skipped_empty_snapshot', {
          correlation_id: correlationId,
          snapshot_id: snapshot?.id ?? null,
          company_id: snapshot?.company_id ?? null,
          reason: 'empty_snapshot',
          items_total: 0,
          items_inserted: 0,
          items_deduped: 0,
          hydrated: false,
          restore_result: 'skipped_empty' as const,
          duration_ms: 0,
        });
        toast.error('Não foi possível desfazer: snapshot sem itens.', {
          description:
            'O carrinho foi excluído antes de terminar de carregar. Recarregue a página e tente novamente antes de excluir.',
        });
        return undefined;
      }

      // Marca o início da restauração com o snapshot já validado (>=1 item).
      // Permite correlacionar `delete_ok` → `restore_start` → `restore_ok/failed`
      // por `snapshot_id` no Sentry/console e detectar regressão de hidratação
      // (ex.: `items_total` cair para 0 entre delete e restore).
      restoreLog.info('restore_start', {
        correlation_id: correlationId,
        snapshot_id: snapshot?.id ?? null,
        company_id: snapshot?.company_id ?? null,
        items_total: itemsCount,
        hydrated: true,
      });

      // Mede o tempo total da restauração (RPC + fallback + pós-processamento)
      // com relógio monotônico — imune a ajuste de horário do sistema.
      const startedAt = (typeof performance !== 'undefined' ? performance : Date).now();
      const elapsedMs = () =>
        Math.round((typeof performance !== 'undefined' ? performance : Date).now() - startedAt);

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
        // `restore_result` categoriza o desfecho para dashboards:
        //   success        → todos os itens do snapshot inseridos.
        //   partial        → RPC ok mas items_inserted < items_total (RLS parcial, ON CONFLICT).
        //   deduped        → itens duplicados no snapshot foram colapsados no INSERT.
        //   ok_no_metrics  → RPC/fallback sem `restore_metrics` (ex.: schema legado).
        const restoreResult: 'success' | 'partial' | 'deduped' | 'ok_no_metrics' = metrics
          ? metrics.items_inserted < metrics.items_total
            ? 'partial'
            : metrics.items_deduped > 0
              ? 'deduped'
              : 'success'
          : 'ok_no_metrics';

        // `items_resulting`: contagem inequívoca de itens que o Undo deixou
        // no carrinho recriado — SSOT para validar a consequência real da
        // restauração em produção. Ordem de preferência:
        //   1) `restore_metrics.items_inserted` (RPC atômica devolve o valor
        //      exato de linhas inseridas em `seller_cart_items`).
        //   2) `created.items.length` (fallback client-side devolve o array
        //      já hidratado com o que entrou de fato).
        //   3) `null` — schema legado sem nenhuma das duas fontes.
        const createdItemsLength = Array.isArray(created?.items) ? created.items.length : null;
        const itemsResulting = metrics?.items_inserted ?? createdItemsLength ?? null;

        restoreLog.info('restore_ok', {
          correlation_id: correlationId,
          snapshot_id: snapshot?.id ?? null,
          new_cart_id: created?.id ?? null,
          company_id: snapshot?.company_id ?? null,
          items_total: metrics?.items_total ?? itemsCount,
          items_inserted: metrics?.items_inserted ?? null,
          items_resulting: itemsResulting,
          items_deduped: metrics?.items_deduped ?? null,
          // Hidratação sempre `true` aqui — a guarda anti-vazio já bloqueou 0.
          hydrated: true,
          restore_result: restoreResult,
          duration_ms: elapsedMs(),
          // Sinaliza para dashboards quando o payload chegou "sujo" (dedup
          // necessária ou algum ON CONFLICT DO NOTHING descartou linha).
          has_dedup: (metrics?.items_deduped ?? 0) > 0,
          partial_insert: metrics
            ? metrics.items_inserted !== metrics.items_total
            : false,
          // Divergência entre o que o snapshot pediu e o que sobrou de fato
          // — dispara alerta para RLS parcial ou perda silenciosa de linhas.
          items_mismatch:
            itemsResulting !== null && itemsResulting !== itemsCount,
        });


        if (metrics) {
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
          correlation_id: correlationId,
          snapshot_id: snapshot?.id ?? null,
          items_count: itemsCount,
          items_total: itemsCount,
          hydrated: true,
          restore_result: 'failed' as const,
          duration_ms: elapsedMs(),
          company_id: snapshot?.company_id ?? null,
          pg_code: pgCode || null,
          pg_details: pgDetails || null,
          pg_hint: pgHint || null,
          reason: mapped.reason,
          // Métricas vazias no erro (a RPC não retornou nada), mas o schema
          // permanece consistente para dashboards agregarem success + failure.
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
