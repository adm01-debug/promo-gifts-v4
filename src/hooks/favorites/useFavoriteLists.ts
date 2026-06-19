import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
      await supabase.rpc('ensure_default_favorite_list', { _user_id: user.id });

      const { data, error } = await supabase
        .from('favorite_lists')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .order('is_default', { ascending: false })
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Counts em paralelo
      const ids = (data ?? []).map((l) => l.id);
      const counts: Record<string, number> = {};
      if (ids.length) {
        const { data: rows } = await supabase
          .from('favorite_items')
          .select('list_id')
          .in('list_id', ids);
        (rows ?? []).forEach((r: { list_id: string }) => {
          counts[r.list_id] = (counts[r.list_id] ?? 0) + 1;
        });
      }

      setLastSyncedAt(new Date());
      return (data ?? []).map((l) => ({ ...l, item_count: counts[l.id] ?? 0 }));
    },
    enabled: !!user,
    staleTime: 30_000,
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
      return data;
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
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: LISTS_KEY }),
    onError: (e: Error) =>
      toast.error('Erro ao atualizar lista', { description: sanitizeError(e) }),
  });

  const deleteList = useMutation({
    mutationFn: async (id: string) => {
      const target = listsQuery.data?.find((l) => l.id === id);
      if (target?.is_default) throw new Error('Não é possível excluir a lista padrão');
      const { error } = await supabase.from('favorite_lists').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LISTS_KEY });
      toast.success('Lista excluída');
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
      return data;
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
      return id;
    },
    onSuccess: (_id, _vars, ctx) => {
      qc.invalidateQueries({ queryKey: ITEMS_KEY(listId ?? 'none') });
      qc.invalidateQueries({ queryKey: LISTS_KEY });
      qc.invalidateQueries({ queryKey: ['favorite-trash'] });
      // Toast com undo: restaura o último item da lixeira (que acabou de ser movido pelo trigger)
      if (!user) return;
      const productName = (ctx as { productName?: string } | undefined)?.productName ?? 'Item';
      toast.success(`${productName} removido`, {
        description: 'Você tem 30 dias para restaurar pela Lixeira.',
        action: {
          label: 'Desfazer',
          onClick: async () => {
            // pega item mais recente da lixeira deste user e restaura
            const { data: trashed } = await supabase
              .from('favorite_items_trash')
              .select('*')
              .eq('user_id', user.id)
              .order('deleted_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (!trashed) {
              toast.error('Nada para desfazer');
              return;
            }
            await supabase.from('favorite_items').insert({
              list_id: trashed.list_id,
              user_id: user.id,
              product_id: trashed.product_id,
              variant_id: trashed.variant_id,
              variant_info: trashed.variant_info,
              note: trashed.note,
              price_at_save: trashed.price_at_save,
            } as never);
            await supabase.from('favorite_items_trash').delete().eq('id', trashed.id);
            qc.invalidateQueries({ queryKey: ITEMS_KEY(listId ?? 'none') });
            qc.invalidateQueries({ queryKey: LISTS_KEY });
            qc.invalidateQueries({ queryKey: ['favorite-trash'] });
            toast.success('Item restaurado');
          },
        },
        duration: 8000,
      });
    },
  });

  const moveItem = useMutation({
    mutationFn: async ({ id, toListId }: { id: string; toListId: string }) => {
      const { error } = await supabase
        .from('favorite_items')
        .update({ list_id: toListId })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['favorite-items'] });
      qc.invalidateQueries({ queryKey: LISTS_KEY });
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
  });

  const restoreItem = useMutation({
    mutationFn: async (trashId: string) => {
      if (!user) throw new Error('not-authenticated');
      const trashed = trashQuery.data?.find((t) => t.id === trashId);
      if (!trashed) throw new Error('Item não encontrado na lixeira');

      const { error: insErr } = await supabase.from('favorite_items').insert({
        list_id: trashed.list_id,
        user_id: user.id,
        product_id: trashed.product_id,
        variant_id: trashed.variant_id,
        variant_info: trashed.variant_info,
        note: trashed.note,
        price_at_save: trashed.price_at_save,
      } as never);
      if (insErr) throw insErr;

      const { error: delErr } = await supabase
        .from('favorite_items_trash')
        .delete()
        .eq('id', trashId);
      if (delErr) throw delErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: LISTS_KEY });
      qc.invalidateQueries({ queryKey: ['favorite-items'] });
      toast.success('Item restaurado');
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
      if (!error) {
        localStorage.setItem(FLAG, '1');
        toast.success(`${legacy.length} favoritos migrados para a nuvem`);
      }
    } catch (e) {
      logger.warn('[favorites-migration]', e);
    } finally {
      setMigrated(true);
    }
  }, [user, defaultList, migrated]);

  useEffect(() => {
    run();
  }, [run]);

  return { migrated };
}
