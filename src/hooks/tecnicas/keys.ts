/**
 * Query Keys Centralizadas - Técnicas e Tabelas de Preço
 *
 * Single Source of Truth para todas as query keys do módulo
 */

export const TECNICAS_QUERY_KEYS = {
  all: ['tecnicas-unificadas'] as const,
  lista: () => [...TECNICAS_QUERY_KEYS.all, 'lista'] as const,
  resumo: () => [...TECNICAS_QUERY_KEYS.all, 'resumo'] as const,
  detalhe: (id: string) => [...TECNICAS_QUERY_KEYS.all, 'detalhe', id] as const,
  porCodigo: (codigo: string) => [...TECNICAS_QUERY_KEYS.all, 'codigo', codigo] as const,
  categorias: () => [...TECNICAS_QUERY_KEYS.all, 'categorias'] as const,
  // Tabelas de preço
  tabelasPreco: () => [...TECNICAS_QUERY_KEYS.all, 'tabelas-preco'] as const,
  tabelaPorCodigo: (codigo: string) => [...TECNICAS_QUERY_KEYS.all, 'tabela', codigo] as const,
  tabelasPorTecnica: (nomeTecnica: string) =>
    [...TECNICAS_QUERY_KEYS.all, 'tabelas-tecnica', nomeTecnica] as const,
  nomesTecnicas: () => [...TECNICAS_QUERY_KEYS.all, 'nomes-tecnicas'] as const,
};
