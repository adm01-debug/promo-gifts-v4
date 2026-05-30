/**
 * Hook CRUD para Tecnicas de Gravacao.
 * SELECTs migrated to invokeExternalDb (2026-05-30).
 * WRITEs use bridge-compat shim with 410 graceful handling.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invokeExternalDb } from '@/lib/external-db';
import { invokeExternalDbBridge } from '@/lib/external-db/bridge-compat';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

export interface TecnicaGravacao {
  id: string;
  nome: string;
  codigo_curto?: string;
  descricao?: string;
  ativo?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

const QUERY_KEY = ['tecnicas-gravacao'] as const;

async function fetchTecnicas(): Promise<TecnicaGravacao[]> {
  const result = await invokeExternalDb<TecnicaGravacao>({
    table: 'tecnica_gravacao',
    operation: 'select',
    filters: { ativo: true },
    orderBy: { column: 'nome', ascending: true },
    limit: 200,
  });
  return result.records || [];
}

export function useTecnicasList() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchTecnicas,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useTecnicaCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<TecnicaGravacao>) => {
      const { data: resp, error } = await invokeExternalDbBridge({
        table: 'tecnica_gravacao',
        operation: 'insert',
        data,
      });
      if (error) throw new Error(error.message);
      if (!resp?.success) throw new Error(resp?.error || 'Erro ao criar tecnica');
      return resp;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Tecnica criada');
    },
    onError: (e) => toast.error((e as Error).message),
  });
}

export function useTecnicaUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<TecnicaGravacao> & { id: string }) => {
      const { data: resp, error } = await invokeExternalDbBridge({
        table: 'tecnica_gravacao',
        operation: 'update',
        id,
        data,
      });
      if (error) throw new Error(error.message);
      if (!resp?.success) throw new Error(resp?.error || 'Erro ao atualizar');
      return resp;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Tecnica atualizada');
    },
    onError: (e) => toast.error((e as Error).message),
  });
}
