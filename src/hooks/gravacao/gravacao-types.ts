/**
 * Tipos do Sistema de Gravação/Personalização v2
 * Extraído de useGravacaoV2.ts para modularidade
 */

/**
 * Técnica de gravação da tabela oficial
 * (tabela_preco_gravacao_oficial - 92 registros)
 */
export interface TabelaPrecoOficial {
  id: string;
  tecnica_variante_id: string | null;
  /** @deprecated use `codigo_curto` ou `codigo_tabela`. Gerado como alias de codigo_tabela. */
  codigo: string;
  /** Alias EN do `codigo`. Preenchido pelo adapter quando o back devolve nome novo. */
  code?: string | null;
  nome: string;
  /** Alias EN do `nome`. */
  name?: string | null;
  descricao: string | null;
  cobra_por_cor: boolean;
  /** Alias EN do `cobra_por_cor`. */
  charges_per_color?: boolean | null;
  max_cores: number | null;
  /** Alias EN do `max_cores`. */
  max_colors?: number | null;
  desconto_segunda_cor: number | null;
  desconto_terceira_cor: number | null;
  desconto_quarta_cor_mais: number | null;
  cobra_por_area: boolean;
  /** Alias EN do `cobra_por_area`. */
  price_by_area?: boolean | null;
  area_maxima_cm2: number | null;
  area_maxima_texto: string | null;
  cobra_por_pontos: boolean;
  /** Alias EN do `cobra_por_pontos`. */
  price_by_points?: boolean | null;
  max_pontos: number | null;
  custo_setup: number | null;
  /** Alias EN do `custo_setup`. */
  setup_price?: number | null;
  custo_setup_por_cor: boolean;
  /** Alias EN do `custo_setup_por_cor`. */
  setup_by_color?: boolean | null;
  tipo_setup?: string | null;
  custo_manuseio: number | null;
  /** Alias EN do `custo_manuseio`. */
  handling_price?: number | null;
  custo_manuseio_por_peca: boolean;
  custo_aplicacao: number | null;
  cobra_aplicacao: boolean;
  custo_queima_forno: number | null;
  cobra_queima_forno: boolean;
  custo_termo_transferencia: number | null;
  cobra_termo_transferencia: boolean;
  faturamento_minimo: number | null;
  /** @deprecated pode sumir do schema novo; use `min_quantity`. */
  quantidade_corte?: number | null;
  min_quantity?: number | null;
  /** @deprecated */
  validade_inicio?: string | null;
  /** @deprecated */
  validade_fim?: string | null;
  ativo: boolean;
  /** Alias EN do `ativo`. */
  active?: boolean | null;
  created_at: string;
  updated_at: string;

  // ── Campos do banco não declarados anteriormente (sincronizados 2026-06-23) ──
  /** Código curto único (ex: "FIBER-PL-01"). Chave canônica da técnica. */
  codigo_curto?: string | null;
  /** Markup percentual aplicado na cotação (ex: 115 = 115%). */
  markup_percent?: number | null;
  /** Preço mínimo unitário de venda em R$. A cotação nunca fica abaixo disso. */
  preco_minimo_unitario?: number | null;
  /** Preço máximo unitário de venda em R$. Teto de precificação. */
  preco_maximo_unitario?: number | null;
  /** Se true, faixas de preço são dimensionais (largura × altura cm). */
  usa_faixa_dimensional?: boolean | null;
  /** Modificadores de preço em JSONB (promoções, condições especiais). */
  opcoes_modificadores?: Record<string, unknown> | null;
  /** Opções de tonalidade/cor em JSONB (CMYK, Pantone, etc.). */
  tom_options?: Record<string, unknown> | null;
  /** Nome do grupo/categoria (alias gerado de grupo_tecnica). */
  nome_grupo?: string | null;
}

/**
 * Faixa de preço da tabela oficial
 * (tabela_preco_gravacao_oficial_faixa - 916 registros)
 */
export interface FaixaPrecoOficial {
  id: string;
  /** @deprecated use `price_table_id` */
  tabela_preco_gravacao_id: string;
  price_table_id?: string | null;
  /** @deprecated use `min_quantity` */
  quantidade_minima: number;
  min_quantity?: number | null;
  /** @deprecated use `max_quantity` */
  quantidade_maxima: number | null;
  max_quantity?: number | null;
  /** @deprecated use `unit_price` */
  preco_unitario: number;
  unit_price?: number | null;
  prazo_dias: number | null;
  production_days?: number | null;
  /** @deprecated use `display_order` */
  ordem: number;
  display_order?: number | null;
  // Faixas dimensionais
  largura_min?: number | null;
  largura_max?: number | null;
  altura_min?: number | null;
  altura_max?: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Retorno da função fn_get_customization_price v2 (2026-06-23)
 */
export interface CustomizationPriceV2 {
  success: boolean;
  area_id: string;
  area_code: string;
  area_name: string;
  area_order: number;
  tabela_id: string;
  tabela_codigo: string;
  tabela_codigo_curto: string;
  technique: string;
  codigo_orcamento: string;
  quantity: number;
  num_cores: number;
  tier_used: number;
  tier_min_qty: number;
  tier_max_qty: number;
  cost_base_unit: number;
  cost_unit_total: number;
  cost_setup: number;
  cost_total: number;
  markup_percent: number;
  preco_minimo_unitario: number;
  unit_price: number;
  subtotal_pecas: number;
  faturamento_minimo_gravacao: number;
  minimum_applied: boolean;
  total_price: number;
  margin_percent: number;
  price_by_color: boolean;
  setup_by_color: boolean;
  production_days: number | null;
  largura_max_tecnica: number | null;
  altura_max_tecnica: number | null;
}

/**
 * Área de gravação com técnicas
 */
export interface PrintAreaWithTechniques {
  area_id: string;
  area_code: string;
  area_name: string;
  max_width: number;
  max_height: number;
  shape: string;
  is_curved: boolean;
  is_primary: boolean;
  display_order: number;
  customization_price_table_id?: string | null;
  technique_id?: string | null;
  techniques: {
    id: string;
    nome: string;
    codigo: string;
  }[];
}
