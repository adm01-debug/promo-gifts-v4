/**
 * Domain Validators: Personalização
 *
 * Funções puras para validação de parâmetros de personalização.
 */

import type {
  PriceTableInput,
  TechniqueInput,
  PriceCalculationParams,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from './types';

// ============================================
// TABLE VALIDATION
// ============================================

/**
 * Valida se uma tabela de preço pode ser usada com os parâmetros dados
 */
export function validateTableForParams(
  table: PriceTableInput,
  params: PriceCalculationParams,
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const { quantity, colors, widthCm, heightCm } = params;

  // Validar quantidade
  if (quantity <= 0) {
    errors.push({
      code: 'INVALID_QUANTITY',
      field: 'quantity',
      message: 'Quantidade deve ser maior que zero',
    });
  }

  // Validar quantidade mínima
  const minQuantity =
    table.tiers.length > 0 ? Math.min(...table.tiers.map((t) => t.minQuantity)) : 1;

  if (quantity < minQuantity) {
    errors.push({
      code: 'BELOW_MIN_QUANTITY',
      field: 'quantity',
      message: `Quantidade mínima é ${minQuantity} unidades`,
    });
  }

  // Validar cores
  if (table.priceByColor && colors !== undefined) {
    if (colors <= 0) {
      errors.push({
        code: 'INVALID_COLORS',
        field: 'colors',
        message: 'Número de cores deve ser maior que zero',
      });
    }

    if (table.maxColors && colors > table.maxColors) {
      warnings.push({
        code: 'EXCEEDS_MAX_COLORS',
        field: 'colors',
        message: `Número de cores (${colors}) excede máximo da tabela (${table.maxColors}). Preço será ajustado proporcionalmente.`,
      });
    }
  }

  // Validar dimensões
  if (table.priceByArea) {
    if (widthCm !== undefined && widthCm <= 0) {
      errors.push({
        code: 'INVALID_WIDTH',
        field: 'widthCm',
        message: 'Largura deve ser maior que zero',
      });
    }

    if (heightCm !== undefined && heightCm <= 0) {
      errors.push({
        code: 'INVALID_HEIGHT',
        field: 'heightCm',
        message: 'Altura deve ser maior que zero',
      });
    }

    if (widthCm && table.maxWidthCm && widthCm > table.maxWidthCm) {
      warnings.push({
        code: 'EXCEEDS_MAX_WIDTH',
        field: 'widthCm',
        message: `Largura (${widthCm}cm) excede máximo (${table.maxWidthCm}cm)`,
      });
    }

    if (heightCm && table.maxHeightCm && heightCm > table.maxHeightCm) {
      warnings.push({
        code: 'EXCEEDS_MAX_HEIGHT',
        field: 'heightCm',
        message: `Altura (${heightCm}cm) excede máximo (${table.maxHeightCm}cm)`,
      });
    }

    // Validar área
    if (widthCm && heightCm) {
      const areaCm2 = widthCm * heightCm;

      if (table.minAreaCm2 && areaCm2 < table.minAreaCm2) {
        errors.push({
          code: 'BELOW_MIN_AREA',
          field: 'area',
          message: `Área (${areaCm2}cm²) abaixo do mínimo (${table.minAreaCm2}cm²)`,
        });
      }

      if (table.maxAreaCm2 && areaCm2 > table.maxAreaCm2) {
        warnings.push({
          code: 'EXCEEDS_MAX_AREA',
          field: 'area',
          message: `Área (${areaCm2}cm²) excede máximo (${table.maxAreaCm2}cm²). Preço será ajustado.`,
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Valida se uma técnica é compatível com os parâmetros solicitados
 */
export function validateTechniqueForParams(
  technique: TechniqueInput,
  params: PriceCalculationParams,
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const { colors, widthCm, heightCm } = params;

  // Validar status
  if (!technique.isActive) {
    errors.push({
      code: 'TECHNIQUE_INACTIVE',
      field: 'technique',
      message: 'Técnica não está ativa',
    });
  }

  // Validar cores
  if (technique.requiresColors) {
    if (colors === undefined || colors === null) {
      errors.push({
        code: 'COLORS_REQUIRED',
        field: 'colors',
        message: 'Esta técnica requer especificação de cores',
      });
    } else {
      if (colors < technique.minColors) {
        errors.push({
          code: 'BELOW_MIN_COLORS',
          field: 'colors',
          message: `Mínimo de ${technique.minColors} cor(es) requerido`,
        });
      }

      if (colors > technique.maxColors) {
        warnings.push({
          code: 'EXCEEDS_MAX_COLORS',
          field: 'colors',
          message: `Número de cores (${colors}) excede máximo (${technique.maxColors})`,
        });
      }
    }
  }

  // Validar área
  if (technique.priceByArea && widthCm && heightCm) {
    const areaCm2 = widthCm * heightCm;

    if (technique.minAreaCm2 && areaCm2 < technique.minAreaCm2) {
      errors.push({
        code: 'BELOW_MIN_AREA',
        field: 'area',
        message: `Área mínima é ${technique.minAreaCm2}cm²`,
      });
    }

    if (technique.maxAreaCm2 && areaCm2 > technique.maxAreaCm2) {
      warnings.push({
        code: 'EXCEEDS_MAX_AREA',
        field: 'area',
        message: `Área (${areaCm2}cm²) excede máximo (${technique.maxAreaCm2}cm²)`,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================
// QUANTITY VALIDATION
// ============================================

/**
 * Valida se quantidade é válida para um conjunto de faixas
 */
export function validateQuantityRange(
  quantity: number,
  minQuantity: number,
  maxQuantity?: number | null,
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (quantity <= 0) {
    errors.push({
      code: 'INVALID_QUANTITY',
      field: 'quantity',
      message: 'Quantidade deve ser maior que zero',
    });
  }

  if (quantity < minQuantity) {
    errors.push({
      code: 'BELOW_MIN_QUANTITY',
      field: 'quantity',
      message: `Quantidade mínima é ${minQuantity}`,
    });
  }

  if (maxQuantity && quantity > maxQuantity) {
    warnings.push({
      code: 'EXCEEDS_MAX_QUANTITY',
      field: 'quantity',
      message: `Quantidade (${quantity}) excede máximo usual (${maxQuantity})`,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Valida quantidade simples (para serviços)
 */
export function validateQuantity(quantity: number): ValidationResult {
  return validateQuantityRange(quantity, 1);
}

/**
 * Valida número de cores
 */
export function validateColors(colors: number, maxColors?: number): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (colors <= 0) {
    errors.push({
      code: 'INVALID_COLORS',
      field: 'colors',
      message: 'Número de cores deve ser maior que zero',
    });
  }

  if (maxColors && colors > maxColors) {
    warnings.push({
      code: 'EXCEEDS_MAX_COLORS',
      field: 'colors',
      message: `Número de cores (${colors}) excede máximo (${maxColors})`,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Valida dimensões de área
 */
export function validateArea(
  widthCm: number,
  heightCm: number,
  maxWidthCm?: number,
  maxHeightCm?: number,
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (widthCm <= 0) {
    errors.push({
      code: 'INVALID_WIDTH',
      field: 'widthCm',
      message: 'Largura deve ser maior que zero',
    });
  }

  if (heightCm <= 0) {
    errors.push({
      code: 'INVALID_HEIGHT',
      field: 'heightCm',
      message: 'Altura deve ser maior que zero',
    });
  }

  if (maxWidthCm && widthCm > maxWidthCm) {
    warnings.push({
      code: 'EXCEEDS_MAX_WIDTH',
      field: 'widthCm',
      message: `Largura (${widthCm}cm) excede máximo (${maxWidthCm}cm)`,
    });
  }

  if (maxHeightCm && heightCm > maxHeightCm) {
    warnings.push({
      code: 'EXCEEDS_MAX_HEIGHT',
      field: 'heightCm',
      message: `Altura (${heightCm}cm) excede máximo (${maxHeightCm}cm)`,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================
// BUSINESS RULES
// ============================================

/**
 * Verifica se precisa de setup (primeira gravação ou novo cliente)
 */
export function requiresSetup(isFirstOrder: boolean, hasExistingMatrix: boolean): boolean {
  // Cobra setup apenas se não tiver matriz existente
  return isFirstOrder || !hasExistingMatrix;
}

/**
 * Calcula custo de manuseio baseado na complexidade
 */
export function calculateHandlingCost(
  baseHandling: number,
  positions: number,
  isFragile: boolean,
): number {
  let cost = baseHandling;

  // Múltiplas posições aumenta manuseio
  if (positions > 1) {
    cost *= 1 + (positions - 1) * 0.25; // +25% por posição adicional
  }

  // Produtos frágeis dobram manuseio
  if (isFragile) {
    cost *= 2;
  }

  return Math.round(cost * 100) / 100;
}
