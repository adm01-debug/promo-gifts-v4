import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ramoAtividadeService } from '@/services/ramoAtividadeService';
import type { RamoAtividadeFilho, SegmentoComplete } from '@/types/ramo-atividade';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';

// ============================================================
// QUERY KEYS
// ============================================================
const QUERY_KEY = ['ramo-atividade-filho'];

// ============================================================
// QUERIES
// ============================================================

// Buscar todos os segmentos
export function useSegmentos(apenasAtivos = true) {
  return useQuery({
    queryKey: [...QUERY_KEY, 'list', { apenasAtivos }],
    queryFn: async () => {
      const { segmentos } = await ramoAtividadeService.getSegmentos(apenasAtivos);
      return segmentos;
    },
  });
}

// Buscar segmentos por ramo pai
export function useSegmentosPorRamo(ramoId: string | undefined, apenasAtivos = true) {
  return useQuery({
    queryKey: [...QUERY_KEY, 'por-ramo', ramoId, { apenasAtivos }],
    queryFn: async () => {
      if (!ramoId) return [];
      const { segmentos } = await ramoAtividadeService.getSegmentosPorRamo(ramoId, apenasAtivos);
      return segmentos;
    },
    enabled: !!ramoId,
  });
}

// Buscar segmentos completos (com dados do pai)
export function useSegmentosCompletos() {
  return useQuery({
    queryKey: [...QUERY_KEY, 'completos'],
    queryFn: async () => {
      const { segmentos, count } = await ramoAtividadeService.getSegmentosCompletos();

      // Agrupar por ramo
      const byRamo = new Map<string, SegmentoComplete[]>();
      segmentos.forEach((seg) => {
        const list = byRamo.get(seg.ramo_slug) ?? [];
        list.push(seg);
        byRamo.set(seg.ramo_slug, list);
      });

      return { segmentos, count, byRamo };
    },
  });
}

// Buscar segmento por ID
export function useSegmento(id: string | undefined) {
  return useQuery({
    queryKey: [...QUERY_KEY, id],
    queryFn: async () => {
      if (!id) return null;
      return ramoAtividadeService.getSegmentoById(id);
    },
    enabled: !!id,
  });
}

// ============================================================
// MUTATIONS
// ============================================================

// Criar segmento
export function useCreateSegmento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Partial<RamoAtividadeFilho>) => {
      return ramoAtividadeService.createSegmento(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['ramo-atividade'] });
      toast.success('Segmento criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar', { description: sanitizeError(error) });
    },
  });
}

// Atualizar segmento
export function useUpdateSegmento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<RamoAtividadeFilho> & { id: string }) => {
      return ramoAtividadeService.updateSegmento(id, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Segmento atualizado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar', { description: sanitizeError(error) });
    },
  });
}

// Deletar segmento
export function useDeleteSegmento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return ramoAtividadeService.deleteSegmento(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['ramo-atividade'] });
      toast.success('Segmento removido!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover', { description: sanitizeError(error) });
    },
  });
}

// Toggle ativo/inativo
export function useToggleSegmento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      return ramoAtividadeService.updateSegmento(id, { ativo });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success(`Segmento ${data.ativo ? 'ativado' : 'desativado'}!`);
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar', { description: sanitizeError(error) });
    },
  });
}
