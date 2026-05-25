// Hook CRUD para Fornecedores de Gravação (via external-db-bridge)
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invokeExternalDb, invokeExternalDbSingle, invokeExternalDbDelete } from '@/lib/external-db';
import type { FornecedorGravacao } from '@/types/gravacao-database';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';

const QUERY_KEY = 'fornecedores-gravacao';

interface FornecedorFormData {
  codigo: string;
  nome: string;
  nome_curto: string;
  tipo_integracao: 'api_spot' | 'api_rest' | 'manual';
  api_endpoint?: string;
  api_access_key?: string;
  api_ativo: boolean;
  contato_nome?: string;
  contato_telefone?: string;
  contato_email?: string;
  ativo: boolean;
}

export function useFornecedoresGravacao() {
  const queryClient = useQueryClient();

  const fornecedoresQuery = useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async (): Promise<FornecedorGravacao[]> => {
      const result = await invokeExternalDb<FornecedorGravacao>({
        table: 'fornecedor_gravacao',
        operation: 'select',
        orderBy: { column: 'nome', ascending: true },
      });
      return result.records;
    },
    staleTime: 10 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: async (formData: FornecedorFormData): Promise<FornecedorGravacao> => {
      return invokeExternalDbSingle<FornecedorGravacao>({
        table: 'fornecedor_gravacao',
        operation: 'insert',
        data: formData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Fornecedor criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(sanitizeError(error));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ 
      id, 
      ...updates 
    }: Partial<FornecedorFormData> & { id: string }): Promise<FornecedorGravacao> => {
      return invokeExternalDbSingle<FornecedorGravacao>({
        table: 'fornecedor_gravacao',
        operation: 'update',
        id,
        data: updates,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Fornecedor atualizado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(sanitizeError(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await invokeExternalDbDelete('fornecedor_gravacao', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Fornecedor excluído com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(sanitizeError(error));
    },
  });

  return {
    fornecedores: fornecedoresQuery.data ?? [],
    isLoading: fornecedoresQuery.isLoading,
    isError: fornecedoresQuery.isError,
    error: fornecedoresQuery.error,
    refetch: fornecedoresQuery.refetch,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
