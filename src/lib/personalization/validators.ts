/**
 * Domain Validators: PersonalizaÃ§Ã£o
 *
 * FunÃ§Ãµes puras para validaÃ§Ã£o de parÃ¢metros de personalizaÃ§Ã£o.
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
 * Valida se uma tabela de preÃ§o pode ser usada com os parÃ¢metros dados
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

  // Validar quantidade mÃ­nima
  const minQuantity =
    table.tiers.length > 0 ? Math.min(...table.tiers.map((t) => t.minQuantity)) : 1;

  if (quantity < minQuantity) {
    errors.push({
      code: 'BELOW_MIN_QUANTITY',
      field: 'quantity',
      message: `Quantidade mÃ­nima Ã© ${minQuantity} unidades`,
    });
  }

  // Validar cores
  if (table.priceByColor && colors !== undefined) {
    if (colors <= 0) {
      errors.push({
        code: 'INVALID_COLORS',
        field: 'colors',
        message: 'NÃºmero de cores deve ser maior que zero',
      });
    }

    if (table.maxColors && colors > table.maxColors) {
      warnings.push({
        code: 'EXCEEDS_MAX_COLORS',
        field: 'colors',
        message: `NÃºmero de cores (${colors}) excede mÃ¡ximo da tabela (${table.maxColors}). PreÃ§o serÃ¡ ajustado proporcionalmente.`,
      });
    }
  }

  // Validar dimensÃµes
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
        message: `Largura (${widthCm}cm) excede mÃ¡ximo (${table.maxWidthCm}cm)`,
      });
    }

    if (heightCm && table.maxHeightCm && heightCm > table.maxHeightCm) {
      warnings.push({
        code: 'EXCEEDS_MAX_HEIGHT',
        field: 'heightCm',
        message: `Altura (${heightCm}cm) excede mÃ¡ximo (${table.maxHeightCm}cm)`,
      });
    }

    // Validar Ã¡rea
    if (widthCm && heightCm) {
      const areaCm2 = widthCm * heightCm;

      if (table.minAreaCm2 && areaCm2 < table.minAreaCm2) {
        errors.push({
          code: 'BELOW_MIN_AREA',
          field: 'area',
          message: `Ãrea (${areaCm2}cmÂ²) abaixo do mÃ­nimo (${table.minAreaCm2}cmÂ²)`,
        });
      }

      if (table.maxAreaCm2 && areaCm2 > table.maxAreaCm2) {
        warnings.push({
          code: 'EXCEEDS_MAX_AREA',
          field: 'area',
          message: `Ãrea (${areaCm2}cmÂ²) excede mÃ¡ximo (${table.maxAreaCm2}cmÂ²). PreÃ§o serÃ¡ ajustado.`,
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
 * Valida se uma tÃ©cnica Ã© compatÃ­vel com os parÃ¢metros solicitados
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
      message: 'TÃ©cnica nÃ£o estÃ¡ ativa',
    });
  }

  // Validar cores
  if (technique.requiresColors) {
    if (colors === undefined || colors === null) {
      errors.push({
        code: 'COLORS_REQUIRED',
        field: 'colors',
        message: 'Esta tÃ©cnica requer especificaÃ§Ã£o de cores',
      });
    } else {
      if (colors < technique.minColors) {
        errors.push({
          code: 'BELOW_MIN_COLORS',
          field: 'colors',
          message: `MÃ­nimo de ${technique.minColors} cor(es) requerido`,
        });
      }

      if (colors > technique.maxColors) {
        warnings.push({
          code: 'EXCEEDS_MAX_COLORS',
          field: 'colors',
          message: `NÃºmero de cores (${colors}) excede mÃ¡ximo (${technique.maxColors})`,
        });
      }
    }
  }

  // Validar Ã¡rea
  if (technique.priceByArea && widthCm && heightCm) {
    const areaCm2 = widthCm * heightCm;

    if (technique.minAreaCm2 && areaCm2 < technique.minAreaCm2) {
      errors.push({
        code: 'BELOW_MIN_AREA',
        field: 'area',
        message: `Ãrea mÃ­nima Ã© ${technique.minAreaCm2}cmÂ²`,
      });
    }

    if (technique.maxAreaCm2 && areaCm2 > technique.maxAreaCm2) {
      warnings.push({
        code: 'EXCEEDS_MAX_AREA',
        field: 'area',
        message: `Ãrea (${areaCm2}cmÂ²) excede mÃ¡ximo (${technique.maxAreaCm2}cmÂ²)`,
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
 * Valida se quantidade Ã© vÃ¡lida para um conjunto de faixas
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
      message: `Quantidade mÃ­nima Ã© ${minQuantity}`,
    });
  }

  if (maxQuantity && quantity > maxQuantity) {
    warnings.push({
      code: 'EXCEEDS_MAX_QUANTITY',
      field: 'quantity',
      message: `Quantidade (${quantity}) excede mÃ¡ximo usual (${maxQuantity})`,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Valida quantidade simples (para serviÃ§os)
 */
export function validateQuantity(quantity: number): ValidationResult {
  return validateQuantityRange(quantity, 1);
}

/**
 * Valida nÃºmero de cores
 */
export function validateColors(colors: number, maxColors?: number): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (colors <= 0) {
    errors.push({
      code: 'INVALID_COLORS',
      field: 'colors',
      message: 'NÃºmero de cores deve ser maior que zero',
    });
  }

  if (maxColors && colors > maxColors) {
    warnings.push({
      code: 'EXCEEDS_MAX_COLORS',
      field: 'colors',
      message: `NÃºmero de cores (${colors}) excede mÃ¡ximo (${maxColors})`,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Valida dimensÃµes de Ã¡rea
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
      message: `Largura (${widthCm}cm) excede mÃ¡ximo (${maxWidthCm}cm)`,
    });
  }

  if (maxHeightCm && heightCm > maxHeightCm) {
    warnings.push({
      code: 'EXCEEDS_MAX_HEIGHT',
      field: 'heightCm',
      message: `Altura (${heightCm}cm) excede mÃ¡ximo (${maxHeightCm}cm)`,
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
 * Verifica se precisa de setup (primeira gravaÃ§Ã£o ou novo cliente)
 */
export function requiresSetup(isFirstOrder: boolean, hasExistingMatrix: boolean): boolean {
  // Cobra setup apenas se nÃ£o tiver matriz existente
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

  // MÃºltiplas posiÃ§Ãµes aumenta manuseio
  if (positions > 1) {
    cost *= 1 + (positions - 1) * 0.25; // +25% por posiÃ§Ã£o adicional
  }

  // Produtos frÃ¡geis dobram manuseio
  if (isFragile) {
    cost *= 2;
  }

  return Math.round(cost * 100) / 100;
}
