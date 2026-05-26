// Hook CRUD para Variantes de Técnicas de Gravação (via external-db-bridge)
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invokeExternalDb, invokeExternalDbSingle, invokeExternalDbDelete } from '@/lib/external-db';
import type { 
  TecnicaGravacaoVariante, 
  VarianteFormData 
} from '@/types/gravacao-database';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';

const QUERY_KEY = 'variantes-gravacao';

const generateSlug = (nome: string): string => {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

export function useVariantesGravacao(tecnicaId?: string) {
  const queryClient = useQueryClient();

  const variantesQuery = useQuery({
    queryKey: [QUERY_KEY, tecnicaId],
    queryFn: async (): Promise<TecnicaGravacaoVariante[]> => {
      const filters: Record<string, unknown> = {};
      if (tecnicaId) {
        filters.tecnica_gravacao_id = tecnicaId;
      }

      const result = await invokeExternalDb<TecnicaGravacaoVariante>({
        table: 'tecnica_gravacao_variante',
        operation: 'select',
        filters,
        orderBy: { column: 'ordem_exibicao', ascending: true },
      });

      return result.records;
    },
    staleTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: async (formData: VarianteFormData): Promise<TecnicaGravacaoVariante> => {
      const slug = generateSlug(formData.nome);
      return invokeExternalDbSingle<TecnicaGravacaoVariante>({
        table: 'tecnica_gravacao_variante',
        operation: 'insert',
        data: { ...formData, slug },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['tecnicas-gravacao'] });
      toast.success('Variante criada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(sanitizeError(error));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ 
      id, 
      ...updates 
    }: Partial<VarianteFormData> & { id: string }): Promise<TecnicaGravacaoVariante> => {
      const updateData: Record<string, unknown> = { ...updates };
      if (updates.nome) {
        updateData.slug = generateSlug(updates.nome);
      }
      return invokeExternalDbSingle<TecnicaGravacaoVariante>({
        table: 'tecnica_gravacao_variante',
        operation: 'update',
        id,
        data: updateData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Variante atualizada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(sanitizeError(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await invokeExternalDbDelete('tecnica_gravacao_variante', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['tecnicas-gravacao'] });
      toast.success('Variante excluída com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(sanitizeError(error));
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }): Promise<void> => {
      await invokeExternalDbSingle({
        table: 'tecnica_gravacao_variante',
        operation: 'update',
        id,
        data: { ativo },
      });
    },
    onSuccess: (_, { ativo }) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success(ativo ? 'Variante ativada!' : 'Variante desativada!');
    },
    onError: (error: Error) => {
      toast.error(sanitizeError(error));
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]): Promise<void> => {
      await Promise.all(
        orderedIds.map((id, index) =>
          invokeExternalDbSingle({
            table: 'tecnica_gravacao_variante',
            operation: 'update',
            id,
            data: { ordem_exibicao: index + 1 },
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Ordem atualizada!');
    },
    onError: (error: Error) => {
      toast.error(sanitizeError(error));
    },
  });

  return {
    variantes: variantesQuery.data ?? [],
    isLoading: variantesQuery.isLoading,
    isError: variantesQuery.isError,
    error: variantesQuery.error,
    refetch: variantesQuery.refetch,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    toggleStatus: toggleStatusMutation.mutate,
    reorder: reorderMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isReordering: reorderMutation.isPending,
  };
}
