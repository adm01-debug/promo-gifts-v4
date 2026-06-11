/**
 * @deprecated Tabela `fornecedor_gravacao` não existe em pqpdolkaeqlyzpdpbizo.
 * Este hook retorna dados vazios. Funcionalidade removida na migração REST nativo (2026-05-31).
 * TODO: Remover este arquivo e a linha correspondente em hooks/gravacao/index.ts
 * quando nenhum componente importar.
 */
import type { FornecedorGravacao } from '@/types/gravacao-database';

export function useFornecedoresGravacao() {
  return {
    fornecedores: [] as FornecedorGravacao[],
    isLoading: false,
    isError: false,
    error: null,
    refetch: async () => {},
    create: async (_d: unknown) => ({}) as FornecedorGravacao,
    update: async (_d: unknown) => ({}) as FornecedorGravacao,
    delete: async (_id: unknown) => {},
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
  };
}
