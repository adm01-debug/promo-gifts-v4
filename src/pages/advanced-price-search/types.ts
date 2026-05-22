import type { Product as CatalogProduct } from '@/hooks/products';
import type { PromobrindPriceTable } from '@/lib/external-db';

// ============================================================================
// Local types (originalmente declarados aqui)
// ============================================================================

export interface SearchFilters {
  searchQuery: string;
  category: string;
  minQuantity: number;
  colors: string[];
  technique: string;
  priceType: 'with_personalization' | 'without_personalization';
  priceRange: [number, number];
}

export interface ProductWithCalculatedPrice extends CatalogProduct {
  calculatedUnitPrice: number;
  priceBreakdown: {
    productPrice: number;
    customizationPrice: number;
    setupPrice: number;
    handlingPrice: number;
    totalPerUnit: number;
  };
  matchingTechnique?: PromobrindPriceTable;
}

export type ViewMode = 'cards' | 'table' | 'list';

export const DEFAULT_FILTERS: SearchFilters = {
  searchQuery: '',
  category: 'all',
  minQuantity: 100,
  colors: [],
  technique: 'all',
  priceType: 'with_personalization',
  priceRange: [0, 100],
};

export const QUANTITY_OPTIONS = [
  { value: 50, label: '50+ unidades' },
  { value: 100, label: '100+ unidades' },
  { value: 250, label: '250+ unidades' },
  { value: 500, label: '500+ unidades' },
  { value: 1000, label: '1.000+ unidades' },
  { value: 2500, label: '2.500+ unidades' },
  { value: 5000, label: '5.000+ unidades' },
];

export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

// ============================================================================
// Re-exports compatíveis (35+ consumidores legados importam destes nomes deste
// caminho). Cada nome aponta para sua fonte canônica. Novos consumidores devem
// importar diretamente da fonte canônica em vez de roteá-los aqui.
// ============================================================================

// Personalization manager (ground truth: ../admin/personalization-manager/types)
export type {
  ProductGroup,
  ProductGroupMember,
  Component,
  Location,
  Technique,
  LocationTechnique,
} from '@/components/admin/personalization-manager/types';

// Kit components admin (ground truth: ../admin/products/kit-components/types)
export type {
  KitComponent,
  PrintArea,
  BoxInternalDimensions,
  ComponentFormData,
  PrintAreaFormData,
} from '@/components/admin/products/kit-components/types';

// Bulk-import (ground truth: ../admin/products/bulk-import/types)
export type {
  ValidationResult,
  ColumnMapping,
} from '@/components/admin/products/bulk-import/types';

// Suppliers manager
export type { Supplier } from '@/components/admin/suppliers-manager/types';

// Filter panel
export type { FilterState, FilterPanelProps } from '@/components/filters/filter-panel/types';

// Pricing simulator: Product + outros tipos usados pela página de busca
// avançada e pelo simulador. O Product aqui é o do simulador (mais rico que
// o do personalization-manager, que tem apenas {id, name, sku} — esse
// subconjunto é compatível estruturalmente).
export type {
  Product,
  ProductColor,
  ProductTechnique,
  ConfiguredEngraving,
  SimulationResult,
} from '@/components/pricing/simulator/types';

// Component / Location / Technique data (estado interno do seletor de simulador)
export type {
  ComponentData,
  LocationData,
  TechniqueData,
} from '@/components/pricing/simulator/types';

// Pricing calculator
export type { SelectedTechniqueConfig } from '@/components/pricing/calculator/types';

// Kit builder lib
export type {
  KitItem,
  KitBox,
  KitPersonalization,
  CompatibilityResult,
} from '@/lib/kit-builder/types';

// Voice agent
export type { VoiceAgentAction, VoiceAgentPhase, UseVoiceAgentOptions } from '@/hooks/voice/types';
