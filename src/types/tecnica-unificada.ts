/**
 * Types: Técnica Unificada
 *
 * Tipos para técnicas de personalização/gravação.
 * SSOT: BD Externo (Promobrind) é o master.
 *
 * Este arquivo exporta tipos em português para compatibilidade
 * com o código existente.
 */

// Re-export dos tipos de infraestrutura (Promobrind)
export type { PersonalizationTechniqueRaw, CustomizationPriceTableRaw } from './infrastructure';

// ============================================
// TIPOS PORTUGUESE (para compatibilidade)
// ============================================

/**
 * Interface unificada para técnicas de personalização
 * Baseado em personalization_techniques do BD externo
 */
export interface TecnicaUnificada {
  // === Identificação ===
  id: string;
  codigo: string;
  codigoFornecedor: string | null;
  codigoStricker: string | null;
  nome: string;
  descricao: string | null;
  categoria: string;
  icone: string | null;

  // === Configuração de Cores ===
  permiteCores: boolean;
  minCores: number;
  maxCores: number;
  precoPorCor: boolean;
  precoCorExtra: number;

  // === Configuração de Cobrança ===
  precoPorArea: boolean;
  precoPorPontos: boolean;
  areaMinimaCm2: number | null;
  areaMaximaCm2: number | null;
  pontosMaximos: number | null;

  // === Custos Base ===
  custoSetup: number;
  custoManuseio: number;
  multiplicadorCusto: number;

  // === Produção ===
  quantidadeMinima: number | null;
  prazoEstimado: number | null;

  // === Características ===
  aplicaSuperficieCurva: boolean;
  promptSuffix: string | null;

  // === Status ===
  ativo: boolean;
  ordemExibicao: number;

  // === Metadados ===
  fonte: 'externo';
  criadoEm: string;
  atualizadoEm: string;
}

/**
 * Tabela de preços por técnica
 * Baseado em customization_price_tables do BD externo
 */
export interface TabelaPrecoTecnica {
  id: string;

  // === Identificação ===
  codigoTabela: string;
  codigoTabelaOpcao: string;
  codigoServico: string | null;
  nomeTecnica: string;
  tecnicaId: string | null;

  // === Dimensões ===
  maxCores: number | null;
  larguraMaxCm: number | null;
  alturaMaxCm: number | null;
  areaMinCm2: number | null;
  areaMaxCm2: number | null;

  // === Tipo de Cobrança ===
  precoPorCor: boolean;
  precoPorArea: boolean;
  precoPorPontos: boolean;

  // === Custos Base ===
  precoSetup: number;
  precoManuseio: number;

  // === Faixas de Quantidade (15 faixas) ===
  faixas: FaixaQuantidade[];

  // === Metadados ===
  fornecedorId: string | null;
  organizacaoId: string | null;
  fonte: string | null;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

/**
 * Faixa de quantidade com preço e SLA
 */
export interface FaixaQuantidade {
  faixa: number; // 1-15
  quantidadeMinima: number;
  precoUnitario: number;
  slaDias: number | null;
}

/**
 * Resumo simplificado para dropdowns e seletores
 */
export interface TecnicaResumo {
  id: string;
  codigo: string;
  nome: string;
  categoria: string;
  permiteCores: boolean;
  maxCores: number;
  precoPorCor: boolean;
  precoPorArea: boolean;
  ativo: boolean;
}

/**
 * Filtros para busca de técnicas
 */
export interface TecnicaFiltros {
  apenasAtivas?: boolean;
  categoria?: string;
  permiteCores?: boolean;
  precoPorArea?: boolean;
  precoPorPontos?: boolean;
  aplicaCurva?: boolean;
  busca?: string;
}

/**
 * Filtros para busca de tabelas de preço
 */
export interface TabelaPrecoFiltros {
  apenasAtivas?: boolean;
  tecnicaId?: string;
  codigoTabela?: string;
  nomeTecnica?: string;
  maxCores?: number;
}

/**
 * Resultado de cálculo de preço
 */
export interface ResultadoCalculoPreco {
  tabelaId: string;
  codigoTabela: string;
  quantidade: number;
  faixaUtilizada: number;
  precoUnitario: number;
  precoTotal: number;
  precoSetup: number;
  precoManuseio: number;
  slaDias: number | null;
}
