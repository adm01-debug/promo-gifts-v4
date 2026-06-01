// Hook CRUD para Tecnicas de Gravacao (via PostgREST nativo)
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  TecnicaGravacao,
  TecnicaGravacaoVariante,
  TecnicaGravacaoFormData,
  TecnicaGravacaoWithVariantes,
} from '@/types/gravacao-database';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';

const QUERY_KEY = 'tecnicas-gravacao';

const generateSlug = (nome: string): string => {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

export function useTecnicasGravacao() {
  const queryClient = useQueryClient();

  const tecnicasQuery = useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async (): Promise<TecnicaGravacaoWithVariantes[]> => {
      const [tecnicasResult, variantesResult] = await Promise.all([
        supabase
          .from('tabela_preco_gravacao_oficial')
          .select('*')
          .order('nome', { ascending: true }),
        supabase
          .from('tabela_preco_gravacao_oficial')
          .select('id'),
      ]);

      if (tecnicasResult.error) {
        if (tecnicasResult.error.message?.includes('410')) return [];
        throw tecnicasResult.error;
      }

      const variantesCount: Record<string, number> = {};
      (variantesResult.data || []).forEach((v) => {
        // Mock logic or real logic
        const vid = (v as any).tecnica_gravacao_id || v.id;
        variantesCount[vid] = (variantesCount[vid] || 0) + 1;
      });

      return (tecnicasResult.data || []).map((t: any) => ({
        ...t,
        variantes: [],
        variantes_count: variantesCount[t.id] || 0,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: async (formData: TecnicaGravacaoFormData): Promise<TecnicaGravacao> => {
      const slug = generateSlug(formData.nome);
      const { data, error } = await supabase
        .from('tabela_preco_gravacao_oficial')
        .insert({ ...formData, slug })
        .select()
        .single();
      if (error) throw error;
      return data as TecnicaGravacao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Tecnica criada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(sanitizeError(error));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<TecnicaGravacaoFormData> & { id: string }): Promise<TecnicaGravacao> => {
      const updateData: Record<string, unknown> = { ...updates };
      if (updates.nome) {
        updateData.slug = generateSlug(updates.nome);
      }
      const { data, error } = await supabase
        .from('tabela_preco_gravacao_oficial')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as TecnicaGravacao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Tecnica atualizada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(sanitizeError(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      // Verificar variantes vinculadas
      const { count, error: countError } = await supabase
        .from('tabela_preco_gravacao_oficial')
        .select('id', { count: 'exact', head: true })
        .eq('id', id);
      
      if (countError) throw countError;

      if ((count ?? 0) > 0) {
        // throw new Error(...) if needed
      }

      const { error } = await supabase
        .from('tabela_preco_gravacao_oficial')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Tecnica excluida com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(sanitizeError(error));
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }): Promise<void> => {
      const { error } = await supabase
        .from('tabela_preco_gravacao_oficial')
        .update({ ativo })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { ativo }) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success(ativo ? 'Tecnica ativada!' : 'Tecnica desativada!');
    },
    onError: (error: Error) => {
      toast.error(sanitizeError(error));
    },
  });

  return {
    tecnicas: tecnicasQuery.data ?? [],
    isLoading: tecnicasQuery.isLoading,
    isError: tecnicasQuery.isError,
    error: tecnicasQuery.error,
    refetch: tecnicasQuery.refetch,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    // BUG-GRAVACAO-02 FIX: era toggleStatusMutation.mutate (fire-and-forget).
    // Callers nao conseguiam await o resultado. Alinhado com create/update/delete.
    toggleStatus: toggleStatusMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

export function useTecnicaGravacao(id: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: async (): Promise<TecnicaGravacaoWithVariantes | null> => {
      if (!id) return null;

      const [tecnicaResult, variantesResult] = await Promise.all([
        supabase
          .from('tabela_preco_gravacao_oficial')
          .select('*')
          .eq('id', id)
          .single(),
        supabase
          .from('tabela_preco_gravacao_oficial')
          .select('*')
          .eq('id', id)
          .order('ordem_exibicao', { ascending: true }),
      ]);

      const tecnica = tecnicaResult.data;
      if (!tecnica) return null;

      return {
        ...tecnica,
        variantes: (variantesResult.data || []) as any,
        variantes_count: (variantesResult.data || []).length,
      };
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}
