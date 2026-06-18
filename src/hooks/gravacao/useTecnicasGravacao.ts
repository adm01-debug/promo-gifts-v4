// Hook CRUD para Tecnicas de Gravacao (via PostgREST nativo)
//
// FIX 2026-06-01 — 5 bugs corrigidos:
//
// BUG-TEC-01 + BUG-TEC-02 (useTecnicasGravacao lista):
//   ANTES: variantesResult buscava tabela_preco_gravacao_oficial novamente
//          tentando acessar v.tecnica_gravacao_id (campo inexistente)
//          → variantesCount sempre 0 para todas as técnicas
//   DEPOIS: busca tabela_preco_gravacao_oficial_faixa, agrupa por
//           tabela_preco_gravacao_id (FK real) → count correto por técnica
//
// BUG-TEC-03 (useTecnicaGravacao singular):
//   ANTES: variantesResult buscava tabela_preco_gravacao_oficial com
//          .order('ordem_exibicao') — coluna não existe → PostgREST 400
//   DEPOIS: busca tabela_preco_gravacao_oficial_faixa com
//           .eq('tabela_preco_gravacao_id', id).order('ordem') → correto
//
// BUG-TEC-04 (deleteMutation):
//   ANTES: verificava count da própria tabela (sempre ≥ 1 se ID existe)
//          bloco "if count > 0" vazio = dead code
//   DEPOIS: verifica faixas vinculadas em tabela_preco_gravacao_oficial_faixa
//           lança erro com mensagem clara se houver faixas
//
// BUG-TEC-05 (createMutation):
//   ANTES: insert com {slug} que não existe em tabela_preco_gravacao_oficial
//          → PostgREST 400 Bad Request
//   DEPOIS: slug removido do insert (campo não existe na tabela)

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { untypedFrom } from '@/lib/supabase-untyped';
import type {
  TecnicaGravacao,
  TecnicaGravacaoFormData,
  TecnicaGravacaoWithVariantes,
} from '@/types/gravacao-database';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';

const QUERY_KEY = 'tecnicas-gravacao';

export function useTecnicasGravacao() {
  const queryClient = useQueryClient();

  const tecnicasQuery = useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async (): Promise<TecnicaGravacaoWithVariantes[]> => {
      // FIX BUG-TEC-01: buscar faixas em paralelo com técnicas
      // antes buscava tpgo duas vezes (sem utilidade)
      const [tecnicasResult, faixasResult] = await Promise.all([
        untypedFrom('tabela_preco_gravacao_oficial').select('*').order('nome', { ascending: true }),
        untypedFrom('tabela_preco_gravacao_oficial_faixa').select('tabela_preco_gravacao_id'), // só o FK — evita baixar 884 rows completos
      ]);

      if (tecnicasResult.error) {
        const isGone =
          tecnicasResult.error.message?.includes('410') ||
          tecnicasResult.error.message?.includes('Gone');
        if (isGone) {
          const { reportSilentEmpty } = await import('@/lib/external-db/silent-empty-report');
          reportSilentEmpty({
            reason: 'gone_410',
            table: 'tabela_preco_gravacao_oficial',
            operation: 'select',
            message: tecnicasResult.error.message,
          });
          return [];
        }
        throw tecnicasResult.error;
      }

      // FIX BUG-TEC-02: agrupar faixas por tabela_preco_gravacao_id (FK correto)
      // antes tentava v.tecnica_gravacao_id que não existe → sempre 0
      const variantesCount: Record<string, number> = {};
      (faixasResult.data ?? []).forEach((f) => {
        const tid = (f as unknown as { tabela_preco_gravacao_id: string }).tabela_preco_gravacao_id;
        if (tid) {
          variantesCount[tid] = (variantesCount[tid] ?? 0) + 1;
        }
      });

      return (tecnicasResult.data ?? []).map((t) => {
        const row = t as TecnicaGravacao & { id: string };
        return {
          ...row,
          variantes: [],
          variantes_count: variantesCount[row.id] || 0,
        };
      });
    },
    staleTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: async (formData: TecnicaGravacaoFormData): Promise<TecnicaGravacao> => {
      // FIX BUG-TEC-05: removido {slug} do insert
      // tabela_preco_gravacao_oficial NÃO tem coluna 'slug'
      // (inserir campo inexistente → PostgREST 400)
      const { data, error } = await untypedFrom('tabela_preco_gravacao_oficial')
        .insert(formData)
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
      const { data, error } = await untypedFrom('tabela_preco_gravacao_oficial')
        .update(updates)
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
      // FIX BUG-TEC-04: verificar FAIXAS vinculadas antes de deletar
      // antes verificava count da própria tabela (dead code — sempre ≥ 1)
      const { count: faixasCount, error: faixasError } = await untypedFrom(
        'tabela_preco_gravacao_oficial_faixa',
      )
        .select('id', { count: 'exact', head: true })
        .eq('tabela_preco_gravacao_id', id);

      if (faixasError) throw faixasError;

      if ((faixasCount ?? 0) > 0) {
        throw new Error(
          `Não é possível excluir: há ${faixasCount} faixa(s) de preço vinculada(s). ` +
            `Remova as faixas antes de excluir a técnica.`,
        );
      }

      const { error } = await untypedFrom('tabela_preco_gravacao_oficial').delete().eq('id', id);
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
      const { error } = await untypedFrom('tabela_preco_gravacao_oficial')
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

      // FIX BUG-TEC-03: variantesResult busca FAIXAS (tpgo_faixa) em vez de tpgo
      // antes: .from('tpgo').eq('id',id).order('ordem_exibicao') — coluna inexistente → 400
      // depois: .from('tpgo_faixa').eq('tabela_preco_gravacao_id',id).order('ordem')
      const [tecnicaResult, faixasResult] = await Promise.all([
        untypedFrom('tabela_preco_gravacao_oficial').select('*').eq('id', id).single(),
        untypedFrom('tabela_preco_gravacao_oficial_faixa')
          .select('*')
          .eq('tabela_preco_gravacao_id', id)
          .order('ordem', { ascending: true }),
      ]);

      const tecnica = tecnicaResult.data;
      if (!tecnica) return null;

      // Graceful degradation: se faixas falhar, retorna técnica sem faixas
      const faixas = faixasResult.error ? [] : (faixasResult.data ?? []);

      return {
        ...tecnica,
        variantes: faixas as TecnicaGravacaoWithVariantes['variantes'],
        variantes_count: faixas.length,
      };
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}
