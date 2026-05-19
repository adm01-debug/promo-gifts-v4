/**
 * Admin Kit Templates Hook
 * CRUD para a tabela kit_templates (admin only).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { KitTemplateRow } from './useKitTemplates';

const QUERY_KEY = ['admin-kit-templates'] as const;

export type KitTemplateInput = Partial<Omit<KitTemplateRow, 'id' | 'created_at' | 'updated_at'>> & {
  name: string;
};

export function useAdminKitTemplates() {
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kit_templates')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as KitTemplateRow[];
    },
    staleTime: 30_000,
  });

  const upsertMutation = useMutation({
    mutationFn: async ({ id, ...payload }: KitTemplateInput & { id?: string }) => {
      if (id) {
        const { error } = await supabase
          .from('kit_templates')
          .update(payload as never)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('kit_templates')
          .insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['kit-templates'] });
      toast.success('Template salvo');
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('kit_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['kit-templates'] });
      toast.success('Template removido');
    },
    onError: () => toast.error('Erro ao remover'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('kit_templates')
        .update({ is_active } as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['kit-templates'] });
    },
  });

  return {
    templates,
    isLoading,
    upsert: upsertMutation.mutateAsync,
    isUpserting: upsertMutation.isPending,
    remove: deleteMutation.mutateAsync,
    isRemoving: deleteMutation.isPending,
    toggleActive: toggleActiveMutation.mutateAsync,
  };
}
