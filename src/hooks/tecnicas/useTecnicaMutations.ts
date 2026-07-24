/**
 * Hook: Mutations de Técnicas
 *
 * Responsável por: CRUD operations (create, update, delete, toggle)
 */
import { dbInvokeSingle } from '@/lib/db/postgrest';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
      await dbInvokeSingle({
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
    onError: () => {
      toast.error('Erro ao alterar status da técnica');
    },
  });

  // Create
  const createMutation = useMutation({
    mutationFn: async (data: Partial<PersonalizationTechniqueRaw>) => {
      await dbInvokeSingle({
        table: 'personalization_techniques',
        operation: 'insert',
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TECNICAS_QUERY_KEYS.all });
      toast.success('Técnica criada!');
    },
    onError: () => {
      toast.error('Erro ao criar técnica');
    },
  });

  // Update
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<PersonalizationTechniqueRaw> & { id: string }) => {
      await dbInvokeSingle({
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
    onError: () => {
      toast.error('Erro ao atualizar técnica');
    },
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await dbInvokeSingle({
        table: 'personalization_techniques',
        operation: 'delete',
        id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TECNICAS_QUERY_KEYS.all });
      toast.success('Técnica removida!');
    },
    onError: () => {
      toast.error('Erro ao remover técnica');
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
