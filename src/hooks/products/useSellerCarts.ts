/**
 * useSellerCarts - Hook para gerenciar carrinhos de vendedor
 * Persiste no banco de dados, máx MAX_SELLER_CARTS carrinhos simultâneos
 */

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';
import { createClientLogger } from '@/lib/telemetry/structuredLogger';
import { isBadJwtError, maybeRecoverFromError } from '@/lib/auth/session-recovery';
import { SELLER_CART_TOASTS } from './sellerCartToasts';

const cartDeleteLog = createClientLogger('cart.delete');

/** Sentinel: DELETE respondeu 2xx mas nenhuma linha foi removida (RLS silencioso ou id já removido). */
export class CartDeleteZeroRowsError extends Error {
  public readonly code = 'cart_delete_zero_rows' as const;
  constructor(message = 'Nenhuma linha foi removida.') {
    super(message);
    this.name = 'CartDeleteZeroRowsError';
  }
}

/** Teto máximo de carrinhos simultâneos por vendedor (enforcement client-side; backend não impõe). */
export const MAX_SELLER_CARTS = 50;

/** Mensagem padrão (SSOT) para limite de carrinhos atingido — tooltips/aria-labels. */
export const SELLER_CART_LIMIT_REACHED_MESSAGE = `Limite de ${MAX_SELLER_CARTS} carrinhos atingido. Exclua um carrinho para criar outro.`;
/** Versão curta (para toasts e títulos compactos). */
export const SELLER_CART_LIMIT_REACHED_SHORT = `Limite de ${MAX_SELLER_CARTS} carrinhos atingido`;

/**
 * Detecta se um erro do Supabase corresponde ao limite de carrinhos.
 * Fallback robusto: cobre code 23514 (check_violation), P0001 (RAISE genérico)
 * e variações de mensagem (caso o trigger mude o texto no futuro).
 */
function isCartLimitError(
  err: { code?: string; message?: string | null } | null | undefined,
): boolean {
  if (!err) return false;
  if (err.code === '23514' || err.code === 'P0001') return true;
  const msg = err.message ?? '';
  return /Limite de \d+ carrinhos?/i.test(msg) || /cart.*limit|carrinho.*atingid/i.test(msg);
}

// ============================================
// TYPES
// ============================================

export interface SellerCart {
  id: string;
  seller_id: string;
  company_id: string;
  company_name: string;
  company_location: string | null;
  company_logo_url: string | null;
  notes: string | null;
  status: CartStatus;
  /** Prazo p/ envio: data limite (YYYY-MM-DD) para enviar o pedido ao cliente. Null quando não definido. */
  shipping_deadline: string | null;
  created_at: string;
  updated_at: string;
  items: SellerCartItem[];
  /**
   * Correlation ID transitório (não persistido) atribuído em `deleteCart` e
   * propagado para os eventos `restore_start` / `restore_ok` / `restore_failed`
   * a fim de correlacionar o fluxo delete→undo no logger e no Sentry.
   */
  _correlation_id?: string;
}

/** Métricas retornadas pela RPC `restore_seller_cart`. */
export interface RestoreCartMetrics {
  /** Total de itens no snapshot enviado à RPC. */
  items_total: number;
  /** Itens efetivamente inseridos (após dedup + ON CONFLICT DO NOTHING). */
  items_inserted: number;
  /** Itens deduplicados por (product_id, color_name) — quantidades foram somadas. */
  items_deduped: number;
}

/** SellerCart devolvido pela mutation de restore, com métricas da RPC anexadas. */
export interface RestoredSellerCart extends SellerCart {
  restore_metrics: RestoreCartMetrics;
}

export interface SellerCartItem {
  id: string;
  cart_id: string;
  product_id: string;
  product_name: string;
  product_sku: string | null;
  product_image_url: string | null;
  product_price: number;
  quantity: number;
  color_name: string | null;
  color_hex: string | null;
  notes: string | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface AddToCartInput {
  product_id: string;
  product_name: string;
  product_sku?: string;
  product_image_url?: string;
  product_price: number;
  quantity?: number;
  color_name?: string;
  color_hex?: string;
  notes?: string | null;
  sort_order?: number;
}

export interface CreateCartInput {
  company_id: string;
  company_name: string;
  company_location?: string;
  company_logo_url?: string;
}

export type CartStatus = 'em_separacao' | 'pronto_orcamento';

// Raw row returned by Supabase nested select: `seller_carts.*, seller_cart_items(*)`
type SellerCartRawRow = Omit<SellerCart, 'items'> & {
  seller_cart_items: SellerCartItem[];
};

interface RestorePayloadItem {
  product_id: string;
  product_name: string;
  product_sku: string | null;
  product_image_url: string | null;
  product_price: number;
  quantity: number;
  color_name: string | null;
  color_hex: string | null;
  notes: string | null;
  sort_order: number | null;
}

interface RestorePayload {
  seller_id: string;
  company_id: string;
  company_name: string;
  company_location: string | null;
  company_logo_url: string | null;
  notes: string | null;
  status: CartStatus;
  shipping_deadline: string | null;
  items: RestorePayloadItem[];
}

interface RestoreRpcResponse {
  cart_id: string;
  items_total: number;
  items_inserted: number;
  items_deduped: number;
}

interface ErrorWithPostgrestShape {
  code?: unknown;
  message?: unknown;
  status?: unknown;
}

const QUERY_KEY = 'seller-carts';

// ============================================
// INVARIANTE DE QUANTIDADE (espelha o CHECK do banco: 1 <= quantity <= 999999)
// ============================================
// Single source of truth para todos os caminhos de escrita (edição direta E
// mesclagem por add/move/duplicate). Antes, só updateItemQuantity clampava o
// teto; os caminhos de merge somavam `existing + qty` sem teto, podendo derivar
// acima do limite da UI e (sem o CHECK de teto) até estourar o int4 no banco.
export const MIN_ITEM_QUANTITY = 1;
export const MAX_ITEM_QUANTITY = 999999;
export const clampQuantity = (q: number): number =>
  Math.min(Math.max(Math.trunc(Number(q) || 0), MIN_ITEM_QUANTITY), MAX_ITEM_QUANTITY);

function toSellerCart(row: SellerCartRawRow): SellerCart {
  const { seller_cart_items: rowItems, ...cart } = row;
  return {
    ...cart,
    notes: (cart.notes as string | null) ?? null,
    status: ((cart.status as string) ?? 'em_separacao') as CartStatus,
    shipping_deadline: (cart.shipping_deadline as string | null) ?? null,
    items: (rowItems ?? []) as SellerCartItem[],
  };
}

function errorCode(input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  const value = (input as ErrorWithPostgrestShape).code;
  // eslint-disable-next-line eqeqeq, no-eq-null -- checagem intencional de null/undefined
  return value == null ? '' : String(value);
}

function errorMessage(input: unknown): string {
  if (input instanceof Error) return input.message;
  if (!input || typeof input !== 'object') return String(input ?? '');
  const value = (input as ErrorWithPostgrestShape).message;
  // eslint-disable-next-line eqeqeq, no-eq-null -- checagem intencional de null/undefined
  return value == null ? '' : String(value);
}

function isRestoreRpcUnavailableError(input: unknown): boolean {
  const code = errorCode(input);
  const message = errorMessage(input);
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    /supabase\.rpc is not a function/i.test(message) ||
    (/restore_seller_cart/i.test(message) &&
      /schema cache|could not find|function .* does not exist|not found/i.test(message))
  );
}

function restoreVariantKey(item: RestorePayloadItem): string {
  return `${item.product_id}\u001f${item.color_name ?? '__NULL__'}`;
}

function dedupeRestorePayloadItems(items: RestorePayloadItem[]): RestorePayloadItem[] {
  const deduped = new Map<string, RestorePayloadItem>();

  for (const item of items) {
    if (!item.product_id) continue;
    const key = restoreVariantKey(item);
    const current = deduped.get(key);
    if (!current) {
      deduped.set(key, { ...item, quantity: clampQuantity(item.quantity) });
      continue;
    }
    deduped.set(key, {
      ...current,
      quantity: clampQuantity(current.quantity + item.quantity),
      product_name: current.product_name || item.product_name,
      product_sku: current.product_sku ?? item.product_sku,
      product_image_url: current.product_image_url ?? item.product_image_url,
      product_price: current.product_price || item.product_price,
      color_hex: current.color_hex ?? item.color_hex,
      notes: current.notes ?? item.notes,
      sort_order:
        // eslint-disable-next-line eqeqeq, no-eq-null -- checagem intencional de null/undefined
        current.sort_order == null
          ? item.sort_order
          : // eslint-disable-next-line eqeqeq, no-eq-null -- checagem intencional de null/undefined
            item.sort_order == null
            ? current.sort_order
            : Math.min(current.sort_order, item.sort_order),
    });
  }

  return Array.from(deduped.values());
}

// ============================================
// HOOK
// ============================================

export function useSellerCarts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  // Localiza o item de mesma variante (product_id + color_name) dentro de um
  // carrinho. Necessário porque o constraint unique_cart_item_variant
  // (cart_id, product_id, color_name) NULLS NOT DISTINCT bloqueia qualquer
  // INSERT/UPDATE que colida — então add/move/duplicate precisam MESCLAR
  // quantidades em vez de falhar. color_name === null exige `.is(null)`.
  const findVariantInCart = async (
    cartId: string,
    productId: string,
    colorName: string | null,
  ): Promise<{ id: string; quantity: number } | null> => {
    const base = supabase
      .from('seller_cart_items')
      .select('id, quantity')
      .eq('cart_id', cartId)
      .eq('product_id', productId);
    const { data } = await (
      colorName === null ? base.is('color_name', null) : base.eq('color_name', colorName)
    ).maybeSingle();
    return data ?? null;
  };

  const fetchCartWithItems = async (cartId: string): Promise<SellerCart | null> => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('seller_carts')
      .select('*, seller_cart_items(*)')
      .eq('id', cartId)
      .eq('seller_id', userId)
      .order('sort_order', { ascending: true, foreignTable: 'seller_cart_items' })
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return toSellerCart(data as unknown as SellerCartRawRow);
  };

  const buildRestorePayload = (snapshot: SellerCart): RestorePayload => ({
    seller_id: userId ?? '',
    company_id: snapshot.company_id,
    company_name: snapshot.company_name,
    company_location: snapshot.company_location ?? null,
    company_logo_url: snapshot.company_logo_url ?? null,
    notes: snapshot.notes ?? null,
    status: snapshot.status,
    shipping_deadline: snapshot.shipping_deadline ?? null,
    items: (snapshot.items ?? []).map((it) => ({
      product_id: it.product_id,
      product_name: it.product_name,
      product_sku: it.product_sku ?? null,
      product_image_url: it.product_image_url ?? null,
      product_price: it.product_price,
      quantity: clampQuantity(it.quantity ?? 1),
      color_name: it.color_name ?? null,
      color_hex: it.color_hex ?? null,
      notes: it.notes ?? null,
      sort_order: it.sort_order ?? null,
    })),
  });

  const restoreViaRpc = async (payload: RestorePayload): Promise<RestoreRpcResponse> => {
    const { data, error } = await supabase.rpc('restore_seller_cart', {
      _snapshot: payload as never,
    });

    if (error) throw error;

    const result = data as RestoreRpcResponse | null;
    const newCartId = result?.cart_id;
    if (!newCartId) throw new Error('restore_seller_cart não retornou cart_id');
    return {
      cart_id: newCartId,
      items_total: Number(result.items_total ?? 0),
      items_inserted: Number(result.items_inserted ?? 0),
      items_deduped: Number(result.items_deduped ?? 0),
    };
  };

  const restoreViaClientFallback = async (payload: RestorePayload): Promise<RestoreRpcResponse> => {
    if (!userId) throw new Error('Não autenticado');
    const dedupedItems = dedupeRestorePayloadItems(payload.items);
    const insertedIds: string[] = [];

    const { data: cartData, error: cartError } = await supabase
      .from('seller_carts')
      .insert({
        seller_id: userId,
        company_id: payload.company_id,
        company_name: payload.company_name,
        company_location: payload.company_location,
        company_logo_url: payload.company_logo_url,
        notes: payload.notes,
        status: payload.status,
        shipping_deadline: payload.shipping_deadline,
      })
      .select('id')
      .single();

    if (cartError) throw cartError;
    const newCartId = cartData?.id;
    if (!newCartId) throw new Error('Restauração não retornou id do carrinho');

    try {
      if (dedupedItems.length > 0) {
        const { data: insertedItems, error: itemsError } = await supabase
          .from('seller_cart_items')
          .insert(
            dedupedItems.map((item) => ({
              cart_id: newCartId,
              product_id: item.product_id,
              product_name: item.product_name,
              product_sku: item.product_sku,
              product_image_url: item.product_image_url,
              product_price: item.product_price,
              quantity: item.quantity,
              color_name: item.color_name,
              color_hex: item.color_hex,
              notes: item.notes,
              sort_order: item.sort_order,
            })),
          )
          .select('id');

        if (itemsError) throw itemsError;
        insertedIds.push(...((insertedItems ?? []) as { id: string }[]).map((item) => item.id));
      }
    } catch (err) {
      if (insertedIds.length > 0) {
        await supabase.from('seller_cart_items').delete().in('id', insertedIds);
      }
      await supabase.from('seller_carts').delete().eq('id', newCartId).eq('seller_id', userId);
      throw err;
    }

    return {
      cart_id: newCartId,
      items_total: dedupedItems.length,
      items_inserted: dedupedItems.length,
      items_deduped: Math.max(0, payload.items.length - dedupedItems.length),
    };
  };

  // Fetch all carts with items — único round-trip via PostgREST nested select.
  const cartsQuery = useQuery<SellerCart[]>({
    queryKey: [QUERY_KEY, userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('seller_carts')
        .select('*, seller_cart_items(*)')
        .eq('seller_id', userId)
        .order('updated_at', { ascending: false })
        .order('sort_order', { ascending: true, foreignTable: 'seller_cart_items' });

      if (error) throw error;
      if (!data?.length) return [];

      return data.map((row) => toSellerCart(row as unknown as SellerCartRawRow));
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  });

  // Create cart
  const createCart = useMutation({
    mutationFn: async (input: CreateCartInput) => {
      if (!userId) throw new Error('Não autenticado');

      const { data, error } = await supabase
        .from('seller_carts')
        .insert({
          seller_id: userId,
          company_id: input.company_id,
          company_name: input.company_name,
          company_location: input.company_location || null,
          company_logo_url: input.company_logo_url || null,
        })
        .select()
        .single();

      if (error) {
        if (isCartLimitError(error)) {
          throw new Error(
            `Você já tem ${MAX_SELLER_CARTS} carrinhos ativos. Finalize ou exclua um antes de criar outro.`,
          );
        }
        throw error;
      }
      return {
        ...data,
        notes: null,
        status: 'em_separacao' as CartStatus,
        shipping_deadline: null,
        items: [],
      } as SellerCart;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId] });
    },
    onError: (err: Error) => {
      toast.error('Operação falhou', { description: sanitizeError(err) });
    },
  });

  // Delete cart
  const deleteCart = useMutation<SellerCart, Error, string>({
    mutationFn: async (cartId: string) => {
      if (!userId) throw new Error('Não autenticado');

      const startedAt = performance.now();
      cartDeleteLog.info('cart_delete_start', { cart_id: cartId });

      // Snapshot server-side imediatamente antes do DELETE. Em algumas telas o
      // cache pode estar com `items: []` por hidratação parcial; se usarmos esse
      // objeto, o Undo recria um carrinho vazio. O retorno desta mutation vira o
      // snapshot canônico para os chamadores exibirem o toast de Desfazer.
      const snapshot = await fetchCartWithItems(cartId);
      if (!snapshot) {
        cartDeleteLog.warn('cart_delete_snapshot_missing', { cart_id: cartId });
        throw new CartDeleteZeroRowsError('Carrinho não encontrado para remoção.');
      }

      const { data, error } = await supabase
        .from('seller_carts')
        .delete()
        .eq('id', cartId)
        .eq('seller_id', userId)
        .select('id');

      const durationMs = Math.round(performance.now() - startedAt);
      const rowsAffected = Array.isArray(data) ? data.length : 0;

      if (error) {
        cartDeleteLog.error('cart_delete_failed', {
          cart_id: cartId,
          rows_affected: rowsAffected,
          duration_ms: durationMs,
          error: error.message,
        });
        throw error;
      }

      if (rowsAffected !== 1 || data?.[0]?.id !== cartId) {
        cartDeleteLog.warn('cart_delete_zero_rows', {
          cart_id: cartId,
          rows_affected: rowsAffected,
          duration_ms: durationMs,
        });
        throw new CartDeleteZeroRowsError();
      }

      cartDeleteLog.info('cart_delete_ok', {
        cart_id: cartId,
        rows_affected: rowsAffected,
        duration_ms: durationMs,
        snapshot_items_count: snapshot.items.length,
      });
      return snapshot;
    },
    onSuccess: (deletedSnapshot) => {
      queryClient.setQueryData<SellerCart[]>(
        [QUERY_KEY, userId],
        (previous) => previous?.filter((cart) => cart.id !== deletedSnapshot.id) ?? previous,
      );
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId] });
      // Toast de sucesso é emitido pelo chamador (showUndoToast em CartsListPage/
      // CartHeaderButton) para permitir o fluxo de Desfazer. Emitir aqui geraria
      // dois toasts sobrepostos.
    },
    onError: (err: Error) => {
      if (err instanceof CartDeleteZeroRowsError) {
        toast.error('Carrinho não foi removido', {
          description:
            'O servidor respondeu, mas nenhuma linha foi afetada. Atualize a lista e tente novamente.',
        });
        return;
      }
      toast.error('Operação falhou', { description: sanitizeError(err) });
    },
  });

  // Add item to cart
  const addItem = useMutation({
    mutationFn: async ({ cartId, item }: { cartId: string; item: AddToCartInput }) => {
      const colorName = item.color_name ?? null;
      // Quantidade sempre >= 1: protege o invariante mesmo se o chamador passar 0/negativo.
      const quantityToAdd = Math.max(MIN_ITEM_QUANTITY, Math.trunc(Number(item.quantity) || 1));

      const existing = await findVariantInCart(cartId, item.product_id, colorName);

      if (existing) {
        const { error } = await supabase
          .from('seller_cart_items')
          .update({
            // clamp do TETO: somatório de adds repetidos não pode ultrapassar 999999.
            quantity: clampQuantity(existing.quantity + quantityToAdd),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('seller_cart_items').insert({
          cart_id: cartId,
          product_id: item.product_id,
          product_name: item.product_name,
          product_sku: item.product_sku || null,
          product_image_url: item.product_image_url || null,
          product_price: item.product_price,
          quantity: clampQuantity(quantityToAdd),
          color_name: colorName,
          color_hex: item.color_hex || null,
          notes: item.notes ?? null,
        });

        // Se bater no constraint (race condition), tenta o update mais uma vez
        if (error?.code === '23505') {
          const retryExisting = await findVariantInCart(cartId, item.product_id, colorName);

          if (retryExisting) {
            const { error: retryErr } = await supabase
              .from('seller_cart_items')
              .update({ quantity: clampQuantity(retryExisting.quantity + quantityToAdd) })
              .eq('id', retryExisting.id);
            if (retryErr) throw retryErr;
          } else {
            // Item desapareceu entre o INSERT falho e o retry (ex: DELETE concorrente).
            // Lançar erro evita que o produto seja silenciosamente descartado.
            throw new Error('Conflito de carrinho: tente novamente');
          }
        } else if (error) {
          throw error;
        }
      }

      // updated_at do carrinho-pai é propagado pelo trigger
      // trg_touch_seller_cart_on_item_change (migration 20260617130000) em
      // INSERT/UPDATE/DELETE — não precisamos do round-trip manual aqui.
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId] });
    },
    onError: (err: Error) => {
      // JWT expirado / bad_jwt (PostgREST 401 com "JWT expired"): delega para
      // o fluxo SSOT de recuperação de sessão — ele mostra o toast "Sua sessão
      // expirou. Faça login novamente." e redireciona para /login?next=…,
      // fechando o CartSelectorDialog junto com o unmount da rota. Suprimimos
      // o toast genérico de "Falha ao adicionar" para não empilhar mensagens
      // conflitantes com a UX de sessão expirada.
      const status = (err as Error & { status?: number }).status;
      if (isBadJwtError(err) || (status === 401 && /jwt/i.test(err.message ?? ''))) {
        maybeRecoverFromError(err, 'cart.addItem');
        return;
      }
      // Copy SSOT em `sellerCartToasts.ts`. NÃO passar `duration:` —
      // dependemos do auto-dismiss padrão do sonner (~4 s) nos asserts
      // E2E (12i/12m/12n) que garantem que o toast some e não empilha.
      toast.error(SELLER_CART_TOASTS.addItemError.title, { description: sanitizeError(err) });
    },
  });

  // Remove item — com update otimista para eliminar delay percebido no popover.
  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from('seller_cart_items').delete().eq('id', itemId);
      if (error) throw error;
    },
    onMutate: async (itemId: string) => {
      await queryClient.cancelQueries({ queryKey: [QUERY_KEY, userId] });
      const previous = queryClient.getQueryData<SellerCart[]>([QUERY_KEY, userId]);
      if (previous) {
        queryClient.setQueryData<SellerCart[]>(
          [QUERY_KEY, userId],
          previous.map((cart) => ({
            ...cart,
            items: cart.items.filter((it) => it.id !== itemId),
          })),
        );
      }
      return { previous };
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData([QUERY_KEY, userId], ctx.previous);
      }
      toast.error('Não foi possível remover o item', { description: sanitizeError(err) });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId] });
    },
  });

  // Update item quantity — otimista: reflete o clique instantaneamente e reconcilia depois.
  const updateItemQuantity = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      // Defesa em profundidade: a UI já impede valores < 1, mas garantimos aqui
      // o invariante 1 <= quantity <= 999999 (espelha o CHECK no banco) para
      // qualquer chamador programático (templates, restore, futuros callers).
      const safeQty = clampQuantity(quantity);
      const { error } = await supabase
        .from('seller_cart_items')
        .update({ quantity: safeQty })
        .eq('id', itemId);
      if (error) throw error;
    },
    onMutate: async ({ itemId, quantity }) => {
      await queryClient.cancelQueries({ queryKey: [QUERY_KEY, userId] });
      const previous = queryClient.getQueryData<SellerCart[]>([QUERY_KEY, userId]);
      const safeQty = clampQuantity(quantity);
      if (previous) {
        queryClient.setQueryData<SellerCart[]>(
          [QUERY_KEY, userId],
          previous.map((cart) => ({
            ...cart,
            items: cart.items.map((it) => (it.id === itemId ? { ...it, quantity: safeQty } : it)),
          })),
        );
      }
      return { previous };
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData([QUERY_KEY, userId], ctx.previous);
      }
      toast.error('Não foi possível atualizar a quantidade', { description: sanitizeError(err) });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId] });
    },
  });

  // Update item notes
  const updateItemNotes = useMutation({
    mutationFn: async ({ itemId, notes }: { itemId: string; notes: string }) => {
      const { error } = await supabase
        .from('seller_cart_items')
        .update({ notes: notes || null })
        .eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId] });
    },
    onError: (err: Error) => {
      toast.error('Não foi possível salvar a observação', { description: sanitizeError(err) });
    },
  });

  // Update item sort order
  // BUG-6 FIX: substituído de N requests paralelos (Promise.all) para 1 RPC batch.
  // Com carrinhos grandes (50-200 itens), Promise.all gerava N conexões DB e risco
  // de rate limit no PostgREST. fn_batch_update_cart_item_sort_order é O(1) roundtrip.
  const updateItemSortOrder = useMutation({
    mutationFn: async (items: { id: string; sort_order: number }[]) => {
      if (items.length === 0) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)('fn_batch_update_cart_item_sort_order', {
        p_updates: items,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId] });
    },
    onError: (err: Error) => {
      // Revalida do servidor para desfazer a ordem otimista que ficou parcial.
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId] });
      toast.error('Não foi possível reordenar os itens', { description: sanitizeError(err) });
    },
  });

  // Update cart notes
  const updateCartNotes = useMutation({
    mutationFn: async ({ cartId, notes }: { cartId: string; notes: string }) => {
      const { error } = await supabase
        .from('seller_carts')
        .update({ notes: notes || null })
        .eq('id', cartId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId] });
    },
    onError: (err: Error) => {
      toast.error('Não foi possível salvar as observações', { description: sanitizeError(err) });
    },
  });

  // Update cart status
  const updateCartStatus = useMutation({
    mutationFn: async ({ cartId, status }: { cartId: string; status: CartStatus }) => {
      // Regra de negócio (SSOT em src/lib/carts/status-transition-guard.ts):
      // só é possível marcar "pronto p/ orçamento" se o carrinho tiver ao
      // menos 1 item. Defesa em profundidade — a UI já bloqueia, mas aqui
      // também para evitar chamadas via atalhos, testes ou race conditions.
      const { evaluateCartStatusTransition } = await import('@/lib/carts/status-transition-guard');
      const cart = (cartsQuery.data || []).find((c) => c.id === cartId);
      const decision = evaluateCartStatusTransition({
        nextStatus: status,
        itemCount: cart?.items?.length ?? 0,
      });
      if (!decision.allowed) {
        const err = new Error(decision.message);
        (err as Error & { code?: string }).code = 'EMPTY_CART';
        throw err;
      }
      const { error } = await supabase.from('seller_carts').update({ status }).eq('id', cartId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId] });
    },
    onError: (err: Error) => {
      toast.error('Não foi possível atualizar o status', { description: sanitizeError(err) });
    },
  });

  // Update cart shipping deadline (prazo p/ envio)
  const updateCartShippingDeadline = useMutation({
    mutationFn: async ({
      cartId,
      shippingDeadline,
    }: {
      cartId: string;
      shippingDeadline: string | null;
    }) => {
      // Validação Zod (formato ISO, data válida, não no passado).
      const { shippingDeadlineSchema } = await import('@/lib/carts/shipping-deadline');
      const parsed = shippingDeadlineSchema.safeParse(shippingDeadline);
      if (!parsed.success) {
        throw new Error(parsed.error.errors[0]?.message ?? 'Data inválida.');
      }
      const { error } = await supabase
        .from('seller_carts')
        .update({ shipping_deadline: parsed.data })
        .eq('id', cartId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId] });
    },
    onError: (err: Error) => {
      toast.error('Não foi possível salvar o prazo p/ envio', { description: sanitizeError(err) });
    },
  });

  // Duplicate cart
  const duplicateCart = useMutation({
    mutationFn: async (sourceCartId: string) => {
      if (!userId) {
        const err = new Error('Sessão expirada. Faça login novamente para duplicar o carrinho.');
        (err as Error & { code?: string }).code = 'AUTH';
        throw err;
      }
      const sourceCart = (cartsQuery.data || []).find((c) => c.id === sourceCartId);
      if (!sourceCart) {
        const err = new Error(
          'Carrinho de origem não encontrado. Atualize a lista e tente novamente.',
        );
        (err as Error & { code?: string }).code = 'NOT_FOUND';
        throw err;
      }

      // Validação prévia: garante NOT NULLs de product_name/product_price nos itens
      const invalidItems = sourceCart.items.filter(
        (i) =>
          !i.product_id ||
          !i.product_name ||
          typeof i.product_price !== 'number' ||
          Number.isNaN(i.product_price),
      );
      if (invalidItems.length > 0) {
        const err = new Error(
          `Não é possível duplicar: ${invalidItems.length} item(ns) com dados incompletos (nome ou preço ausentes).`,
        );
        (err as Error & { code?: string }).code = 'VALIDATION';
        throw err;
      }

      // Create new cart
      const { data: newCart, error: cartErr } = await supabase
        .from('seller_carts')
        .insert({
          seller_id: userId,
          company_id: sourceCart.company_id,
          company_name: sourceCart.company_name,
          company_location: sourceCart.company_location,
          company_logo_url: sourceCart.company_logo_url,
        })
        .select()
        .maybeSingle();
      if (cartErr) {
        if (isCartLimitError(cartErr)) {
          const err = new Error(
            `Você já tem ${MAX_SELLER_CARTS} carrinhos ativos. Finalize ou exclua um antes de duplicar.`,
          );
          (err as Error & { code?: string }).code = 'LIMIT';
          throw err;
        }
        throw cartErr;
      }
      if (!newCart) {
        const err = new Error(
          'O carrinho foi criado mas não pôde ser lido de volta (RLS). Recarregue a página.',
        );
        (err as Error & { code?: string }).code = 'RLS';
        throw err;
      }

      // Copy items
      if (sourceCart.items.length > 0) {
        const newItems = sourceCart.items.map((i) => ({
          cart_id: newCart.id,
          product_id: i.product_id,
          product_name: i.product_name,
          product_sku: i.product_sku,
          product_image_url: i.product_image_url,
          product_price: i.product_price,
          quantity: clampQuantity(i.quantity),
          color_name: i.color_name,
          color_hex: i.color_hex,
          notes: i.notes,
          sort_order: i.sort_order,
        }));
        const { error: itemsErr } = await supabase.from('seller_cart_items').insert(newItems);
        if (itemsErr) {
          // Compensação: a cópia dos itens falhou. Sem isso, sobraria um
          // carrinho vazio órfão consumindo o limite de 3 (canCreateCart) e
          // poluindo a lista. Remove o carrinho recém-criado e propaga o erro.
          const { error: cleanupErr } = await supabase
            .from('seller_carts')
            .delete()
            .eq('id', newCart.id);
          if (cleanupErr) {
            const err = new Error(
              `Falha ao inserir itens e ao limpar carrinho criado. Recarregue e verifique se restou um carrinho vazio.`,
            );
            (err as Error & { code?: string }).code = 'CLEANUP';
            throw err;
          }
          throw itemsErr;
        }
      }

      // Polling: refetch até o novo carrinho aparecer na query cache
      // (até 5 tentativas x 400ms = 2s). Evita inconsistência quando a
      // replicação/latência do PostgREST atrasa a leitura.
      const maxAttempts = 5;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId] });
        const fresh = queryClient.getQueryData<SellerCart[]>([QUERY_KEY, userId]);
        if (fresh?.some((c) => c.id === newCart.id)) break;
        if (attempt < maxAttempts - 1) {
          await new Promise<void>((r) => {
            setTimeout(r, 400);
          });
        }
      }

      return newCart.id;
    },
    onSuccess: () => {
      toast.success('Carrinho duplicado com sucesso');
    },
    onError: (err: Error) => {
      // eslint-disable-next-line no-console
      console.error('[duplicateCart] falha', err);
      const code = (err as Error & { code?: string }).code;
      const supaCode = (err as Error & { code?: string; status?: number }).code;
      const status = (err as Error & { status?: number }).status;
      const msg = err.message ?? '';

      // Classificação amigável do erro
      let title = 'Não foi possível duplicar o carrinho';
      let description = sanitizeError(err);

      if (code === 'LIMIT') {
        title = SELLER_CART_LIMIT_REACHED_SHORT;
        description = err.message;
      } else if (code === 'VALIDATION') {
        title = 'Carrinho inválido';
        description = err.message;
      } else if (code === 'RLS' || supaCode === '42501' || status === 401 || status === 403) {
        title = 'Permissão negada';
        description =
          'Você não tem permissão para duplicar este carrinho. Recarregue e tente novamente.';
      } else if (code === 'AUTH') {
        title = 'Sessão expirada';
        description = err.message;
      } else if (
        msg.toLowerCase().includes('failed to fetch') ||
        msg.toLowerCase().includes('networkerror') ||
        code === 'NETWORK'
      ) {
        title = 'Falha de rede';
        description = 'Verifique sua conexão e tente novamente.';
      } else if (code === 'NOT_FOUND') {
        title = 'Carrinho não encontrado';
        description = err.message;
      } else if (code === 'CLEANUP') {
        title = 'Falha parcial ao duplicar';
        description = err.message;
      }

      toast.error(title, { description });
    },
  });

  // Move item to another cart
  const moveItemToCart = useMutation({
    mutationFn: async ({ itemId, targetCartId }: { itemId: string; targetCartId: string }) => {
      const item = (cartsQuery.data || []).flatMap((c) => c.items).find((i) => i.id === itemId);
      if (!item) throw new Error('Item não encontrado');

      // Se o carrinho destino já tiver a mesma variante, um UPDATE puro de
      // cart_id violaria unique_cart_item_variant. Mesclamos: soma a quantidade
      // no item existente do destino e remove o item de origem.
      const existing = await findVariantInCart(targetCartId, item.product_id, item.color_name);
      if (existing && existing.id !== itemId) {
        const previousQty = existing.quantity;
        const projected = previousQty + item.quantity;
        // Rejeita antes de qualquer escrita: mover com overflow silenciosamente
        // apagaria unidades que não cabem no destino. Falhar é mais seguro que
        // perder quantidade.
        if (projected > MAX_ITEM_QUANTITY) {
          throw new Error(
            `A quantidade combinada (${projected.toLocaleString('pt-BR')}) excede o limite de ${MAX_ITEM_QUANTITY.toLocaleString('pt-BR')} unidades por SKU`,
          );
        }
        const { error: updErr } = await supabase
          .from('seller_cart_items')
          .update({ quantity: projected })
          .eq('id', existing.id);
        if (updErr) throw updErr;
        const { error: delErr } = await supabase
          .from('seller_cart_items')
          .delete()
          .eq('id', itemId);
        if (delErr) {
          // Compensação condicional: reverte o destino só se a quantidade ainda
          // for o valor que escrevemos. Se outra aba/usuário alterou o destino
          // entre o UPDATE e este rollback, o .eq('quantity', projected) evita
          // sobrescrever a mudança deles com o valor obsoleto.
          const { data: rollbackData, error: rollbackErr } = await supabase
            .from('seller_cart_items')
            .update({ quantity: previousQty })
            .eq('id', existing.id)
            .eq('quantity', projected)
            .select('id');
          if (rollbackErr) {
            throw new Error(
              `Falha ao mover item (delete: ${delErr.message}; compensação: ${rollbackErr.message}) — recarregue para verificar o estado`,
            );
          }
          if (!rollbackData?.length) {
            throw new Error(
              `Falha ao mover item (delete: ${delErr.message}; compensação: destino já modificado por outra operação) — recarregue para verificar o estado`,
            );
          }
          throw delErr;
        }
        return;
      }

      const { error } = await supabase
        .from('seller_cart_items')
        .update({ cart_id: targetCartId })
        .eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId] });
      toast.success('Item movido para outro carrinho');
    },
    onError: (err: Error) => {
      // Revalida do servidor: desfaz qualquer estado otimista/parcial da UI.
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId] });
      toast.error('Não foi possível mover o item', { description: sanitizeError(err) });
    },
  });

  // Duplicate item to another cart
  const duplicateItemToCart = useMutation({
    mutationFn: async ({ itemId, targetCartId }: { itemId: string; targetCartId: string }) => {
      // Find the item in current carts
      const allItems = (cartsQuery.data || []).flatMap((c) => c.items);
      const item = allItems.find((i) => i.id === itemId);
      if (!item) throw new Error('Item não encontrado');

      // Mescla se o destino já tiver a variante (evita 23505 do unique constraint).
      const existing = await findVariantInCart(targetCartId, item.product_id, item.color_name);
      if (existing) {
        const projected = existing.quantity + item.quantity;
        if (projected > MAX_ITEM_QUANTITY) {
          throw new Error(
            `A quantidade combinada (${projected.toLocaleString('pt-BR')}) excede o limite de ${MAX_ITEM_QUANTITY.toLocaleString('pt-BR')} unidades por SKU`,
          );
        }
        const { error } = await supabase
          .from('seller_cart_items')
          .update({ quantity: projected })
          .eq('id', existing.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from('seller_cart_items').insert({
        cart_id: targetCartId,
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku,
        product_image_url: item.product_image_url,
        product_price: item.product_price,
        quantity: clampQuantity(item.quantity),
        color_name: item.color_name,
        color_hex: item.color_hex,
        notes: item.notes,
        // sort_order omitido: o trigger assign_cart_item_sort_order atribui o
        // próximo valor gapless no destino (copiar o do origem causaria colisão de ordem).
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId] });
      toast.success('Item duplicado para outro carrinho');
    },
    onError: (err: Error) => {
      toast.error('Não foi possível duplicar o item', { description: sanitizeError(err) });
    },
  });

  // Computed
  const { carts, totalItems, canCreateCart } = useMemo(() => {
    const c = cartsQuery.data || [];
    return {
      carts: c,
      totalItems: c.reduce((sum, cart) => sum + cart.items.length, 0),
      canCreateCart: c.length < MAX_SELLER_CARTS,
    };
  }, [cartsQuery.data]);

  // Restore multiple items (Undo Clear)
  const restoreItems = useMutation({
    mutationFn: async ({ cartId, items }: { cartId: string; items: AddToCartInput[] }) => {
      if (items.length === 0) return;

      // Promise.all é seguro aqui: o constraint unique_cart_item_variant garante que
      // o carrinho origem nunca tinha itens duplicados por (product_id, color_name),
      // portanto não há disputa de linha entre as corrotinas paralelas.
      // Per-item find+update/insert (em vez de upsert) mantém compatibilidade com
      // NULL color_name (PostgREST não infere IS NULL em onConflict).
      await Promise.all(
        items.map(async (item) => {
          const colorName = item.color_name ?? null;
          const safeQty = clampQuantity(item.quantity ?? 1);

          const existing = await findVariantInCart(cartId, item.product_id, colorName);
          if (existing) {
            // Mescla: se outro processo adicionou o mesmo item durante o intervalo do
            // undo, somamos ao invés de sobrescrever — evita perder unidades adicionadas
            // entre o clear e o restore. clampQuantity garante o teto de 999999.
            const { error } = await supabase
              .from('seller_cart_items')
              .update({
                quantity: clampQuantity(existing.quantity + safeQty),
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from('seller_cart_items').insert({
              cart_id: cartId,
              product_id: item.product_id,
              product_name: item.product_name,
              product_sku: item.product_sku || null,
              product_image_url: item.product_image_url || null,
              product_price: item.product_price,
              quantity: safeQty,
              color_name: colorName,
              color_hex: item.color_hex || null,
              notes: item.notes ?? null,
              sort_order: item.sort_order ?? null,
            });
            if (error) throw error;
          }
        }),
      );

      // updated_at do carrinho-pai é propagado pelo trigger
      // trg_touch_seller_cart_on_item_change (migration 20260617130000).
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId] });
    },
    onError: (err: Error) => {
      toast.error('Não foi possível restaurar os itens', { description: sanitizeError(err) });
    },
  });

  // ============================================================
  // RESTORE CART (Undo delete) — restauração ATÔMICA via RPC.
  // ============================================================
  // Toda a lógica de INSERT (cart + items) vive em `public.restore_seller_cart`
  // dentro de uma única transação Postgres:
  //   • Se qualquer item falhar (RLS, coluna, unique), o cart também rollback
  //     — impossível ficar órfão (bug antigo do path client-side sequencial).
  //   • Deduplica itens com mesmo (product_id, color_name) somando quantidades.
  //   • ON CONFLICT DO NOTHING contra `unique_cart_item_variant`.
  // Nunca vaza `id`, `seller_id`, `created_at`, `updated_at` do snapshot.
  const restoreCartWithItems = useMutation<RestoredSellerCart | undefined, Error, SellerCart>({
    mutationFn: async (snapshot) => {
      if (!userId) throw new Error('Não autenticado');

      // Payload enxuto: apenas o que a RPC lê. Descarta id/timestamps por design.
      const payload = buildRestorePayload(snapshot);
      let result: RestoreRpcResponse;
      try {
        result = await restoreViaRpc(payload);
      } catch (err) {
        if (isCartLimitError(err as { code?: string; message?: string | null })) {
          throw new Error(
            `Você já tem ${MAX_SELLER_CARTS} carrinhos ativos. Finalize ou exclua um antes de restaurar.`,
          );
        }
        if (!isRestoreRpcUnavailableError(err)) throw err;

        cartDeleteLog.warn('cart_restore_rpc_unavailable_fallback', {
          snapshot_id: snapshot.id,
          items_total: payload.items.length,
          error: errorMessage(err),
        });
        result = await restoreViaClientFallback(payload);
      }

      cartDeleteLog.info('cart_restore_ok', {
        cart_id: result.cart_id,
        items_total: result.items_total,
        items_inserted: result.items_inserted,
        items_deduped: result.items_deduped,
      });

      return {
        id: result.cart_id,
        seller_id: userId,
        company_id: snapshot.company_id,
        company_name: snapshot.company_name,
        company_location: snapshot.company_location ?? null,
        company_logo_url: snapshot.company_logo_url ?? null,
        notes: snapshot.notes ?? null,
        status: snapshot.status,
        shipping_deadline: snapshot.shipping_deadline ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        items: snapshot.items ?? [],
        restore_metrics: {
          items_total: result.items_total,
          items_inserted: result.items_inserted,
          items_deduped: result.items_deduped,
        },
      } satisfies RestoredSellerCart;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId] });
    },
    onError: (err: Error) => {
      // Log estruturado com raw_error — o toast do chamador acrescenta
      // snapshot_id/itens + description sanitizada.
      cartDeleteLog.error('cart_restore_failed', { error: err.message });
    },
  });

  return {
    carts,
    isLoading: cartsQuery.isLoading,
    totalItems,
    canCreateCart,
    createCart,
    deleteCart,
    addItem,
    removeItem,
    updateItemQuantity,
    updateItemNotes,
    updateItemSortOrder,
    updateCartNotes,
    updateCartStatus,
    updateCartShippingDeadline,
    duplicateCart,
    moveItemToCart,
    duplicateItemToCart,
    restoreItems,
    restoreCartWithItems,
    clearCart: async (cartId: string) => {
      const { error } = await supabase.from('seller_cart_items').delete().eq('cart_id', cartId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId] });
    },
    refetch: cartsQuery.refetch,
  };
}
