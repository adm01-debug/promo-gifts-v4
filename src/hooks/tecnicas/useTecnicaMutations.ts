/**
 * Hook: Mutations de Técnicas
 *
 * Responsável por: CRUD operations (create, update, delete, toggle)
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invokeExternalDbSingle } from '@/lib/external-db';
import { TECNICAS_QUERY_KEYS } from '@/hooks/tecnicas/keys';
import type { PersonalizationTechniqueRaw } from '@/types/tecnica-unificada';
import { toast } from 'sonner';

/**
 * Todas as mutations para técnicas em um único hook
 */
export function useTecnicaMutations() {
  const queryClient = useQueryClient();

  // Toggle status
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      await invokeExternalDbSingle({
        table: 'personalization_techniques',
        operation: 'update',
        id,
        data: { is_active: ativo },
      });
    },
    onSuccess: (_, { ativo }) => {
      queryClient.invalidateQueries({ queryKey: TECNICAS_QUERY_KEYS.all });
      toast.success(ativo ? 'Técnica ativada!' : 'Técnica desativada!');
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  // Create
  const createMutation = useMutation({
    mutationFn: async (data: Partial<PersonalizationTechniqueRaw>) => {
      await invokeExternalDbSingle({
        table: 'personalization_techniques',
        operation: 'insert',
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TECNICAS_QUERY_KEYS.all });
      toast.success('Técnica criada!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar: ${error.message}`);
    },
  });

  // Update
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<PersonalizationTechniqueRaw>) => {
      await invokeExternalDbSingle({
        table: 'personalization_techniques',
        operation: 'update',
        id,
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TECNICAS_QUERY_KEYS.all });
      toast.success('Técnica atualizada!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await invokeExternalDbSingle({
        table: 'personalization_techniques',
        operation: 'delete',
        id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TECNICAS_QUERY_KEYS.all });
      toast.success('Técnica removida!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover: ${error.message}`);
    },
  });

  return {
    // Toggle
    toggleStatus: toggleStatusMutation.mutate,
    toggleStatusAsync: toggleStatusMutation.mutateAsync,
    isToggling: toggleStatusMutation.isPending,

    // Create
    create: createMutation.mutate,
    createAsync: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    // Update
    update: updateMutation.mutate,
    updateAsync: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,

    // Delete
    remove: deleteMutation.mutate,
    removeAsync: deleteMutation.mutateAsync,
    isRemoving: deleteMutation.isPending,

    // Combined loading state
    isMutating:
      toggleStatusMutation.isPending ||
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending,
  };
}
