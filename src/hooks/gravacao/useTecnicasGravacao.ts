// Hook CRUD para Tecnicas de Gravacao (via external-db-bridge)
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  invokeExternalDb,
  invokeExternalDbSingle,
  invokeExternalDbDelete,
} from '@/lib/external-db';
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
        invokeExternalDb<TecnicaGravacao>({
          table: 'tecnica_gravacao',
          operation: 'select',
          orderBy: { column: 'nome', ascending: true },
        }),
        invokeExternalDb<{ tecnica_gravacao_id: string }>({
          table: 'tecnica_gravacao_variante',
          operation: 'select',
          select: 'tecnica_gravacao_id',
        }),
      ]);

      const variantesCount: Record<string, number> = {};
      variantesResult.records.forEach((v) => {
        variantesCount[v.tecnica_gravacao_id] = (variantesCount[v.tecnica_gravacao_id] || 0) + 1;
      });

      return tecnicasResult.records.map((t) => ({
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
      return invokeExternalDbSingle<TecnicaGravacao>({
        table: 'tecnica_gravacao',
        operation: 'insert',
        data: { ...formData, slug },
      });
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
      return invokeExternalDbSingle<TecnicaGravacao>({
        table: 'tecnica_gravacao',
        operation: 'update',
        id,
        data: updateData,
      });
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
      const variantesResult = await invokeExternalDb<{ id: string }>({
        table: 'tecnica_gravacao_variante',
        operation: 'select',
        filters: { tecnica_gravacao_id: id },
        select: 'id',
        limit: 1,
      });

      if ((variantesResult.count ?? 0) > 0) {
        // BUG-GRAVACAO-01 FIX: variantesResult.count pode ser null quando a query
        // nao suporta countMode. Usar nullish coalescing evita "existem null variante(s)".
        const numVariantes = variantesResult.count ?? 'algumas';
        throw new Error(
          `Nao e possivel excluir: existem ${numVariantes} variante(s) vinculada(s)`,
        );
      }

      await invokeExternalDbDelete('tecnica_gravacao', id);
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
      await invokeExternalDbSingle({
        table: 'tecnica_gravacao',
        operation: 'update',
        id,
        data: { ativo },
      });
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
        invokeExternalDb<TecnicaGravacao>({
          table: 'tecnica_gravacao',
          operation: 'select',
          filters: { id },
          limit: 1,
        }),
        invokeExternalDb<TecnicaGravacaoVariante>({
          table: 'tecnica_gravacao_variante',
          operation: 'select',
          filters: { tecnica_gravacao_id: id },
          orderBy: { column: 'ordem_exibicao', ascending: true },
        }),
      ]);

      const tecnica = tecnicaResult.records[0];
      if (!tecnica) return null;

      return {
        ...tecnica,
        variantes: variantesResult.records,
        variantes_count: variantesResult.count ?? undefined,
      };
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}
