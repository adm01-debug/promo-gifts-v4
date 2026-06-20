import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { untypedRpc } from '@/lib/supabase-untyped';
import type { TablesUpdate } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';

import { logger } from '@/lib/logger';
export interface FavoriteList {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  is_default: boolean;
  is_archived: boolean;
  client_id: string | null;
  client_name: string | null;
  shared_token: string | null;
  shared_expires_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  item_count?: number;
}

export interface FavoriteListItem {
  id: string;
  list_id: string;
  user_id: string;
  product_id: string;
  variant_id: string | null;
  variant_info: {
    color_name?: string | null;
    color_hex?: string | null;
    size_code?: string | null;
    thumbnail?: string | null;
  } | null;
  note: string | null;
  price_at_save: number | null;
  position: number;
  added_at: string;
  updated_at: string;
}

const LISTS_KEY = ['favorite-lists'];
const ITEMS_KEY = (listId: string) => ['favorite-items', listId];

type RestoreResult = {
  ok: boolean;
  list_id: string;
  item_id: string | null;
  original_list_changed: boolean;
  error?: string;
};

/** Hook principal — gerencia listas do usuário autenticado (sync com Supabase). */
export function useFavoriteLists() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const listsQuery = useQuery({
    queryKey: LISTS_KEY,
    queryFn: async (): Promise<FavoriteList[]> => {
      if (!user) return [];
      // Garante lista padrão
      const { error: ensureErr } = await supabase.rpc('ensure_default_favorite_list', {
        _user_id: user.id,
      });
      if (ensureErr) logger.warn('[favorites] ensure_default_favorite_list failed', ensureErr);

      const { data, error } = await supabase
        .from('favorite_lists')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .order('is_default', { ascending: false })
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Counts via RPC – single GROUP BY instead of fetching all rows (BUG-FE-4 fix)
      const ids = (data ?? []).map((l) => l.id);
      const counts: Record<string, number> = {};
      if (ids.length) {
        const { data: countRows } = await untypedRpc('get_favorite_list_counts', {
          _user_id: user.id,
        });
        ((countRows as Array<{ list_id: string; item_count: number }> | null) ?? []).forEach(
          (r) => {
            counts[r.list_id] = Number(r.item_count);
          },
        );
      }

      setLastSyncedAt(new Date());
      return (data ?? []).map((l) => ({
        ...l,
        item_count: counts[l.id] ?? 0,
      })) as unknown as FavoriteList[];
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const createList = useMutation({
    mutationFn: async (input: Partial<FavoriteList> & { name: string }) => {
      if (!user) throw new Error('not-authenticated');
      const { data, error } = await supabase
        .from('favorite_lists')
        .insert({
          user_id: user.id,
          name: input.name,
          description: input.description ?? null,
          color: input.color ?? '#3B82F6',
          icon: input.icon ?? 'Heart',
          client_id: input.client_id ?? null,
          client_name: input.client_name ?? null,
          position: listsQuery.data?.length ?? 0,
        })
        .select()
        .single();
      if (error) throw error;
      return data as FavoriteList;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LISTS_KEY });
      toast.success('Lista criada');
    },
    onError: (e: Error) => toast.error('Erro ao criar lista', { description: sanitizeError(e) }),
  });

  const updateList = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<FavoriteList> & { id: string }) => {
      // item_count is a computed field, not a real column — exclude it from the update.
      const { item_count: _itemCount, ...columns } = patch;
      const dbPatch: TablesUpdate<'favorite_lists'> = columns;
      const { data, error } = await supabase
        .from('favorite_lists')
        .update(dbPatch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as FavoriteList;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: LISTS_KEY }),
    onError: (e: Error) =>
      toast.error('Erro ao atualizar lista', { description: sanitizeError(e) }),
  });

  const deleteList = useMutation({
    mutationFn: async (id: string) => {
      const target = listsQuery.data?.find((l) => l.id === id);
      if (target?.is_default) throw new Error('Não é possível excluir a lista padrão');

      // Move all items to trash before deleting the list (prevents data loss on CASCADE DELETE)
      const { data: listItems } = await supabase
        .from('favorite_items')
        .select('id')
        .eq('list_id', id);
      const itemIds = (listItems ?? []).map((i: { id: string }) => i.id);
      if (itemIds.length > 0) {
        // Deleting via the same table triggers fn_favorite_items_soft_delete → trash
        const { error: itemsErr } = await supabase
          .from('favorite_items')
          .delete()
          .in('id', itemIds);
        if (itemsErr) throw itemsErr;
      }

      const { error } = await supabase.from('favorite_lists').delete().eq('id', id);
      if (error) throw error;
      return { id, itemCount: itemIds.length };
    },
    onSuccess: ({ itemCount }) => {
      qc.invalidateQueries({ queryKey: LISTS_KEY });
      qc.invalidateQueries({ queryKey: ['favorite-items'] });
      qc.invalidateQueries({ queryKey: ['favorite-trash'] });
      qc.invalidateQueries({ queryKey: ['favorite-membership', user?.id] });
      const msg =
        itemCount > 0
          ? `Lista excluída. ${itemCount} ${itemCount === 1 ? 'item movido' : 'itens movidos'} para a Lixeira.`
          : 'Lista excluída';
      toast.success(msg);
    },
    onError: (e: Error) => toast.error('Operação falhou', { description: sanitizeError(e) }),
  });

  const generateShareToken = useMutation({
    mutationFn: async ({
      listId,
      expiresInDays = 30,
    }: {
      listId: string;
      expiresInDays?: number;
    }) => {
      // Gera token aleatório de 32 bytes em hex
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      const token = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const expiresAt = new Date(Date.now() + expiresInDays * 86400_000).toISOString();
      const { data, error } = await supabase
        .from('favorite_lists')
        .update({ shared_token: token, shared_expires_at: expiresAt })
        .eq('id', listId)
        .select()
        .single();
      if (error) throw error;
      return data as FavoriteList;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LISTS_KEY });
      toast.success('Link de compartilhamento gerado');
    },
  });

  const revokeShareToken = useMutation({
    mutationFn: async (listId: string) => {
      const { error } = await supabase
        .from('favorite_lists')
        .update({ shared_token: null, shared_expires_at: null })
        .eq('id', listId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LISTS_KEY });
      toast.success('Link revogado');
    },
  });

  const defaultList = useMemo(
    () => listsQuery.data?.find((l) => l.is_default) ?? listsQuery.data?.[0] ?? null,
    [listsQuery.data],
  );

  return {
    lists: listsQuery.data ?? [],
    isLoading: listsQuery.isLoading,
    error: listsQuery.error,
    defaultList,
    lastSyncedAt,
    createList,
    updateList,
    deleteList,
    generateShareToken,
    revokeShareToken,
    refetch: listsQuery.refetch,
  };
}

/** Hook para items de uma lista específica. */
export function useFavoriteListItems(listId: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const itemsQuery = useQuery({
    queryKey: ITEMS_KEY(listId ?? 'none'),
    queryFn: async (): Promise<FavoriteListItem[]> => {
      if (!listId) return [];
      const { data, error } = await supabase
        .from('favorite_items')
        .select('*')
        .eq('list_id', listId)
        .order('position', { ascending: true })
        .order('added_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FavoriteListItem[];
    },
    enabled: !!listId && !!user,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const addItem = useMutation({
    mutationFn: async (input: {
      listId: string;
      productId: string;
      variantId?: string | null;
      variantInfo?: FavoriteListItem['variant_info'];
      note?: string | null;
      priceAtSave?: number | null;
    }) => {
      if (!user) throw new Error('not-authenticated');
      const { data, error } = await supabase
        .from('favorite_items')
        .upsert(
          {
            list_id: input.listId,
            user_id: user.id,
            product_id: input.productId,
            variant_id: input.variantId ?? null,
            variant_info: (input.variantInfo ?? null) as never,
            note: input.note ?? null,
            price_at_save: input.priceAtSave ?? null,
          },
          { onConflict: 'list_id,product_id,variant_id', ignoreDuplicates: false },
        )
        .select()
        .single();
      if (error) throw error;
      return data as unknown as FavoriteListItem;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ITEMS_KEY(vars.listId) });
      qc.invalidateQueries({ queryKey: LISTS_KEY });
    },
    onError: (e: Error) => toast.error('Erro ao salvar', { description: sanitizeError(e) }),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<FavoriteListItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('favorite_items')
        .update(patch as never)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as FavoriteListItem;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ITEMS_KEY(data.list_id) });
    },
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('favorite_items').delete().eq('id', id);
      if (error) throw error;
      return id; // original item id (used as original_id in trash)
    },
    onSuccess: (deletedId) => {
      qc.invalidateQueries({ queryKey: ITEMS_KEY(listId ?? 'none') });
      qc.invalidateQueries({ queryKey: LISTS_KEY });
      qc.invalidateQueries({ queryKey: ['favorite-trash'] });
      qc.invalidateQueries({ queryKey: ['favorite-membership', user?.id] });
      if (!user) return;
      toast.success('Item removido', {
        description: 'Você tem 30 dias para restaurar pela Lixeira.',
        action: {
          label: 'Desfazer',
          onClick: async () => {
            // Find the exact item by original_id before calling restore
            const { data: trashed } = await supabase
              .from('favorite_items_trash')
              .select('id')
              .eq('user_id', user.id)
              .eq('original_id', deletedId)
              .maybeSingle();
            if (!trashed) {
              toast.error('Item não encontrado na lixeira');
              return;
            }
            const { data: rawRestored } = await untypedRpc('restore_favorite_from_trash', {
              _trash_id: trashed.id,
              _user_id: user.id,
            });
            const restored = rawRestored as RestoreResult | null;
            if (restored?.ok) {
              qc.invalidateQueries({ queryKey: ITEMS_KEY(listId ?? 'none') });
              qc.invalidateQueries({ queryKey: LISTS_KEY });
              qc.invalidateQueries({ queryKey: ['favorite-trash'] });
              const msg = restored.original_list_changed
                ? 'Item restaurado na lista padrão (lista original foi excluída)'
                : 'Item restaurado';
              toast.success(msg);
            } else {
              toast.error('Não foi possível restaurar');
            }
          },
        },
        duration: 8000,
      });
    },
  });

  /** Remove múltiplos itens em uma única query (evita N toasts e N round-trips). */
  const removeItems = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return ids;
      const { error } = await supabase.from('favorite_items').delete().in('id', ids);
      if (error) throw error;
      return ids;
    },
    onSuccess: (ids) => {
      qc.invalidateQueries({ queryKey: ITEMS_KEY(listId ?? 'none') });
      qc.invalidateQueries({ queryKey: LISTS_KEY });
      qc.invalidateQueries({ queryKey: ['favorite-trash'] });
      qc.invalidateQueries({ queryKey: ['favorite-membership', user?.id] });
      const label = `${ids.length} ${ids.length === 1 ? 'item removido' : 'itens removidos'}`;
      if (!user) {
        toast.success(label, { description: 'Restaure pela Lixeira em até 30 dias.' });
        return;
      }
      toast.success(label, {
        description: 'Restaure pela Lixeira em até 30 dias.',
        action: {
          label: 'Desfazer',
          onClick: async () => {
            const { data: trashed } = await supabase
              .from('favorite_items_trash')
              .select('id')
              .eq('user_id', user.id)
              .in('original_id', ids);
            if (!trashed?.length) {
              toast.error('Itens não encontrados na lixeira');
              return;
            }
            const results = await Promise.allSettled(
              trashed.map((t) =>
                // RPC real (verificado no BD) ainda ausente de types.ts; segue o
                // padrão do projeto de cast `as never` para RPCs não tipados.
                supabase.rpc(
                  'restore_favorite_from_trash' as never,
                  {
                    _trash_id: t.id,
                    _user_id: user.id,
                  } as never,
                ),
              ),
            );
            const restoredCount = results.filter((r) => r.status === 'fulfilled').length;
            qc.invalidateQueries({ queryKey: ITEMS_KEY(listId ?? 'none') });
            qc.invalidateQueries({ queryKey: LISTS_KEY });
            qc.invalidateQueries({ queryKey: ['favorite-trash'] });
            qc.invalidateQueries({ queryKey: ['favorite-membership', user?.id] });
            toast.success(
              `${restoredCount} ${restoredCount === 1 ? 'item restaurado' : 'itens restaurados'}`,
            );
          },
        },
        duration: 8000,
      });
    },
    onError: (e: Error) => toast.error('Erro ao remover', { description: sanitizeError(e) }),
  });

  const moveItem = useMutation({
    mutationFn: async ({ id, toListId }: { id: string; toListId: string }) => {
      if (toListId === listId) throw new Error('O item já está nesta lista.');
      const { error } = await supabase
        .from('favorite_items')
        .update({ list_id: toListId })
        .eq('id', id);
      if (error) {
        if (error.code === '23505') throw new Error('Este produto já está na lista de destino.');
        throw error;
      }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ITEMS_KEY(listId ?? 'none') });
      qc.invalidateQueries({ queryKey: ITEMS_KEY(vars.toListId) });
      qc.invalidateQueries({ queryKey: LISTS_KEY });
      qc.invalidateQueries({ queryKey: ['favorite-membership', user?.id] });
      toast.success('Item movido');
    },
    onError: (e: Error) => toast.error('Erro ao mover', { description: sanitizeError(e) }),
  });

  return {
    items: itemsQuery.data ?? [],
    isLoading: itemsQuery.isLoading,
    addItem,
    updateItem,
    removeItem,
    removeItems,
    moveItem,
    refetch: itemsQuery.refetch,
  };
}

/** Hook para a Lixeira. */
export function useFavoriteTrash() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const KEY = ['favorite-trash'];

  const trashQuery = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('favorite_items_trash')
        .select('*')
        .eq('user_id', user.id)
        .order('deleted_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const restoreItem = useMutation({
    mutationFn: async (trashId: string) => {
      if (!user) throw new Error('not-authenticated');
      // Atomic RPC: handles missing original list by falling back to default list
      const { data: rawData, error } = await untypedRpc('restore_favorite_from_trash', {
        _trash_id: trashId,
        _user_id: user.id,
      });
      if (error) throw error;
      const data = rawData as RestoreResult | null;
      if (!data?.ok) throw new Error(data?.error ?? 'Restauração falhou');
      return data as {
        ok: boolean;
        list_id: string;
        item_id: string | null;
        original_list_changed: boolean;
      };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: LISTS_KEY });
      qc.invalidateQueries({ queryKey: ['favorite-items'] });
      const msg = data.original_list_changed
        ? 'Item restaurado na lista padrão (lista original foi excluída)'
        : 'Item restaurado';
      toast.success(msg);
    },
    onError: (e: Error) => toast.error('Operação falhou', { description: sanitizeError(e) }),
  });

  const purgeItem = useMutation({
    mutationFn: async (trashId: string) => {
      const { error } = await supabase.from('favorite_items_trash').delete().eq('id', trashId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const purgeAll = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('not-authenticated');
      const { error } = await supabase.from('favorite_items_trash').delete().eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success('Lixeira esvaziada');
    },
  });

  return {
    items: trashQuery.data ?? [],
    isLoading: trashQuery.isLoading,
    restoreItem,
    purgeItem,
    purgeAll,
  };
}

/** Migra favoritos do localStorage (legacy) para a lista padrão remota. Idempotente. */
export function useLegacyFavoritesMigration() {
  const { user } = useAuth();
  const { defaultList } = useFavoriteLists();
  const [migrated, setMigrated] = useState(false);

  const run = useCallback(async () => {
    if (!user || !defaultList || migrated) return;
    const KEY = 'product-favorites';
    const FLAG = `favorites-migrated-${user.id}`;
    if (localStorage.getItem(FLAG)) {
      setMigrated(true);
      return;
    }
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        localStorage.setItem(FLAG, '1');
        setMigrated(true);
        return;
      }
      const legacy = JSON.parse(raw) as Array<{
        productId: string;
        variant?: Record<string, unknown>;
      }>;
      if (!Array.isArray(legacy) || legacy.length === 0) {
        localStorage.setItem(FLAG, '1');
        setMigrated(true);
        return;
      }
      const rows = legacy.map((f, idx) => ({
        list_id: defaultList.id,
        user_id: user.id,
        product_id: f.productId,
        variant_id: (f.variant?.variant_id as string | undefined) ?? null,
        variant_info: f.variant ?? null,
        position: idx,
      }));
      const { error } = await supabase.from('favorite_items').upsert(rows as never, {
        onConflict: 'list_id,product_id,variant_id',
        ignoreDuplicates: true,
      });
      if (error) {
        logger.warn('[favorites-migration] upsert failed — will retry on next load', error);
        return; // do NOT setMigrated: allows retry on next page load (FLAG not set)
      }
      localStorage.setItem(FLAG, '1');
      toast.success(`${legacy.length} favoritos migrados para a nuvem`);
      setMigrated(true);
    } catch (e) {
      logger.warn('[favorites-migration]', e);
      // do NOT setMigrated: allows retry on next page load
    }
  }, [user, defaultList, migrated]);

  useEffect(() => {
    run();
  }, [run]);

  return { migrated };
}
