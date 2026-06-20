import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFavoritesStore, type FavoriteVariantInfo } from '@/stores/useFavoritesStore';
import { useFavoriteLists } from '@/hooks/favorites';
import type { Product } from '@/types/product';
import { toast } from 'sonner';

import { logger } from '@/lib/logger';
const LAST_LIST_KEY = 'favorites-last-used-list-id';

/**
 * Hook orquestrador para favoritar a partir do catálogo.
 *
 * Lógica:
 * - Se usuário NÃO tem listas remotas além da padrão → usa store legacy + grava em default remoto silenciosamente.
 * - Se usuário tem ≥2 listas e shift NÃO foi pressionado → retorna `needsPicker=true` para abrir QuickListPicker.
 * - Shift+click ou única lista → adiciona direto à lista padrão (ou última usada).
 */
export function useFavoriteQuickAdd() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { lists, defaultList, createList } = useFavoriteLists();
  const { toggleFavorite, isFavorite } = useFavoritesStore();

  // Index global de membership: produto X está em quais listas?
  const { data: membership = new Map<string, Set<string>>() } = useQuery({
    queryKey: ['favorite-membership', user?.id],
    queryFn: async () => {
      if (!user) return new Map<string, Set<string>>();
      const { data, error } = await supabase
        .from('favorite_items')
        .select('product_id, list_id')
        .eq('user_id', user.id);
      if (error) throw error;
      const map = new Map<string, Set<string>>();
      (data ?? []).forEach((row: { product_id: string; list_id: string }) => {
        if (!map.has(row.product_id)) map.set(row.product_id, new Set());
        map.get(row.product_id)?.add(row.list_id);
      });
      return map;
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  // Intentionally NOT memoised — must read fresh on every click so that
  // a Shift+click immediately after a regular-click uses the updated list.
  const getLastUsedListId = useCallback((): string | null => {
    try {
      return localStorage.getItem(LAST_LIST_KEY);
    } catch {
      return null;
    }
  }, []);

  const hasMultipleLists = lists.length > 1;

  /** Adiciona produto remotamente em uma lista específica + registra no store legado (sync local). */
  const addToList = useCallback(
    async (listId: string, product: Product, variant?: FavoriteVariantInfo) => {
      if (!user) return;
      try {
        const { error } = await supabase.from('favorite_items').upsert(
          {
            list_id: listId,
            user_id: user.id,
            product_id: product.id,
            variant_id: variant?.variant_id ?? null,
            variant_info: (variant ?? null) as never,
            // Snapshot the effective selling price (sale_price when available, otherwise price)
            price_at_save:
              typeof (product as { sale_price?: number }).sale_price === 'number'
                ? ((product as { sale_price?: number }).sale_price ?? null)
                : typeof product.price === 'number'
                  ? product.price
                  : null,
          },
          { onConflict: 'list_id,product_id,variant_id', ignoreDuplicates: false },
        );
        if (error) throw error;
        try {
          localStorage.setItem(LAST_LIST_KEY, listId);
        } catch {
          /* empty */
        }
        // Sincroniza store legado (estado visual de "favoritado")
        if (!isFavorite(product.id)) toggleFavorite(product.id, variant);
        qc.invalidateQueries({ queryKey: ['favorite-membership'] });
        qc.invalidateQueries({ queryKey: ['favorite-items'] });
        qc.invalidateQueries({ queryKey: ['favorite-lists'] });
        const listName = lists.find((l) => l.id === listId)?.name ?? 'lista';
        toast.success(`Adicionado em "${listName}"`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro ao salvar';
        toast.error(msg);
      }
    },
    [user, qc, lists, isFavorite, toggleFavorite],
  );

  /** Remove produto de TODAS as listas remotas + store legado. */
  const removeFromAll = useCallback(
    async (productId: string) => {
      if (!user) return;
      try {
        const { error } = await supabase
          .from('favorite_items')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', productId);
        if (error) throw error;
        if (isFavorite(productId)) toggleFavorite(productId);
        qc.invalidateQueries({ queryKey: ['favorite-membership'] });
        qc.invalidateQueries({ queryKey: ['favorite-items'] });
        qc.invalidateQueries({ queryKey: ['favorite-lists'] });
      } catch (e) {
        logger.warn('[favoriteQuickAdd] remove failed', e);
        toast.error('Não foi possível remover dos favoritos');
        // Do NOT toggle — deletion failed, keep local state consistent with DB
      }
    },
    [user, qc, isFavorite, toggleFavorite],
  );

  /** Cria lista nova e adiciona o produto nela. */
  const createAndAdd = useCallback(
    async (name: string, product: Product, variant?: FavoriteVariantInfo) => {
      const list = await createList.mutateAsync({ name });
      await addToList(list.id, product, variant);
      return list.id;
    },
    [createList, addToList],
  );

  /**
   * Decide o destino e age.
   * @returns true se a ação foi resolvida, false se precisa abrir o picker.
   */
  const handleFavoriteClick = useCallback(
    (
      product: Product,
      opts?: { shiftKey?: boolean; variant?: FavoriteVariantInfo; forceListId?: string },
    ): { resolved: true } | { resolved: false; reason: 'picker-needed' } => {
      if (!user) {
        toggleFavorite(product.id, opts?.variant);
        return { resolved: true };
      }
      // BUG-FE-3 fix: use remote membership (not localStorage) when authenticated.
      // localStorage is stale on new devices and after clearing site data.
      const alreadyFav = membership.has(product.id) && (membership.get(product.id)?.size ?? 0) > 0;
      if (alreadyFav) {
        // Toggle off: remove de tudo
        void removeFromAll(product.id);
        return { resolved: true };
      }
      // Add path
      if (opts?.forceListId) {
        void addToList(opts.forceListId, product, opts.variant);
        return { resolved: true };
      }
      // Sem múltiplas listas OU shift pressionado → vai para a default
      if (!hasMultipleLists || opts?.shiftKey) {
        const lastUsedListId = getLastUsedListId();
        const target =
          (lastUsedListId && lists.find((l) => l.id === lastUsedListId)) || defaultList;
        if (target) {
          void addToList(target.id, product, opts?.variant);
        } else {
          // Sem listas remotas ainda — fallback puro store legado
          toggleFavorite(product.id, opts?.variant);
        }
        return { resolved: true };
      }
      // Múltiplas listas e sem shift → o caller deve mostrar picker
      return { resolved: false, reason: 'picker-needed' };
    },
    [
      user,
      isFavorite,
      hasMultipleLists,
      getLastUsedListId,
      defaultList,
      lists,
      toggleFavorite,
      removeFromAll,
      addToList,
    ],
  );

  return {
    lists,
    defaultList,
    membership,
    hasMultipleLists,
    handleFavoriteClick,
    addToList,
    removeFromAll,
    createAndAdd,
    isFavorite,
  };
}
