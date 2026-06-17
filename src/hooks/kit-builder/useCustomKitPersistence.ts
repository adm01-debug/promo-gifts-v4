/**
 * Custom Kit Persistence Hook
 * CRUD para a tabela custom_kits (banco local)
 */

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';
import type { KitState } from '@/lib/kit-builder';
import type { Json } from '@/integrations/supabase/types';

// ============================================
// TYPES
// ============================================

export interface CustomKitRow {
  id: string;
  user_id: string;
  name: string;
  status: string;
  box_data: Record<string, unknown> | null;
  items_data: Record<string, unknown>[];
  personalization_data: Record<string, unknown>;
  kit_quantity: number;
  box_price: number;
  items_price: number;
  personalization_price: number;
  total_price: number;
  volume_usage_percent: number;
  color: string;
  icon: string;
  tag: string | null;
  description: string | null;
  is_favorite: boolean;
  is_pinned: boolean;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

const QUERY_KEY = ['custom-kits'] as const;

// ============================================
// HOOK
// ============================================

export function useCustomKitPersistence() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Lista os kits do usuário
  const { data: savedKits = [], isLoading: isLoadingKits } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('custom_kits')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as CustomKitRow[];
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  // Salvar kit (insert ou update)
  const saveMutation = useMutation({
    mutationFn: async ({
      kitId,
      kitState,
      kitQuantity,
    }: {
      kitId?: string;
      kitState: KitState;
      kitQuantity: number;
    }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const identity = kitState.identity;
      const payload = {
        user_id: user.id,
        name: kitState.name || 'Kit sem nome',
        status: kitState.isValid ? 'complete' : 'draft',
        kit_type: kitState.kitType || 'montado',
        box_data: kitState.box ? (structuredClone(kitState.box) as unknown as Json) : null,
        items_data: structuredClone(kitState.items) as unknown as Json,
        personalization_data: structuredClone(kitState.personalization) as unknown as Json,
        kit_quantity: kitQuantity,
        box_price: kitState.boxPrice,
        items_price: kitState.itemsPrice,
        personalization_price: kitState.personalizationPrice,
        total_price: kitState.totalPrice,
        volume_usage_percent: kitState.volumeUsagePercent,
        color: identity?.color ?? '#3B82F6',
        icon: identity?.icon ?? 'Package',
        tag: identity?.tag ?? null,
        description: identity?.description ?? null,
        is_favorite: identity?.isFavorite ?? false,
        updated_at: new Date().toISOString(),
      };

      if (kitId) {
        const { data, error } = await supabase
          .from('custom_kits')
          .update(payload)
          .eq('id', kitId)
          .eq('user_id', user.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.from('custom_kits').insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Kit salvo com sucesso!');
    },
    onError: (err: Error) => {
      toast.error('Erro ao salvar kit', { description: sanitizeError(err) });
    },
  });

  // Deletar kit
  const deleteMutation = useMutation({
    mutationFn: async (kitId: string) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      const { error } = await supabase
        .from('custom_kits')
        .delete()
        .eq('id', kitId)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Kit removido');
    },
    onError: (err: Error) => {
      toast.error('Erro ao remover', { description: sanitizeError(err) });
    },
  });

  const saveKit = useCallback(
    (kitState: KitState, kitQuantity: number, kitId?: string) =>
      saveMutation.mutateAsync({ kitId, kitState, kitQuantity }),
    [saveMutation],
  );

  const deleteKit = useCallback(
    (kitId: string) => deleteMutation.mutateAsync(kitId),
    [deleteMutation],
  );

  /** Marca o kit como recém-usado (best-effort). */
  const bumpLastUsed = useCallback(
    async (kitId: string) => {
      if (!user?.id) return;
      try {
        await supabase
          .from('custom_kits')
          .update({ last_used_at: new Date().toISOString() } as never)
          .eq('id', kitId)
          .eq('user_id', user.id);
        queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      } catch {
        /* best-effort */
      }
    },
    [user?.id, queryClient],
  );

  /** Fixa/desfixa kit em destaque (apenas 1 por usuário). */
  const togglePinned = useCallback(
    async (kitId: string, value: boolean) => {
      if (!user?.id) return;
      try {
        if (value) {
          // Desfixa qualquer outro kit fixado primeiro
          await supabase
            .from('custom_kits')
            .update({ is_pinned: false } as never)
            .eq('user_id', user.id)
            .eq('is_pinned', true);
        }
        await supabase
          .from('custom_kits')
          .update({ is_pinned: value } as never)
          .eq('id', kitId)
          .eq('user_id', user.id);
        queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        toast.success(value ? 'Kit fixado em destaque' : 'Kit desafixado');
      } catch {
        toast.error('Erro ao alterar destaque');
      }
    },
    [user?.id, queryClient],
  );

  return {
    savedKits,
    isLoadingKits,
    saveKit,
    deleteKit,
    bumpLastUsed,
    togglePinned,
    isSaving: saveMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
