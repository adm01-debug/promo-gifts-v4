/**
 * Hook: Cálculo de Preços
 *
 * Responsável por: Lógica de cálculo e simulação de preços
 */
import { useState, useCallback, useMemo } from 'react';
import { useTabelasPreco } from '@/hooks/tecnicas/useTabelasPreco';
import type { TabelaPrecoTecnica, ResultadoCalculoPreco } from '@/types/tecnica-unificada';

const STANDARD_QUANTITIES = [50, 100, 250, 500, 1000, 2500, 5000, 10000] as const;

// ============================================
// TIPOS DE COMPATIBILIDADE
// ============================================

/**
 * Faixa de preço simplificada
 */
export interface PriceTier {
  tierIndex: number;
  minQuantity: number;
  maxQuantity: number | null;
  unitPrice: number;
  slaDays: number | null;
}

/**
 * Resultado do cálculo de preço
 */
export interface PriceCalculation {
  technique: string;
  techniqueCode: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  setupPrice: number;
  handlingPrice: number;
  grandTotal: number;
  slaDays: number | null;
  maxColors: number;
  maxArea: { width: number; height: number };
  savings?: {
    comparedToMin: number;
    percentageOff: number;
  };
}

/**
 * Tabela de preço legada
 */
export interface LegacyPriceTable {
  id: string;
  table_code: string;
  table_code_option?: string;
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
  [key: string]: unknown; // Para min_qty_X, price_X, sla_X
}

// ============================================
// FUNÇÕES DE CÁLCULO
// ============================================

/**
 * Calcula preço usando TabelaPrecoTecnica
 */
export function calcularPreco(
  tabela: TabelaPrecoTecnica,
  quantidade: number,
  numeroCores?: number,
): ResultadoCalculoPreco {
  const faixas = tabela.faixas;
  if (!faixas.length) {
    throw new Error('Tabela de preço sem faixas configuradas');
  }

  // Binary search for faster faixa lookup on large quantity arrays
  let low = 0;
  let high = faixas.length - 1;
  let foundIdx = 0;

  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (quantidade >= faixas[mid].quantidadeMinima) {
      foundIdx = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const faixaUtilizada = faixas[foundIdx];
  let precoUnitario = faixaUtilizada.precoUnitario;

  if (tabela.precoPorCor && numeroCores && tabela.maxCores && numeroCores > tabela.maxCores) {
    precoUnitario *= numeroCores / tabela.maxCores;
  }

  return {
    tabelaId: tabela.id,
    codigoTabela: tabela.codigoTabelaOpcao,
    quantidade,
    faixaUtilizada: faixaUtilizada.faixa,
    precoUnitario,
    precoTotal: precoUnitario * quantidade,
    precoSetup: tabela.precoSetup,
    precoManuseio: tabela.precoManuseio,
    slaDias: faixaUtilizada.slaDias,
  };
}

/**
 * Extrai faixas de preço
 */
export function extractPriceTiersFromTabela(tabela: TabelaPrecoTecnica): PriceTier[] {
  return tabela.faixas.map((f, idx, arr) => ({
    tierIndex: f.faixa,
    minQuantity: f.quantidadeMinima,
    maxQuantity: arr[idx + 1] ? arr[idx + 1].quantidadeMinima - 1 : null,
    unitPrice: f.precoUnitario,
    slaDays: f.slaDias,
  }));
}

/**
 * Calcula preço para quantidade com resultado completo
 */
export function calculatePriceForQuantity(
  tabela: TabelaPrecoTecnica,
  quantity: number,
): PriceCalculation | null {
  if (tabela.faixas.length === 0) return null;

  let selectedFaixa = tabela.faixas[0];
  for (const faixa of tabela.faixas) {
    if (quantity >= faixa.quantidadeMinima) {
      selectedFaixa = faixa;
    }
  }

  const unitPrice = selectedFaixa.precoUnitario;
  const totalPrice = unitPrice * quantity;
  const grandTotal = totalPrice + tabela.precoSetup + tabela.precoManuseio;

  const minPrice = tabela.faixas[0].precoUnitario;
  const savingsPerUnit = minPrice - unitPrice;
  const percentageOff = minPrice > 0 ? ((minPrice - unitPrice) / minPrice) * 100 : 0;

  return {
    technique: tabela.nomeTecnica,
    techniqueCode: tabela.codigoTabela,
    quantity,
    unitPrice,
    totalPrice,
    setupPrice: tabela.precoSetup,
    handlingPrice: tabela.precoManuseio,
    grandTotal,
    slaDays: selectedFaixa.slaDias,
    maxColors: tabela.maxCores || 1,
    maxArea: {
      width: tabela.larguraMaxCm || 0,
      height: tabela.alturaMaxCm || 0,
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

// ============================================
// HOOKS
// ============================================

/**
 * Hook para cálculos de preço de personalização
 */
export function usePrecoCalculation() {
  const { data: tabelas = [], isLoading, error, refetch } = useTabelasPreco({ apenasAtivas: true });

  const calculateAllPrices = useCallback(
    (quantity: number): PriceCalculation[] => {
      return tabelas
        .map((tabela) => calculatePriceForQuantity(tabela, quantity))
        .filter((calc): calc is PriceCalculation => calc !== null)
        .sort((a, b) => a.unitPrice - b.unitPrice);
    },
    [tabelas],
  );

  const calculatePrice = useCallback(
    (techniqueCode: string, quantity: number): PriceCalculation | null => {
      const tabela = tabelas.find((t) => t.codigoTabela === techniqueCode);
      if (!tabela) return null;
      return calculatePriceForQuantity(tabela, quantity);
    },
    [tabelas],
  );

  const getTiers = useCallback(
    (techniqueCode: string): PriceTier[] => {
      const tabela = tabelas.find((t) => t.codigoTabela === techniqueCode);
      if (!tabela) return [];
      return extractPriceTiersFromTabela(tabela);
    },
    [tabelas],
  );

  const techniques = useMemo(() => {
    return tabelas.map((tabela) => ({
      code: tabela.codigoTabela,
      name: tabela.nomeTecnica,
      maxColors: tabela.maxCores || 1,
      maxArea: {
        width: tabela.larguraMaxCm || 0,
        height: tabela.alturaMaxCm || 0,
      },
      priceByColor: tabela.precoPorCor,
      priceByArea: tabela.precoPorArea,
    }));
  }, [tabelas]);

  return {
    tabelas,
    techniques,
    standardQuantities: STANDARD_QUANTITIES,
    isLoading,
    error: error?.message ?? null,
    refetch,
    calculateAllPrices,
    calculatePrice,
    getTiers,
  };
}

/**
 * Hook para simulador de preços
 */
export function usePriceSimulator(productBasePrice: number = 0) {
  const { tabelas: _tabelas, isLoading, error, calculateAllPrices } = usePrecoCalculation();
  const [quantity, setQuantity] = useState(100);
  const [selectedTechniqueCode, setSelectedTechniqueCode] = useState<string | null>(null);

  const calculations = useMemo(() => {
    return calculateAllPrices(quantity);
  }, [calculateAllPrices, quantity]);

  const selectedCalculation = useMemo(() => {
    if (!selectedTechniqueCode) return calculations[0] || null;
    return calculations.find((c) => c.techniqueCode === selectedTechniqueCode) ?? null;
  }, [calculations, selectedTechniqueCode]);

  const totalWithProduct = useMemo(() => {
    if (!selectedCalculation) return null;
    const productTotal = productBasePrice * quantity;
    return {
      productTotal,
      customizationTotal: selectedCalculation.grandTotal,
      grandTotal: productTotal + selectedCalculation.grandTotal,
      unitTotal: (productTotal + selectedCalculation.grandTotal) / quantity,
    };
  }, [selectedCalculation, productBasePrice, quantity]);

  return {
    quantity,
    setQuantity,
    selectedTechniqueCode,
    setSelectedTechniqueCode,
    calculations,
    selectedCalculation,
    totalWithProduct,
    isLoading,
    error,
  };
}
