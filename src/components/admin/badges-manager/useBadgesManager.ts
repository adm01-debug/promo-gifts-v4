/**
 * Hook de dados do módulo de Gestão de Badges.
 * CRUD + toggle sobre public.product_badge_definitions (RLS: escrita admin+).
 *
 * FIX 2026-06-27: Substituídos todos os casts 'as never' por untypedFrom().
 * product_badge_definitions não está no types.ts gerado (o bot de regeneração
 * remove a tabela periodicamente). untypedFrom() é a API canônica para tabelas
 * fora do schema gerado — type-safe via generic, sem 'as never' silenciosos.
 * fix_version: badges_manager_untyped_from_20260627
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { untypedFrom } from '@/lib/supabase-untyped';
import { sanitizeError } from '@/lib/security/sanitize-error';
import type { BadgeDefinition, BadgeDefinitionInsert, BadgeDefinitionUpdate } from './types';

const QK = ['admin', 'product_badge_definitions'] as const;

async function fetchBadges(): Promise<BadgeDefinition[]> {
  const { data, error } = await untypedFrom<BadgeDefinition>('product_badge_definitions')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('priority', { ascending: false });
  if (error) throw error;
  return (data as BadgeDefinition[] | null) ?? [];
}

export function useBadgesManager() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: QK, queryFn: fetchBadges, staleTime: 60_000 });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: QK });
  };

  const updateBadge = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: BadgeDefinitionUpdate }) => {
      const { error } = await untypedFrom<BadgeDefinition>('product_badge_definitions')
        .update(patch as Record<string, unknown>)
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
      const { error } = await untypedFrom<BadgeDefinition>('product_badge_definitions')
        .update({ is_enabled: enabled } as Record<string, unknown>)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: unknown) =>
      toast.error('Falha ao alternar status', { description: sanitizeError(e) }),
  });

  const createBadge = useMutation({
    mutationFn: async (payload: BadgeDefinitionInsert) => {
      const { error } = await untypedFrom<BadgeDefinition>('product_badge_definitions')
        .insert({ ...payload, is_system: false } as Record<string, unknown>);
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
      const { error } = await untypedFrom<BadgeDefinition>('product_badge_definitions')
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
