/**
 * Domain Types: Personalização
 *
 * SSOT interno - Tipos de domínio puros, independentes de infraestrutura.
 * Usados pela camada de serviços e regras de negócio.
 */

// ============================================
// TÉCNICA DE PERSONALIZAÇÃO (Domínio)
// ============================================

/**
 * Técnica de personalização unificada
 * SSOT: Transformado a partir de PersonalizationTechniqueRaw
 */
export interface Technique {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: TechniqueCategory;
  icon: string | null;

  // Configuração de cores
  colorConfig: {
    required: boolean;
    min: number;
    max: number;
    priceByColor: boolean;
    extraColorPrice: number;
  };

  // Configuração de área/pontos
  areaConfig: {
    priceByArea: boolean;
    priceByStitches: boolean;
    minAreaCm2: number | null;
    maxAreaCm2: number | null;
    maxStitches: number | null;
  };

  // Custos base
  costs: {
    setup: number;
    handling: number;
    multiplier: number;
  };

  // Características
  appliesToCurved: boolean;
  promptSuffix: string | null;

  // Códigos externos (para integração)
  externalCodes: {
    supplier: string | null;
    stricker: string | null;
  };

  // Status
  isActive: boolean;
  displayOrder: number;

  // Metadados
  createdAt: Date;
  updatedAt: Date;
}

export type TechniqueCategory =
  | 'digital'
  | 'engraving'
  | 'impression'
  | 'other'
  | 'textile'
  | 'transfer';

/**
 * Resumo de técnica para listas e seletores
 */
export interface TechniqueSummary {
  id: string;
  code: string;
  name: string;
  category: TechniqueCategory;
  colorRequired: boolean;
  maxColors: number;
  priceByColor: boolean;
  priceByArea: boolean;
  isActive: boolean;
}

// ============================================
// TABELA DE PREÇOS (Domínio)
// ============================================

/**
 * Tabela de preços normalizada
 * SSOT: Transformado a partir de CustomizationPriceTableRaw
 */
export interface PriceTable {
  id: string;

  // Identificação
  code: string;
  codeOption: string;
  fullCode: string | null;
  serviceCode: string | null;
  techniqueName: string;
  techniqueId: string | null;

  // Limites
  limits: {
    maxColors: number | null;
    maxWidthCm: number | null;
    maxHeightCm: number | null;
    minAreaCm2: number | null;
    maxAreaCm2: number | null;
  };

  // Tipo de precificação
  pricing: {
    byColor: boolean;
    byArea: boolean;
    byStitches: boolean;
  };

  // Custos fixos
  fixedCosts: {
    setup: number;
    handling: number;
  };

  // Faixas de quantidade
  tiers: PriceTier[];

  // Metadados
  supplierId: string | null;
  source: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Faixa de preço por quantidade
 */
export interface PriceTier {
  tier: number; // 1-15
  minQuantity: number;
  maxQuantity: number | null;
  unitPrice: number;
  slaDays: number | null;
}

// ============================================
// CÁLCULO DE PREÇO (Domínio)
// ============================================

/**
 * Parâmetros para cálculo de preço
 */
export interface PriceCalculationParams {
  quantity: number;
  colors?: number;
  widthCm?: number;
  heightCm?: number;
  areaCm2?: number;
}

/**
 * Resultado do cálculo de preço v5.1
 *
 * LÓGICA v5.1:
 * - Setup = CUSTO do faturamento mínimo (não é somado ao total!)
 * - faturamento_minimo = custo_setup × (1 + markup%)
 * - Se subtotal_pecas < faturamento_minimo → Total = faturamento_minimo
 * - Se subtotal_pecas >= faturamento_minimo → Total = subtotal_pecas
 */
export interface PriceCalculationResult {
  tableId: string;
  tableCode: string;
  tableCodeShort?: string; // Código curto (ex: FB, ST, TP)
  techniqueName: string;

  // Código de orçamento v5.1
  quoteCode?: string; // Formato: {TECNICA_CURTO}01-{FAIXA}-{AREA}-{CORES}

  // Quantidade e faixa
  quantity: number;
  tierUsed: number;
  tierMinQty?: number;
  tierMaxQty?: number;

  // CUSTOS (base, sem markup)
  costBaseUnit?: number; // Preço unitário base da faixa
  costUnitTotal?: number; // Custo unitário ajustado (com cores)
  costSetup?: number; // Custo do setup
  costTotal?: number; // Custo total das peças

  // MARKUP
  markupPercent?: number; // % de markup aplicado (ex: 115)
  minUnitPrice?: number; // Preço mínimo por unidade

  // PREÇOS FINAIS (com markup)
  unitPrice: number;
  subtotal: number;
  setupPrice: number;
  handlingPrice: number;

  // Faturamento mínimo v5.1
  minimumInvoice?: number; // faturamento_minimo_gravacao
  minimumApplied?: boolean; // Se o mínimo foi aplicado

  grandTotal: number;

  // MARGEM
  marginPercent?: number; // Margem de lucro em %

  // Economia
  savings?: {
    perUnit: number;
    total: number;
    percentOff: number;
  };

  // Prazo
  slaDays: number | null;

  // Limites aplicados
  maxColors: number | null;
  maxArea: PrintArea | null;
}

/**
 * Dimensões de área de gravação
 */
export interface PrintArea {
  widthCm: number;
  heightCm: number;
  areaCm2: number;
}

// ============================================
// OPÇÕES DE CONFIGURAÇÃO (Domínio)
// ============================================

/**
 * Opção de cor disponível
 */
export interface ColorOption {
  value: number;
  label: string;
}

/**
 * Opção de tamanho disponível
 */
export interface SizeOption {
  label: string;
  value: string;
  width: number;
  height: number;
  areaCm2: number;
  priceModifier: number;
}

// ============================================
// VALIDAÇÃO (Domínio)
// ============================================

/**
 * Resultado de validação
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  field: string;
  message: string;
}

export interface ValidationWarning {
  code: string;
  field: string;
  message: string;
}

// ============================================
// SELEÇÃO DE TABELA (Domínio)
// ============================================

/**
 * Critérios para seleção de tabela de preço
 */
export interface TableSelectionCriteria {
  techniqueName?: string;
  techniqueCode?: string;
  colors?: number;
  widthCm?: number;
  heightCm?: number;
  quantity?: number;
}

// ============================================
// FILTROS (Domínio)
// ============================================

/**
 * Filtros para busca de técnicas
 */
export interface TechniqueFilters {
  onlyActive?: boolean;
  category?: TechniqueCategory;
  colorRequired?: boolean;
  priceByArea?: boolean;
  priceByStitches?: boolean;
  appliesToCurved?: boolean;
  search?: string;
}

/**
 * Filtros para busca de tabelas de preço
 */
export interface PriceTableFilters {
  onlyActive?: boolean;
  techniqueId?: string;
  tableCode?: string;
  techniqueName?: string;
  maxColors?: number;
}
