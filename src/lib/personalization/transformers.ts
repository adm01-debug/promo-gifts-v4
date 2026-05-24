/**
 * Domain Transformers: Personalização
 *
 * Funções puras para transformação entre formatos de dados.
 * Converte entre tipos de infraestrutura (API/DB) e tipos de domínio.
 *
 * SSOT: Este módulo é a única fonte de transformadores de dados.
 * Hooks devem importar daqui, não definir transformadores próprios.
 */

import type { PriceTableInput, TechniqueInput, PriceTier } from './types';

import type {
  TabelaPrecoTecnica,
  TecnicaUnificada,
  FaixaQuantidade,
  CustomizationPriceTableRaw,
  PersonalizationTechniqueRaw,
} from '@/types/tecnica-unificada';

// ============================================
// RAW DB â†’ PORTUGUESE DOMAIN TYPES (para hooks)
// ============================================

/**
 * Transforma PersonalizationTechniqueRaw (DB) para TecnicaUnificada
 * Usado pelos hooks para transformar dados vindos do BD externo
 */
export function rawToTecnicaUnificada(raw: PersonalizationTechniqueRaw): TecnicaUnificada {
  return {
    id: raw.id,
    codigo: raw.code,
    codigoFornecedor: raw.supplier_code,
    codigoStricker: raw.stricker_code,
    nome: raw.name,
    descricao: raw.description,
    categoria: raw.category,
    icone: raw.icon,
    permiteCores: raw.requires_color_count,
    minCores: raw.min_colors,
    maxCores: raw.max_colors,
    precoPorCor: raw.price_by_color,
    precoCorExtra: raw.extra_color_price,
    precoPorArea: raw.price_by_area,
    precoPorPontos: raw.price_by_stitches,
    areaMinimaCm2: raw.min_area_cm2,
    areaMaximaCm2: raw.max_area_cm2,
    pontosMaximos: raw.max_stitches,
    custoSetup: raw.setup_price,
    custoManuseio: raw.handling_price,
    multiplicadorCusto: raw.base_cost_multiplier,
    quantidadeMinima: raw.min_quantity,
    prazoEstimado: raw.estimated_days,
    aplicaSuperficieCurva: raw.applies_to_curved,
    promptSuffix: raw.prompt_suffix,
    ativo: raw.is_active,
    ordemExibicao: raw.display_order,
    fonte: 'externo',
    criadoEm: raw.created_at,
    atualizadoEm: raw.updated_at,
  };
}

/**
 * Transforma CustomizationPriceTableRaw (DB) para TabelaPrecoTecnica
 * Usado pelos hooks para transformar dados vindos do BD externo
 */
export function rawToTabelaPrecoTecnica(raw: CustomizationPriceTableRaw): TabelaPrecoTecnica {
  // Extrair as 15 faixas
  const faixas: FaixaQuantidade[] = [];
  for (let i = 1; i <= 15; i++) {
    const minQty = raw[`min_qty_${i}` as keyof CustomizationPriceTableRaw] as number;
    const price = raw[`price_${i}` as keyof CustomizationPriceTableRaw] as number;
    const sla = raw[`sla_${i}` as keyof CustomizationPriceTableRaw] as number | null;

    if (minQty !== null && price !== null) {
      faixas.push({
        faixa: i,
        quantidadeMinima: minQty,
        precoUnitario: price,
        slaDias: sla,
      });
    }
  }

  return {
    id: raw.id,
    codigoTabela: raw.table_code,
    codigoTabelaOpcao: raw.table_code_option,
    codigoServico: raw.serv_code,
    nomeTecnica: raw.customization_type_name,
    tecnicaId: raw.technique_id,
    maxCores: raw.max_colors,
    larguraMaxCm: raw.max_area_width_cm,
    alturaMaxCm: raw.max_area_height_cm,
    areaMinCm2: raw.area_min_cm2,
    areaMaxCm2: raw.area_max_cm2,
    precoPorCor: raw.price_by_color,
    precoPorArea: raw.price_by_area,
    precoPorPontos: raw.price_by_stitches,
    precoSetup: raw.setup_price,
    precoManuseio: raw.handling_price,
    faixas,
    fornecedorId: raw.supplier_id,
    organizacaoId: raw.organization_id,
    fonte: raw.source,
    ativo: raw.is_active,
    criadoEm: raw.created_at,
    atualizadoEm: raw.updated_at,
  };
}

/**
 * Batch: Transforma array de técnicas raw
 */
export function transformRawToTecnicas(raws: PersonalizationTechniqueRaw[]): TecnicaUnificada[] {
  return raws.map(rawToTecnicaUnificada);
}

/**
 * Batch: Transforma array de tabelas raw
 */
export function transformRawToTabelas(raws: CustomizationPriceTableRaw[]): TabelaPrecoTecnica[] {
  return raws.map(rawToTabelaPrecoTecnica);
}

// ============================================
// FROM INFRASTRUCTURE TO DOMAIN
// ============================================

/**
 * Transforma TabelaPrecoTecnica (hook) para PriceTableInput (domain)
 */
export function tabelaToPriceTableInput(tabela: TabelaPrecoTecnica): PriceTableInput {
  return {
    id: tabela.id,
    tableCode: tabela.codigoTabela,
    tableCodeOption: tabela.codigoTabelaOpcao,
    techniqueName: tabela.nomeTecnica,

    maxColors: tabela.maxCores,
    maxWidthCm: tabela.larguraMaxCm,
    maxHeightCm: tabela.alturaMaxCm,
    minAreaCm2: tabela.areaMinCm2,
    maxAreaCm2: tabela.areaMaxCm2,

    priceByColor: tabela.precoPorCor,
    priceByArea: tabela.precoPorArea,
    priceByStitches: tabela.precoPorPontos,

    setupPrice: tabela.precoSetup,
    handlingPrice: tabela.precoManuseio,

    tiers: tabela.faixas.map(faixaToPriceTier),

    isActive: tabela.ativo,
  };
}

/**
 * Transforma FaixaQuantidade para PriceTier
 */
export function faixaToPriceTier(
  faixa: FaixaQuantidade,
  index?: number,
  arr?: FaixaQuantidade[],
): PriceTier {
  const nextFaixa = arr && index !== undefined ? arr[index + 1] : undefined;

  return {
    tier: faixa.faixa,
    minQuantity: faixa.quantidadeMinima,
    maxQuantity: nextFaixa ? nextFaixa.quantidadeMinima - 1 : null,
    unitPrice: faixa.precoUnitario,
    slaDays: faixa.slaDias,
  };
}

/**
 * Transforma TecnicaUnificada para TechniqueInput
 */
export function tecnicaToTechniqueInput(tecnica: TecnicaUnificada): TechniqueInput {
  return {
    id: tecnica.id,
    code: tecnica.codigo,
    name: tecnica.nome,
    category: tecnica.categoria,

    requiresColors: tecnica.permiteCores,
    minColors: tecnica.minCores,
    maxColors: tecnica.maxCores,
    priceByColor: tecnica.precoPorCor,
    extraColorPrice: tecnica.precoCorExtra,

    priceByArea: tecnica.precoPorArea,
    priceByStitches: tecnica.precoPorPontos,
    minAreaCm2: tecnica.areaMinimaCm2,
    maxAreaCm2: tecnica.areaMaximaCm2,

    setupPrice: tecnica.custoSetup,
    handlingPrice: tecnica.custoManuseio,
    costMultiplier: tecnica.multiplicadorCusto,

    appliesToCurved: tecnica.aplicaSuperficieCurva,

    isActive: tecnica.ativo,
  };
}

// ============================================
// FROM RAW DB TO DOMAIN
// ============================================

/**
 * Transforma CustomizationPriceTableRaw (DB) para PriceTableInput (domain)
 */
export function rawTableToPriceTableInput(raw: CustomizationPriceTableRaw): PriceTableInput {
  const tiers = extractTiersFromRaw(raw);

  return {
    id: raw.id,
    tableCode: raw.table_code,
    tableCodeOption: raw.table_code_option,
    techniqueName: raw.customization_type_name,

    maxColors: raw.max_colors,
    maxWidthCm: raw.max_area_width_cm,
    maxHeightCm: raw.max_area_height_cm,
    minAreaCm2: raw.area_min_cm2,
    maxAreaCm2: raw.area_max_cm2,

    priceByColor: raw.price_by_color,
    priceByArea: raw.price_by_area,
    priceByStitches: raw.price_by_stitches,

    setupPrice: raw.setup_price,
    handlingPrice: raw.handling_price,

    tiers,

    isActive: raw.is_active,
  };
}

/**
 * Extrai faixas de preço do formato raw
 */
function extractTiersFromRaw(raw: CustomizationPriceTableRaw): PriceTier[] {
  const tiers: PriceTier[] = [];

  for (let i = 1; i <= 15; i++) {
    const minQty = raw[`min_qty_${i}` as keyof CustomizationPriceTableRaw] as number;
    const price = raw[`price_${i}` as keyof CustomizationPriceTableRaw] as number;
    const sla = raw[`sla_${i}` as keyof CustomizationPriceTableRaw] as number | null;

    if (minQty !== null && price !== null) {
      const nextMinQty = raw[`min_qty_${i + 1}` as keyof CustomizationPriceTableRaw] as
        | number
        | undefined;

      tiers.push({
        tier: i,
        minQuantity: minQty,
        maxQuantity: nextMinQty ? nextMinQty - 1 : null,
        unitPrice: price,
        slaDays: sla ?? null,
      });
    }
  }

  return tiers;
}

/**
 * Transforma PersonalizationTechniqueRaw (DB) para TechniqueInput (domain)
 */
export function rawTechniqueToTechniqueInput(raw: PersonalizationTechniqueRaw): TechniqueInput {
  return {
    id: raw.id,
    code: raw.code,
    name: raw.name,
    category: raw.category,

    requiresColors: raw.requires_color_count,
    minColors: raw.min_colors,
    maxColors: raw.max_colors,
    priceByColor: raw.price_by_color,
    extraColorPrice: raw.extra_color_price,

    priceByArea: raw.price_by_area,
    priceByStitches: raw.price_by_stitches,
    minAreaCm2: raw.min_area_cm2,
    maxAreaCm2: raw.max_area_cm2,

    setupPrice: raw.setup_price,
    handlingPrice: raw.handling_price,
    costMultiplier: raw.base_cost_multiplier,

    appliesToCurved: raw.applies_to_curved,

    isActive: raw.is_active,
  };
}

// ============================================
// FROM DOMAIN TO DISPLAY
// ============================================

/**
 * Formata preço para exibição
 */
export function formatPrice(value: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(value);
}

/**
 * Formata área para exibição
 */
export function formatArea(widthCm: number, heightCm: number): string {
  return `${widthCm} x ${heightCm} cm`;
}

/**
 * Formata SLA para exibição
 */
export function formatSla(days: number | null): string {
  if (days === null) return 'A consultar';
  if (days === 0) return 'Pronta entrega';
  if (days === 1) return '1 dia útil';
  return `${days} dias úteis`;
}

/**
 * Formata economia para exibição
 */
export function formatSavings(percentOff: number): string {
  if (percentOff <= 0) return '';
  return `${percentOff}% de economia`;
}

// ============================================
// BATCH TRANSFORMATIONS
// ============================================

/**
 * Transforma array de tabelas
 */
export function transformTables(tabelas: TabelaPrecoTecnica[]): PriceTableInput[] {
  return tabelas.map(tabelaToPriceTableInput);
}

/**
 * Transforma array de técnicas
 */
export function transformTechniques(tecnicas: TecnicaUnificada[]): TechniqueInput[] {
  return tecnicas.map(tecnicaToTechniqueInput);
}

/**
 * Transforma array de tabelas raw
 */
export function transformRawTables(raws: CustomizationPriceTableRaw[]): PriceTableInput[] {
  return raws.map(rawTableToPriceTableInput);
}

/**
 * Transforma array de técnicas raw
 */
export function transformRawTechniques(raws: PersonalizationTechniqueRaw[]): TechniqueInput[] {
  return raws.map(rawTechniqueToTechniqueInput);
}
