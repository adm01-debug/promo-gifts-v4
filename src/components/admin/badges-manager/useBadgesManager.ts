/**
 * Hook de dados do módulo de Gestão de Badges.
 * CRUD + toggle sobre public.product_badge_definitions (RLS: escrita admin+).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeError } from '@/lib/security/sanitize-error';
import type { BadgeDefinition, BadgeDefinitionInsert, BadgeDefinitionUpdate } from './types';

const QK = ['admin', 'product_badge_definitions'] as const;

async function fetchBadges(): Promise<BadgeDefinition[]> {
  const { data, error } = await supabase
    .from('product_badge_definitions' as never)
    .select('*')
    .order('sort_order', { ascending: true })
    .order('priority', { ascending: false })
    .returns<BadgeDefinition[]>();
  if (error) throw error;
  return data ?? [];
}

export function useBadgesManager() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: QK, queryFn: fetchBadges, staleTime: 60_000 });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: QK });
  };

  const updateBadge = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: BadgeDefinitionUpdate }) => {
      const { error } = await supabase
        .from('product_badge_definitions' as never)
        .update(patch as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Badge atualizada');
    },
    onError: (e: unknown) =>
      toast.error('Falha ao atualizar badge', { description: sanitizeError(e) }),
  });

  const toggleBadge = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('product_badge_definitions' as never)
        .update({ is_enabled: enabled } as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: unknown) =>
      toast.error('Falha ao alternar status', { description: sanitizeError(e) }),
  });

  const createBadge = useMutation({
    mutationFn: async (payload: BadgeDefinitionInsert) => {
      const { error } = await supabase
        .from('product_badge_definitions' as never)
        .insert({ ...payload, is_system: false } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Badge criada');
    },
    onError: (e: unknown) => toast.error('Falha ao criar badge', { description: sanitizeError(e) }),
  });

  const deleteBadge = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_badge_definitions' as never)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Badge removida');
    },
    onError: (e: unknown) =>
      toast.error('Falha ao remover badge', { description: sanitizeError(e) }),
  });

  return {
    badges: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    updateBadge,
    toggleBadge,
    createBadge,
    deleteBadge,
  };
}
