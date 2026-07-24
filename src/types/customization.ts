/**
 * Tipos para o fluxo de personalização v6
 *
 * Baseado no briefing técnico de 12/02/2026.
 * Fonte de dados: RPCs fn_get_product_customization_options e fn_get_customization_price.
 */

// ============================================
// OPÇÕES DE PERSONALIZAÇÃO (fn_get_product_customization_options)
// ============================================

/** Opção de técnica retornada pela RPC */
export interface TechniqueOption {
  technique_id: string;
  codigo_tabela: string; // "FIBER-PL-01"
  tecnica_nome: string; // "Fiber Laser | Plana"
  grupo_tecnica: string; // "LASER" | "SERIGRAFIA" | "UV_DIGITAL"
  variacao_label: string;

  // Dimensões
  max_width: number; // largura da área física (cm)
  max_height: number; // altura da área física (cm)
  gravacao_largura_max: number | null;
  gravacao_altura_max: number | null;
  efetiva_largura_max: number; // MIN(max_width, gravacao_largura_max)
  efetiva_altura_max: number; // MIN(max_height, gravacao_altura_max)

  // Forma
  shape: 'circle' | 'rectangle';
  is_curved: boolean;

  // Cores e preço
  usa_dimensao: boolean;
  cobra_por_cor: boolean;
  max_cores: number; // máximo de cores (1-3)
}

/** Local de gravação */
export interface GravacaoLocation {
  location_code: string; // "LADO-A" | "LADO-B" | "CIRCULAR"
  location_name: string; // "Lado A" | "Lado B" | "Circular"
  location_order: number;
  options: TechniqueOption[];
}

/** Resposta de fn_get_product_customization_options */
export interface CustomizationOptionsResponse {
  product_id: string;
  locations: GravacaoLocation[];
}

// ============================================
// PREÇO DE PERSONALIZAÇÃO (fn_get_customization_price)
// ============================================
//
// Os tipos abaixo refletem o contrato declarado em
// `src/lib/personalization/rpc-contracts.ts` (`PRICE_CONTRACT`):
//   - Campos do bloco `requiredFields` → obrigatórios.
//   - Campos do bloco `optionalFields` → opcionais.
//   - Aliases EN (futuros) entram como propriedades opcionais para que o
//     mesmo objeto possa ser consumido antes/depois da migração de schema
//     no back. O adapter (`adaptPriceResponse`) garante que os nomes PT
//     canônicos sempre estejam preenchidos.

/**
 * Faixa de preço encontrada (RPC `fn_get_customization_price` → `faixa`).
 *
 * `qtd_min`/`qtd_max` são exigidos pelo contrato. `faixa_id`, `preco` e
 * `prazo_dias` são opcionais (nem todo formato retorna). Limites de
 * largura/altura só aparecem em técnicas que cobram por dimensão.
 */
export interface PriceFaixa {
  qtd_min: number;
  qtd_max: number;

  faixa_id?: string;
  preco?: number;
  prazo_dias?: number | null;

  larg_min?: number;
  larg_max?: number;
  alt_min?: number;
  alt_max?: number;

  // Aliases EN (forward-compat — vide PRICE_CONTRACT.aliasMap)
  min_qty?: number;
  max_qty?: number;
  production_days?: number | null;
}

/**
 * Detalhes da técnica no preço (RPC `fn_get_customization_price` → `detalhes`).
 *
 * `cobra_por_cor` e `max_cores` são exigidos pelo contrato. Os descontos
 * por cor extra e o flag `is_curved` são opcionais.
 */
export interface PriceDetalhes {
  cobra_por_cor: boolean;
  max_cores: number;

  is_curved?: boolean;
  desconto_2cor?: number; // % desconto para 2ª cor (ex: 10)
  desconto_3cor?: number; // % desconto para 3ª cor (ex: 15)
  desconto_4cor_plus?: number; // % desconto para 4ª cor+ (quando informado)

  // Aliases EN (forward-compat)
  charges_per_color?: boolean;
  max_colors?: number;
}

/**
 * Informações de markup (RPC `fn_get_customization_price` → `markup`,
 * introduzido na v6.3). Bloco inteiro é opcional no contrato; quando
 * presente, `markup_pct` e os custos base devem vir.
 */
export interface MarkupInfo {
  markup_pct: number; // % markup aplicado (ex: 115)
  preco_min_unit: number; // piso mínimo por unidade (R$)
  custo_unitario: number; // custo ANTES do markup
  custo_setup_tabela: number; // setup original da tabela
  setup_proprio: number | null; // setup da organização (prevalece)

  // Aliases EN (forward-compat)
  markup_percent?: number;
  unit_cost?: number;
  setup_cost_table?: number;
}

/**
 * Resposta de `fn_get_customization_price` (v6.3).
 *
 * Apenas `success` é sempre garantido. Em caso de erro, `error` vem
 * preenchido e os demais campos podem estar ausentes — por isso são
 * opcionais. O adapter (`adaptPriceResponse`) normaliza tudo para o tipo
 * canônico `CustomizationPriceFlat` antes de chegar nos consumidores.
 */
export interface CustomizationPriceResponseV6 {
  success: boolean;
  error?: string;

  // Identificação da tabela / técnica
  tabela?: string; // "FIBER-PL-01"
  nome_tabela?: string; // "Fiber Laser | Plana"
  grupo_tecnica?: string; // "LASER"

  // Parâmetros ecoados
  quantidade?: number;
  num_cores?: number;

  // Blocos de detalhamento
  faixa?: PriceFaixa;
  detalhes?: PriceDetalhes;
  markup?: MarkupInfo; // (v6.3) info de markup aplicado

  // Totais (em PT — canônicos)
  preco_unitario?: number; // preço de VENDA por peça (com markup)
  preco_por_unidade?: number; // alias
  valor_gravacao?: number; // preco_unitario × qtd
  setup_total?: number; // setup com markup aplicado
  total_cobrado?: number; // MAX(valor_gravacao, setup_total)

  // Auditoria / redirecionamento de área
  codigo_orcamento?: string;
  redirected_from?: string;
  redirected_to?: string;

  // Aliases EN (forward-compat — vide PRICE_CONTRACT.aliasMap)
  table_code?: string;
  table_name?: string;
  technique_group?: string;
  quantity?: number;
  num_colors?: number;
  unit_price?: number;
  unit_price_per_piece?: number;
  subtotal_pieces?: number;
  setup_total_value?: number;
  total_charged?: number;
}

// ============================================
// ITEM DE PERSONALIZAÇÃO (estado do componente)
// ============================================

export interface PersonalizationItem {
  locationCode: string;
  locationName: string;
  techniqueId: string;
  techniqueName: string;
  codigoTabela: string;
  grupoTecnica: string;
  width?: number;
  height?: number;
  numberOfColors: number;
  usaDimensao: boolean;
  price: CustomizationPriceResponseV6 | null;
}
