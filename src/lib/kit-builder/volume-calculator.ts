/**
 * Kit Builder - Volume Calculator
 * Utilitários para cálculo e validação de volume
 */

import type { KitBox, KitItem, CompatibilityResult } from './types';

// ============================================
// CONSTANTES
// ============================================

// Fator de folga para empacotamento (itens não ocupam 100% do volume)
const PACKING_EFFICIENCY = 0.75; // 75% de eficiência

// Limite de alerta de volume
const VOLUME_WARNING_THRESHOLD = 0.85; // 85%

// ============================================
// CÁLCULOS BÁSICOS
// ============================================

/**
 * Calcula o volume de um objeto em cm³
 */
export function calculateVolume(width: number, height: number, depth: number): number {
  return width * height * depth;
}

/**
 * Calcula o volume utilizável de uma caixa (com fator de eficiência)
 */
export function calculateUsableVolume(box: KitBox): number {
  return box.internalVolume * PACKING_EFFICIENCY;
}

/**
 * Calcula o volume total dos itens
 */
export function calculateTotalItemsVolume(items: KitItem[]): number {
  return items.reduce((total, item) => total + item.volume * item.quantity, 0);
}

/**
 * Calcula a porcentagem de volume utilizado
 */
export function calculateVolumeUsagePercent(itemsVolume: number, boxVolume: number): number {
  if (boxVolume === 0) return 0;
  const usableVolume = boxVolume * PACKING_EFFICIENCY;
  return (itemsVolume / usableVolume) * 100;
}

// ============================================
// VALIDAÇÕES
// ============================================

/**
 * Verifica se um item cabe na caixa considerando os itens existentes
 */
export function checkItemFits(
  item: KitItem,
  box: KitBox,
  existingItems: KitItem[],
  quantity = 1,
): CompatibilityResult {
  const currentVolume = calculateTotalItemsVolume(existingItems);
  const itemVolume = item.volume * quantity;
  const totalVolumeAfter = currentVolume + itemVolume;
  const usableVolume = calculateUsableVolume(box);

  const percentAfterAdd = (totalVolumeAfter / usableVolume) * 100;

  // Verifica se o item cabe em alguma das 6 orientações possíveis
  const itemDims = [item.width, item.height, item.depth].sort((a, b) => a - b);
  const boxDims = [box.internalWidth, box.internalHeight, box.internalDepth].sort((a, b) => a - b);

  // Se as dimensões ordenadas do item excedem as da caixa, não cabe em nenhuma orientação
  const fitsAnyOrientation =
    itemDims[0] <= boxDims[0] && itemDims[1] <= boxDims[1] && itemDims[2] <= boxDims[2];

  if (!fitsAnyOrientation) {
    return {
      fits: false,
      reason: `Dimens\u00f5es do item (${item.width}\u00d7${item.height}\u00d7${item.depth}cm) n\u00e3o cabem na caixa (${box.internalWidth}\u00d7${box.internalHeight}\u00d7${box.internalDepth}cm) em nenhuma orienta\u00e7\u00e3o`,
    };
  }

  // Verifica volume total
  if (totalVolumeAfter > usableVolume) {
    return {
      fits: false,
      reason: `Volume total excederá a capacidade da caixa (${Math.round(percentAfterAdd)}% > 100%)`,
      volumeAfterAdd: totalVolumeAfter,
      percentAfterAdd,
    };
  }

  return {
    fits: true,
    volumeAfterAdd: totalVolumeAfter,
    percentAfterAdd,
  };
}

/**
 * Verifica se a caixa está no limite de alerta
 */
export function isNearCapacity(usagePercent: number): boolean {
  return usagePercent >= VOLUME_WARNING_THRESHOLD * 100;
}

/**
 * Verifica se a caixa está cheia
 */
export function isAtCapacity(usagePercent: number): boolean {
  return usagePercent >= 100;
}

// ============================================
// FORMATAÇÃO
// ============================================

/**
 * Formata volume para exibição
 */
export function formatVolume(volumeCm3: number): string {
  if (volumeCm3 >= 1000) {
    return `${(volumeCm3 / 1000).toFixed(1)}L`;
  }
  return `${Math.round(volumeCm3)}cm\u00b3`;
}

/**
 * Formata dimensões para exibição
 */
export function formatDimensions(width: number, height: number, depth: number): string {
  return `${width} \u00d7 ${height} \u00d7 ${depth} cm`;
}

/**
 * Retorna cor baseada na porcentagem de uso
 */
export function getVolumeStatusColor(percent: number): 'success' | 'warning' | 'destructive' {
  if (percent >= 100) return 'destructive';
  if (percent >= 85) return 'warning';
  return 'success';
}

/**
 * Retorna label baseado na porcentagem de uso
 */
export function getVolumeStatusLabel(percent: number): string {
  if (percent >= 100) return 'Cheio';
  if (percent >= 85) return 'Quase cheio';
  if (percent >= 50) return 'Bom uso';
  if (percent > 0) return 'Espa\u00e7o dispon\u00edvel';
  return 'Vazio';
}

// ============================================
// PARSING DE DIMENSÕES
// ============================================

/**
 * Tenta extrair dimensões de uma string de dimensões
 * Formatos suportados: "10x20x5", "10 x 20 x 5", "10×20×5"
 */
export function parseDimensionsString(
  dimensionsStr: string | null | undefined,
): { width: number; height: number; depth: number } | null {
  if (!dimensionsStr) return null;

  // Remove espaços extras e normaliza separadores
  const normalized = dimensionsStr
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/\u00d7/g, 'x')
    .replace(/×/g, 'x')
    .replace(/cm/g, '');

  // Tenta match com padrão NxNxN
  const match = /(\d+(?:\.\d+)?)[x\u00d7](\d+(?:\.\d+)?)[x\u00d7](\d+(?:\.\d+)?)/.exec(normalized);

  if (match) {
    return {
      width: parseFloat(match[1]),
      height: parseFloat(match[2]),
      depth: parseFloat(match[3]),
    };
  }

  return null;
}

/**
 * Extrai dimensões de um produto externo
 */
export function extractProductDimensions(product: {
  dimensions?:
    | string
    | { width_cm?: number; height_cm?: number; length_cm?: number; diameter_cm?: number }
    | null;
  width_cm?: number | null;
  height_cm?: number | null;
  length_cm?: number | null;
  box_length_cm?: number | null;
  box_width_cm?: number | null;
  box_height_cm?: number | null;
  internal_length_cm?: number | null;
  internal_width_cm?: number | null;
  internal_height_cm?: number | null;
}): { width: number; height: number; depth: number } | null {
  // Primeiro tenta campos específicos de dimensão interna (para caixas)
  if (product.internal_width_cm && product.internal_length_cm && product.internal_height_cm) {
    return {
      width: product.internal_width_cm,
      height: product.internal_height_cm,
      depth: product.internal_length_cm,
    };
  }

  // Depois tenta campos de dimensão externa
  if (product.box_width_cm && product.box_length_cm && product.box_height_cm) {
    return {
      width: product.box_width_cm,
      height: product.box_height_cm,
      depth: product.box_length_cm,
    };
  }

  // Depois tenta campos diretos em cm
  if (product.width_cm && product.length_cm && product.height_cm) {
    return {
      width: product.width_cm,
      height: product.height_cm,
      depth: product.length_cm,
    };
  }

  // Tenta JSONB dimensions (formato do banco externo)
  if (product.dimensions && typeof product.dimensions === 'object') {
    const dims = product.dimensions as {
      width_cm?: number;
      height_cm?: number;
      length_cm?: number;
    };
    if (dims.width_cm && dims.height_cm && dims.length_cm) {
      return {
        width: dims.width_cm,
        height: dims.height_cm,
        depth: dims.length_cm,
      };
    }
    if (dims.width_cm && dims.height_cm) {
      return {
        width: dims.width_cm,
        height: dims.height_cm,
        depth: dims.length_cm || Math.min(dims.width_cm, dims.height_cm) * 0.5,
      };
    }
  }

  // Por fim tenta parsear string de dimensões
  if (typeof product.dimensions === 'string') {
    return parseDimensionsString(product.dimensions);
  }

  return null;
}

// ============================================
// ESTIMATIVAS
// ============================================

/**
 * Estima dimensões padrão baseado na categoria do produto
 */
export function estimateDefaultDimensions(category?: string): {
  width: number;
  height: number;
  depth: number;
} {
  const categoryLower = (category || '').toLowerCase();

  // Estimativas baseadas em categorias comuns
  if (categoryLower.includes('caneta') || categoryLower.includes('pen')) {
    return { width: 1.5, height: 15, depth: 1.5 };
  }
  if (categoryLower.includes('caderno') || categoryLower.includes('agenda')) {
    return { width: 15, height: 21, depth: 2 };
  }
  if (categoryLower.includes('garrafa') || categoryLower.includes('squeeze')) {
    return { width: 7, height: 25, depth: 7 };
  }
  if (categoryLower.includes('copo') || categoryLower.includes('caneca')) {
    return { width: 10, height: 12, depth: 10 };
  }
  if (categoryLower.includes('mochila') || categoryLower.includes('bolsa')) {
    return { width: 30, height: 40, depth: 15 };
  }
  if (categoryLower.includes('necessaire')) {
    return { width: 20, height: 12, depth: 8 };
  }
  if (categoryLower.includes('guarda-chuva') || categoryLower.includes('sombrinha')) {
    return { width: 5, height: 60, depth: 5 };
  }
  if (categoryLower.includes('power bank') || categoryLower.includes('carregador')) {
    return { width: 7, height: 14, depth: 2 };
  }

  // Padrão genérico para itens pequenos
  return { width: 10, height: 10, depth: 5 };
}
