/**
 * Pricing Simulator Types
 *
 * Tipos específicos para o componente de simulador de preços.
 * Utiliza tipos de domínio como base.
 */

import type { PriceCalculationResult } from '@/types/domain';

// ============================================
// PRODUCT (contexto do simulador)
// ============================================

export interface ProductColor {
  code: string;
  name: string;
  hex?: string;
  stock?: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  images: string[];
  category_name: string | null;
  supplier_reference?: string | null;
  brand?: string | null;
  colors?: ProductColor[];
}

// ============================================
// TÉCNICA DO PRODUTO
// ============================================

export interface ProductTechnique {
  id: string;
  techniqueCode: string;
  techniqueName: string;
  componentName: string;
  locationName: string;
  locationCode: string;
  composedCode: string;
  maxWidth: number | null;
  maxHeight: number | null;
  maxArea: number | null;
  maxColors: number | null;
  isCurved: boolean;
  isPrimary: boolean;
}

// ============================================
// GRAVAÇÃO CONFIGURADA
// ============================================

export interface ConfiguredEngraving {
  id: string;
  technique: ProductTechnique;
  colors: number;
  sizeOption: string | null;
  tableCode: string | null;
}

// ============================================
// RESULTADO DE SIMULAÇÃO
// ============================================

export interface SimulationResult {
  technique: ProductTechnique;
  priceCalculation: PriceCalculationResult;
  productTotal: number;
  customizationTotal: number;
  grandTotal: number;
  unitTotal: number;
}

// ============================================
// DADOS INTERNOS DO SELETOR
// ============================================

export interface ComponentData {
  name: string;
  code: string;
  locations: LocationData[];
}

export interface LocationData {
  name: string;
  code: string;
  techniques: TechniqueData[];
}

export interface TechniqueData {
  id: string;
  areaName: string;
  techniqueCode: string;
  maxWidth: number | null;
  maxHeight: number | null;
  maxColors: number | null;
  areaCm2: number | null;
  isCurved: boolean;
  isPrimary: boolean;
  servCode: string | null;
}

// ============================================
// OPÇÕES DE TAMANHO
// ============================================

export interface SizeOption {
  label: string;
  value: string;
  modifier: number;
  width?: number;
  height?: number;
  areaCm2?: number;
}
