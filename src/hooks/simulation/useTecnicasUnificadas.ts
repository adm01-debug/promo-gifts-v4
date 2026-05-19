/**
 * Hook Unificado para Técnicas de Gravação/Personalização
 *
 * REFATORADO: Este arquivo agora re-exporta dos hooks modulares
 * para manter compatibilidade com código existente.
 *
 * Nova estrutura em: src/hooks/tecnicas/
 * - useTecnicasList.ts
 * - useTecnicaMutations.ts
 * - useTabelasPreco.ts
 * - usePrecoCalculation.ts
 */

// Re-export everything from modular hooks
export {
  TECNICAS_QUERY_KEYS,
  // Lista e Busca
  useTecnicasList,
  useTecnicasResumo,
  useTecnicaById,
  useTecnicaByCodigo,
  useCategoriasTecnicas,
  useInvalidateTecnicas,
  // Mutations
  useTecnicaMutations,
  // Tabelas de Preço
  useTabelasPreco,
  useTabelasPorTecnica,
  useTabelaPorCodigo,
  useNomesTecnicasPreco,
  buscarTabelaAdequada,
  // Cálculos
  calcularPreco,
  extractPriceTiersFromTabela,
  calculatePriceForQuantity,
  usePrecoCalculation,
  usePriceSimulator,
  type PriceTier,
  type PriceCalculation,
  type LegacyPriceTable,
} from '../tecnicas';

// ============================================
// ALIASES DE COMPATIBILIDADE
// ============================================

import {
  useTecnicasList,
  useTecnicaById as useTecnicaByIdInternal,
  useTecnicaByCodigo as useTecnicaByCodigoInternal,
  useTecnicaMutations,
  usePrecoCalculation,
  type PriceTier,
  type PriceCalculation,
} from '../tecnicas';
import type { TecnicaFiltros } from '@/types/tecnica-unificada';

/**
 * @deprecated Use useTecnicasList + useTecnicaMutations separadamente
 * Mantido para compatibilidade
 */
export function useTecnicasUnificadas(filtros?: TecnicaFiltros) {
  const query = useTecnicasList(filtros);
  const mutations = useTecnicaMutations();

  return {
    tecnicas: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    // Mutations
    toggleStatus: mutations.toggleStatus,
    isToggling: mutations.isToggling,
    create: mutations.create,
    isCreating: mutations.isCreating,
    update: mutations.update,
    isUpdating: mutations.isUpdating,
    remove: mutations.remove,
    isRemoving: mutations.isRemoving,
  };
}

/**
 * @deprecated Use useTecnicaById
 */
export const useTecnicaUnificada = useTecnicaByIdInternal;

/**
 * @deprecated Use useTecnicaByCodigo
 */
export const useTecnicaPorCodigo = useTecnicaByCodigoInternal;

/**
 * @deprecated Use usePrecoCalculation
 * Mantido para compatibilidade com código legado
 */
export function useCustomizationPricing() {
  const calc = usePrecoCalculation();

  return {
    priceTables: [], // Legado - não mais usado
    techniques: calc.techniques,
    standardQuantities: calc.standardQuantities,
    isLoading: calc.isLoading,
    error: calc.error,
    fetchPriceTables: calc.refetch,
    calculateAllPrices: calc.calculateAllPrices,
    calculatePrice: calc.calculatePrice,
    getTiers: calc.getTiers,
  };
}

// ============================================
// TIPOS LEGADOS (compatibilidade)
// ============================================

/**
 * @deprecated Use tipos de @/types/tecnica-unificada
 */
export interface CustomizationPriceTable {
  id: string;
  organization_id?: string;
  table_code: string;
  table_code_option?: string;
  table_fullcode?: string;
  technique_id?: string;
  customization_type_name: string;
  max_area_width_cm?: number;
  max_area_height_cm?: number;
  max_colors?: number;
  price_by_color?: boolean;
  price_by_area?: boolean;
  price_by_stitches?: boolean;
  setup_price?: number;
  handling_price?: number;
  is_active?: boolean;
  [key: string]: unknown;
}

/**
 * @deprecated Use extractPriceTiersFromTabela
 */
export function extractPriceTiers(table: CustomizationPriceTable): PriceTier[] {
  const tiers: PriceTier[] = [];

  for (let i = 1; i <= 15; i++) {
    const minQty = table[`min_qty_${i}`] as number | undefined;
    const price = table[`price_${i}`] as number | undefined;
    const sla = table[`sla_${i}`] as number | undefined;

    if (minQty !== undefined && minQty !== null && price !== undefined && price !== null) {
      const nextMinQty = table[`min_qty_${i + 1}`] as number | undefined;
      const maxQty = nextMinQty ? nextMinQty - 1 : null;

      tiers.push({
        tierIndex: i,
        minQuantity: minQty,
        maxQuantity: maxQty,
        unitPrice: price,
        slaDays: sla ?? null,
      });
    }
  }

  return tiers;
}

/**
 * @deprecated Use calculatePriceForQuantity de ./tecnicas
 */
export function calculatePriceForQuantityLegacy(
  table: CustomizationPriceTable,
  quantity: number,
): PriceCalculation | null {
  const tiers = extractPriceTiers(table);

  if (tiers.length === 0) return null;

  let selectedTier = tiers[0];
  for (const tier of tiers) {
    if (quantity >= tier.minQuantity) {
      selectedTier = tier;
    }
  }

  const unitPrice = selectedTier.unitPrice;
  const totalPrice = unitPrice * quantity;
  const setupPrice = table.setup_price || 0;
  const handlingPrice = table.handling_price || 0;
  const grandTotal = totalPrice + setupPrice + handlingPrice;

  const minTierPrice = tiers[0].unitPrice;
  const savingsPerUnit = minTierPrice - unitPrice;
  const percentageOff = minTierPrice > 0 ? ((minTierPrice - unitPrice) / minTierPrice) * 100 : 0;

  return {
    technique: table.customization_type_name,
    techniqueCode: table.table_code,
    quantity,
    unitPrice,
    totalPrice,
    setupPrice,
    handlingPrice,
    grandTotal,
    slaDays: selectedTier.slaDays,
    maxColors: table.max_colors || 1,
    maxArea: {
      width: table.max_area_width_cm || 0,
      height: table.max_area_height_cm || 0,
    },
    savings:
      savingsPerUnit > 0
        ? {
            comparedToMin: savingsPerUnit * quantity,
            percentageOff: Math.round(percentageOff),
          }
        : undefined,
  };
}
