import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ramoAtividadeService } from '@/services/ramoAtividadeService';
import type { RamoAtividade } from '@/types/ramo-atividade';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';

// ============================================================
// QUERY KEYS
// ============================================================
const QUERY_KEY = ['ramo-atividade'];

// ============================================================
// QUERIES
// ============================================================

// Buscar todos os ramos de atividade (categorias pai)
export function useRamosAtividade(apenasAtivos = true) {
  return useQuery({
    queryKey: [...QUERY_KEY, 'list', { apenasAtivos }],
    queryFn: async () => {
      const { ramos } = await ramoAtividadeService.getRamos(apenasAtivos);
      return ramos;
    },
    staleTime: 60 * 60 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
  });
}

// Buscar ramos com estatísticas (formato similar ao useMaterialGroups)
export function useRamosAtividadeGroups() {
  return useQuery({
    queryKey: [...QUERY_KEY, 'groups'],
    queryFn: async () => {
      const { groups, count } = await ramoAtividadeService.getRamosComEstatisticas();
      return {
        groups,
        totalGroups: count,
        totalSegmentos: groups.reduce((acc, g) => acc + g.total_segmentos, 0),
      };
    },
    staleTime: 60 * 60 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
  });
}

export const useRamoAtividadeGroups = useRamosAtividadeGroups;

// Buscar ramo por ID
export function useRamoAtividade(id: string | undefined) {
  return useQuery({
    queryKey: [...QUERY_KEY, id],
    queryFn: async () => {
      if (!id) return null;
      return ramoAtividadeService.getRamoById(id);
    },
    enabled: !!id,
    staleTime: 30 * 60 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
  });
}

// ============================================================
// MUTATIONS
// ============================================================

// Criar ramo de atividade
export function useCreateRamoAtividade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Partial<RamoAtividade>) => {
      return ramoAtividadeService.createRamo(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Ramo de atividade criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar', { description: sanitizeError(error) });
    },
  });
}

// Atualizar ramo de atividade
export function useUpdateRamoAtividade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<RamoAtividade> & { id: string }) => {
      return ramoAtividadeService.updateRamo(id, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Ramo de atividade atualizado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar', { description: sanitizeError(error) });
    },
  });
}

// Deletar ramo de atividade
export function useDeleteRamoAtividade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return ramoAtividadeService.deleteRamo(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Ramo de atividade removido!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover', { description: sanitizeError(error) });
    },
  });
}

// Toggle ativo/inativo
export function useToggleRamoAtividade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      return ramoAtividadeService.updateRamo(id, { ativo });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success(`Ramo ${data.ativo ? 'ativado' : 'desativado'}!`);
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar', { description: sanitizeError(error) });
    },
  });
}
