/**
 * @deprecated Tabela `tecnica_gravacao_variante` não existe em doufsxqlfjyuvxuezpln.
 * Fase 2 adicionou alias → tabela_preco_gravacao_oficial, mas nenhum componente usa este hook.
 * TODO: Remover este arquivo e a linha correspondente em hooks/gravacao/index.ts.
 */
import type { TecnicaGravacaoVariante } from '@/types/gravacao-database';

export function useVariantesGravacao(_tecnicaId?: string) {
  return {
    variantes: [] as TecnicaGravacaoVariante[],
    isLoading: false,
    isError: false,
    error: null,
    refetch: async () => {},
    create: async (_d: unknown) => ({}) as TecnicaGravacaoVariante,
    update: async (_d: unknown) => ({}) as TecnicaGravacaoVariante,
    delete: async (_id: unknown) => {},
    toggleStatus: (_d: unknown) => {},
    reorder: async (_ids: unknown) => {},
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
    isReordering: false,
  };
}
