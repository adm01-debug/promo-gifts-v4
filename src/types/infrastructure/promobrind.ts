/**
 * Infrastructure Types: Promobrind External Database
 *
 * Tipos RAW que representam exatamente a estrutura do BD externo Promobrind.
 * NÃO MODIFICAR sem atualizar transformers correspondentes.
 *
 * Tabelas:
 * - personalization_techniques
 * - customization_price_tables
 * - tecnica_gravacao (legacy)
 * - fornecedor_gravacao
 */

// ============================================
// PERSONALIZATION_TECHNIQUES (tabela principal)
// ============================================

export interface PersonalizationTechniqueRaw {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;

  // Cores
  requires_color_count: boolean;
  min_colors: number;
  max_colors: number;
  price_by_color: boolean;
  extra_color_price: number;

  // Área/Pontos
  price_by_area: boolean;
  price_by_stitches: boolean;
  min_area_cm2: number | null;
  max_area_cm2: number | null;
  max_stitches: number | null;

  // Custos
  setup_price: number;
  handling_price: number;
  base_cost_multiplier: number;

  // Produção
  min_quantity: number | null;
  estimated_days: number | null;

  // Características
  applies_to_curved: boolean;
  prompt_suffix: string | null;

  // Códigos externos
  supplier_code: string | null;
  stricker_code: string | null;

  // Status
  is_active: boolean;
  display_order: number;

  created_at: string;
  updated_at: string;
}

// ============================================
// CUSTOMIZATION_PRICE_TABLES (tabelas de preço)
// ============================================

export interface CustomizationPriceTableRaw {
  id: string;
  table_code: string;
  table_code_option: string;
  table_fullcode: string | null;
  serv_code: string | null;
  customization_type_name: string;
  technique_id: string | null;

  // Dimensões
  max_colors: number | null;
  max_area_width_cm: number | null;
  max_area_height_cm: number | null;
  area_min_cm2: number | null;
  area_max_cm2: number | null;
  colors: number | null;

  // Tipo cobrança
  price_by_color: boolean;
  price_by_area: boolean;
  price_by_stitches: boolean;

  // Custos
  setup_price: number;
  handling_price: number;

  // 15 faixas de quantidade
  min_qty_1: number;
  min_qty_2: number;
  min_qty_3: number;
  min_qty_4: number;
  min_qty_5: number;
  min_qty_6: number;
  min_qty_7: number;
  min_qty_8: number;
  min_qty_9: number;
  min_qty_10: number;
  min_qty_11: number;
  min_qty_12: number;
  min_qty_13: number;
  min_qty_14: number;
  min_qty_15: number;

  // 15 faixas de preço
  price_1: number;
  price_2: number;
  price_3: number;
  price_4: number;
  price_5: number;
  price_6: number;
  price_7: number;
  price_8: number;
  price_9: number;
  price_10: number;
  price_11: number;
  price_12: number;
  price_13: number;
  price_14: number;
  price_15: number;

  // 15 faixas de SLA
  sla_1: number | null;
  sla_2: number | null;
  sla_3: number | null;
  sla_4: number | null;
  sla_5: number | null;
  sla_6: number | null;
  sla_7: number | null;
  sla_8: number | null;
  sla_9: number | null;
  sla_10: number | null;
  sla_11: number | null;
  sla_12: number | null;
  sla_13: number | null;
  sla_14: number | null;
  sla_15: number | null;

  // Metadados
  supplier_id: string | null;
  supplier_technique_code: string | null;
  stricker_table_code: string | null;
  organization_id: string | null;
  source: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// TECNICA_GRAVACAO (legacy - manter compatibilidade)
// ============================================

export type TipoSetup = 'nenhum' | 'fotolito' | 'cliche' | 'matriz' | 'arte_digital';
export type FormatoVariante = 'plana' | 'cilindrica' | 'textil' | 'patch';
export type TipoIntegracao = 'api_spot' | 'api_rest' | 'manual';

export interface TecnicaGravacaoRaw {
  id: string;
  codigo: string;
  codigo_interno: string;
  nome: string;
  slug: string;
  descricao: string | null;
  permite_cores: boolean;
  max_cores: number;
  cobra_por_cor: boolean;
  cobra_por_area: boolean;
  cobra_por_pontos: boolean;
  requer_setup: boolean;
  tipo_setup: TipoSetup;
  tempo_producao_dias: number;
  ordem_exibicao: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface TecnicaGravacaoVarianteRaw {
  id: string;
  tecnica_gravacao_id: string;
  codigo: string;
  codigo_interno: string;
  nome: string;
  slug: string;
  descricao: string | null;
  formato: FormatoVariante;
  permite_cores: boolean;
  max_cores: number;
  cobra_por_cor: boolean;
  produtos_tipicos: string[];
  ordem_exibicao: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// FORNECEDOR_GRAVACAO
// ============================================

export interface FornecedorGravacaoRaw {
  id: string;
  codigo: string;
  nome: string;
  nome_curto: string;
  tipo_integracao: TipoIntegracao;
  api_endpoint: string | null;
  api_access_key: string | null;
  api_ativo: boolean;
  contato_nome: string | null;
  contato_telefone: string | null;
  contato_email: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// FAIXAS AUXILIARES
// ============================================

export interface TecnicaFaixaAreaRaw {
  id: string;
  tecnica_gravacao_id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  area_minima_cm2: number | null;
  area_maxima_cm2: number | null;
  multiplicador_preco: number;
  valor_adicional_peca: number;
  ordem_exibicao: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface TecnicaFaixaPontosRaw {
  id: string;
  tecnica_gravacao_id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  pontos_minimo: number | null;
  pontos_maximo: number | null;
  area_tipica_cm2: number | null;
  multiplicador_preco: number;
  ordem_exibicao: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// OPÇÕES AUXILIARES
// ============================================

export interface HotStampingFitaOpcaoRaw {
  id: string;
  codigo: string;
  nome: string;
  cor_hex: string | null;
  tipo: 'metalico' | 'holografico' | 'fosco';
  multiplicador_preco: number;
  ordem_exibicao: number;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface LaserAcabamentoOpcaoRaw {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  multiplicador_preco: number;
  ordem_exibicao: number;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TecnicaTipoFilmeRaw {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  multiplicador_preco: number;
  ordem_exibicao: number;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}
