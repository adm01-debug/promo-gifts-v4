/**
 * Service: Cálculo de Preços
 *
 * Orquestra lógica de negócio para cálculo de preços.
 * Combina repositórios + calculators + validators.
 */

import { PriceTableRepository } from '../repositories/priceTable.repository';
import { calculateSavings } from '../calculators';
import { validateQuantity, validateColors, validateArea } from '../validators';
import type { TabelaPrecoTecnica } from '@/types/tecnica-unificada';
import type { PriceCalculationResult, PriceCalculationParams, ValidationResult } from '../types';

// ============================================
// TYPES
// ============================================

export interface PricingRequest {
  techniqueName: string;
  quantity: number;
  colors?: number;
  widthCm?: number;
  heightCm?: number;
}

export interface PricingResponse {
  success: boolean;
  data?: PriceCalculationResult;
  table?: TabelaPrecoTecnica;
  validation: ValidationResult;
  error?: string;
}

export interface BatchPricingRequest {
  techniqueName: string;
  quantities: number[];
  colors?: number;
}

export interface BatchPricingResponse {
  techniqueName: string;
  table: TabelaPrecoTecnica | null;
  calculations: Array<{
    quantity: number;
    result: PriceCalculationResult | null;
  }>;
}

export interface ComparisonRequest {
  quantity: number;
  colors?: number;
  widthCm?: number;
  heightCm?: number;
}

export interface ComparisonResponse {
  quantity: number;
  techniques: Array<{
    techniqueName: string;
    table: TabelaPrecoTecnica;
    result: PriceCalculationResult;
  }>;
}

// ============================================
// SERVICE
// ============================================

/**
 * Calcula preço para uma técnica e quantidade
 */
export async function calculatePricing(request: PricingRequest): Promise<PricingResponse> {
  const { techniqueName, quantity, colors, widthCm, heightCm } = request;

  // Validações
  const validation = validateRequest(quantity, colors, widthCm, heightCm);
  if (!validation.isValid) {
    return { success: false, validation, error: validation.errors[0]?.message };
  }

  // Buscar tabela adequada
  const table = await PriceTableRepository.findBestMatch({
    techniqueName,
    colors,
    widthCm,
    heightCm,
  });

  if (!table) {
    return {
      success: false,
      validation,
      error: `Nenhuma tabela encontrada para técnica: ${techniqueName}`,
    };
  }

  // Calcular preço
  const params: PriceCalculationParams = {
    quantity,
    colors,
    widthCm,
    heightCm,
    areaCm2: widthCm && heightCm ? widthCm * heightCm : undefined,
  };

  const result = calculatePriceFromTable(table, params);

  return {
    success: true,
    data: result,
    table,
    validation,
  };
}

/**
 * Calcula preços para múltiplas quantidades
 */
export async function calculateBatchPricing(
  request: BatchPricingRequest,
): Promise<BatchPricingResponse> {
  const { techniqueName, quantities, colors } = request;

  const table = await PriceTableRepository.findBestMatch({
    techniqueName,
    colors,
  });

  const calculations = quantities.map((quantity) => {
    if (!table) {
      return { quantity, result: null };
    }

    const result = calculatePriceFromTable(table, { quantity, colors });
    return { quantity, result };
  });

  return {
    techniqueName,
    table,
    calculations,
  };
}

/**
 * Compara preços entre todas as técnicas disponíveis
 */
export async function comparePricing(request: ComparisonRequest): Promise<ComparisonResponse> {
  const { quantity, colors, widthCm, heightCm } = request;

  // Buscar todas as técnicas únicas
  const techniqueNames = await PriceTableRepository.findTechniqueNames();

  const techniques: ComparisonResponse['techniques'] = [];

  for (const techniqueName of techniqueNames) {
    const table = await PriceTableRepository.findBestMatch({
      techniqueName,
      colors,
      widthCm,
      heightCm,
    });

    if (table) {
      const result = calculatePriceFromTable(table, {
        quantity,
        colors,
        widthCm,
        heightCm,
      });

      techniques.push({ techniqueName, table, result });
    }
  }

  // Ordenar por preço unitário
  techniques.sort((a, b) => a.result.unitPrice - b.result.unitPrice);

  return {
    quantity,
    techniques,
  };
}

/**
 * Encontra a melhor técnica para os parâmetros dados
 */
export async function findBestTechnique(request: ComparisonRequest): Promise<{
  techniqueName: string;
  table: TabelaPrecoTecnica;
  result: PriceCalculationResult;
} | null> {
  const comparison = await comparePricing(request);
  return comparison.techniques[0] || null;
}

/**
 * Calcula economia em quantidade maior
 */
export async function calculateQuantitySavings(params: {
  techniqueName: string;
  currentQuantity: number;
  targetQuantity: number;
  colors?: number;
}): Promise<{
  currentPrice: PriceCalculationResult;
  targetPrice: PriceCalculationResult;
  savings: {
    perUnit: number;
    total: number;
    percentOff: number;
  };
} | null> {
  const { techniqueName, currentQuantity, targetQuantity, colors } = params;

  const table = await PriceTableRepository.findBestMatch({ techniqueName, colors });
  if (!table) return null;

  const currentPrice = calculatePriceFromTable(table, { quantity: currentQuantity, colors });
  const targetPrice = calculatePriceFromTable(table, { quantity: targetQuantity, colors });

  const savings = calculateSavings(currentPrice.unitPrice, targetPrice.unitPrice, targetQuantity);

  return {
    currentPrice,
    targetPrice,
    savings,
  };
}

// ============================================
// HELPERS
// ============================================

function validateRequest(
  quantity: number,
  colors?: number,
  widthCm?: number,
  heightCm?: number,
): ValidationResult {
  const errors: ValidationResult['errors'] = [];
  const warnings: ValidationResult['warnings'] = [];

  // Validar quantidade
  const qtyValidation = validateQuantity(quantity);
  errors.push(...qtyValidation.errors);
  warnings.push(...qtyValidation.warnings);

  // Validar cores
  if (colors !== undefined) {
    const colorValidation = validateColors(colors);
    errors.push(...colorValidation.errors);
    warnings.push(...colorValidation.warnings);
  }

  // Validar área
  if (widthCm !== undefined && heightCm !== undefined) {
    const areaValidation = validateArea(widthCm, heightCm);
    errors.push(...areaValidation.errors);
    warnings.push(...areaValidation.warnings);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

function calculatePriceFromTable(
  table: TabelaPrecoTecnica,
  params: PriceCalculationParams,
): PriceCalculationResult {
  const { quantity, colors } = params;

  // Encontrar faixa adequada
  let tierUsed = table.faixas[0];
  for (const faixa of table.faixas) {
    if (quantity >= faixa.quantidadeMinima) {
      tierUsed = faixa;
    } else {
      break;
    }
  }

  let unitPrice = tierUsed.precoUnitario;

  // Ajustar por cores se aplicável
  if (table.precoPorCor && colors && table.maxCores) {
    if (colors > table.maxCores) {
      const fatorCor = colors / table.maxCores;
      unitPrice *= fatorCor;
    }
  }

  const subtotal = unitPrice * quantity;
  const grandTotal = subtotal + table.precoSetup + table.precoManuseio;

  // Calcular economia comparando com primeira faixa
  const firstTierPrice = table.faixas[0]?.precoUnitario || unitPrice;
  const savings =
    unitPrice < firstTierPrice ? calculateSavings(firstTierPrice, unitPrice, quantity) : undefined;

  return {
    tableId: table.id,
    tableCode: table.codigoTabelaOpcao,
    techniqueName: table.nomeTecnica,
    quantity,
    tierUsed: tierUsed.faixa,
    unitPrice,
    subtotal,
    setupPrice: table.precoSetup,
    handlingPrice: table.precoManuseio,
    grandTotal,
    savings,
    slaDays: tierUsed.slaDias,
    maxColors: table.maxCores,
    maxArea:
      table.larguraMaxCm && table.alturaMaxCm
        ? {
            widthCm: table.larguraMaxCm,
            heightCm: table.alturaMaxCm,
            areaCm2: table.larguraMaxCm * table.alturaMaxCm,
          }
        : null,
  };
}

// ============================================
// EXPORTS
// ============================================

export const PricingService = {
  calculatePricing,
  calculateBatchPricing,
  comparePricing,
  findBestTechnique,
  calculateQuantitySavings,
};

export default PricingService;
