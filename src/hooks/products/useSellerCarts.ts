/**
 * useSellerCarts - Hook para gerenciar carrinhos de vendedor
 * Persiste no banco de dados, máx 3 carrinhos simultâneos
 */

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';

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
  status: string;
  created_at: string;
  updated_at: string;
  items: SellerCartItem[];
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
}

export interface CreateCartInput {
  company_id: string;
  company_name: string;
  company_location?: string;
  company_logo_url?: string;
}

export type CartStatus = 'novo' | 'em_negociacao' | 'pronto_orcamento';

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

  // Fetch all carts with items
  const cartsQuery = useQuery<SellerCart[]>({
    queryKey: [QUERY_KEY, userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data: carts, error: cartsError } = await supabase
        .from('seller_carts')
        .select('*')
        .eq('seller_id', userId)
        .order('updated_at', { ascending: false });

      if (cartsError) throw cartsError;
      if (!carts?.length) return [];

      const { data: items, error: itemsError } = await supabase
        .from('seller_cart_items')
        .select('*')
        .in(
          'cart_id',
          carts.map((c) => c.id),
        )
        .order('sort_order', { ascending: true });

      if (itemsError) throw itemsError;

      return carts.map((cart) => ({
        ...cart,
        notes: cart.notes ?? null,
        status: cart.status ?? 'novo',
        items: (items || []).filter((i) => i.cart_id === cart.id),
      }));
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
        if (error.message?.includes('Limite de 3')) {
          throw new Error(
            'Você já tem 3 carrinhos ativos. Finalize ou exclua um antes de criar outro.',
          );
        }
        throw error;
      }
      return { ...data, notes: null, status: 'novo', items: [] } as SellerCart;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: (err: Error) => {
      toast.error('Operação falhou', { description: sanitizeError(err) });
    },
  });

  // Delete cart
  const deleteCart = useMutation({
    mutationFn: async (cartId: string) => {
      const { error } = await supabase.from('seller_carts').delete().eq('id', cartId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Carrinho removido');
    },
    onError: (err: Error) => {
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
            await supabase
              .from('seller_cart_items')
              .update({ quantity: clampQuantity(retryExisting.quantity + quantityToAdd) })
              .eq('id', retryExisting.id);
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
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: (err: Error) => {
      toast.error('Não foi possível adicionar ao carrinho', { description: sanitizeError(err) });
    },
  });

  // Remove item
  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from('seller_cart_items').delete().eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: (err: Error) => {
      toast.error('Não foi possível remover o item', { description: sanitizeError(err) });
    },
  });

  // Update item quantity
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: (err: Error) => {
      toast.error('Não foi possível atualizar a quantidade', { description: sanitizeError(err) });
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
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: (err: Error) => {
      toast.error('Não foi possível salvar a observação', { description: sanitizeError(err) });
    },
  });

  // Update item sort order
  const updateItemSortOrder = useMutation({
    mutationFn: async (items: { id: string; sort_order: number }[]) => {
      // Aplica em série e aborta no primeiro erro: evita reordenação parcial
      // silenciosa (Promise.all engolia falhas individuais sem propagar).
      for (const { id, sort_order } of items) {
        const { error } = await supabase
          .from('seller_cart_items')
          .update({ sort_order })
          .eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: (err: Error) => {
      // Revalida do servidor para desfazer a ordem otimista que ficou parcial.
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
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
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: (err: Error) => {
      toast.error('Não foi possível salvar as observações', { description: sanitizeError(err) });
    },
  });

  // Update cart status
  const updateCartStatus = useMutation({
    mutationFn: async ({ cartId, status }: { cartId: string; status: CartStatus }) => {
      const { error } = await supabase.from('seller_carts').update({ status }).eq('id', cartId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: (err: Error) => {
      toast.error('Não foi possível atualizar o status', { description: sanitizeError(err) });
    },
  });

  // Duplicate cart
  const duplicateCart = useMutation({
    mutationFn: async (sourceCartId: string) => {
      if (!userId) throw new Error('Não autenticado');
      const sourceCart = (cartsQuery.data || []).find((c) => c.id === sourceCartId);
      if (!sourceCart) throw new Error('Carrinho não encontrado');

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
        .single();
      if (cartErr) throw cartErr;

      // Copy items
      if (sourceCart.items.length > 0) {
        const newItems = sourceCart.items.map((i) => ({
          cart_id: newCart.id,
          product_id: i.product_id,
          product_name: i.product_name,
          product_sku: i.product_sku,
          product_image_url: i.product_image_url,
          product_price: i.product_price,
          quantity: i.quantity,
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
          await supabase.from('seller_carts').delete().eq('id', newCart.id);
          throw itemsErr;
        }
      }

      return newCart.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Carrinho duplicado com sucesso');
    },
    onError: (err: Error) => {
      toast.error('Operação falhou', { description: sanitizeError(err) });
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
        const { error: updErr } = await supabase
          .from('seller_cart_items')
          .update({ quantity: clampQuantity(previousQty + item.quantity) })
          .eq('id', existing.id);
        if (updErr) throw updErr;
        const { error: delErr } = await supabase
          .from('seller_cart_items')
          .delete()
          .eq('id', itemId);
        if (delErr) {
          // Compensação: o destino já recebeu a soma, mas a origem não foi
          // removida. Sem reverter, a quantidade ficaria DOBRADA (dst somado +
          // src ainda presente — pior que o estado inicial). Como não há
          // transação no client, restauramos o destino ao valor anterior e
          // propagamos o erro; onError revalida do servidor por garantia.
          await supabase
            .from('seller_cart_items')
            .update({ quantity: previousQty })
            .eq('id', existing.id);
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
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Item movido para outro carrinho');
    },
    onError: (err: Error) => {
      // Revalida do servidor: desfaz qualquer estado otimista/parcial da UI.
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
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
        const { error } = await supabase
          .from('seller_cart_items')
          .update({ quantity: clampQuantity(existing.quantity + item.quantity) })
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
        quantity: item.quantity,
        color_name: item.color_name,
        color_hex: item.color_hex,
        notes: item.notes,
        // sort_order omitido: o trigger assign_cart_item_sort_order atribui o
        // próximo valor gapless no destino (copiar o do origem causaria colisão de ordem).
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
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
      canCreateCart: c.length < 3,
    };
  }, [cartsQuery.data]);

  // Restore multiple items (Undo Clear)
  const restoreItems = useMutation({
    mutationFn: async ({ cartId, items }: { cartId: string; items: AddToCartInput[] }) => {
      if (items.length === 0) return;

      const itemsToInsert = items.map((item) => ({
        cart_id: cartId,
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku || null,
        product_image_url: item.product_image_url || null,
        product_price: item.product_price,
        quantity: item.quantity || 1,
        color_name: item.color_name || null,
        color_hex: item.color_hex || null,
        notes: item.notes ?? null,
      }));

      const { error } = await supabase.from('seller_cart_items').insert(itemsToInsert);
      if (error) throw error;

      // updated_at do carrinho-pai é propagado pelo trigger
      // trg_touch_seller_cart_on_item_change (migration 20260617130000).
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: (err: Error) => {
      toast.error('Não foi possível restaurar os itens', { description: sanitizeError(err) });
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
    duplicateCart,
    moveItemToCart,
    duplicateItemToCart,
    restoreItems,
    clearCart: async (cartId: string) => {
      const { error } = await supabase.from('seller_cart_items').delete().eq('cart_id', cartId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    refetch: cartsQuery.refetch,
  };
}
