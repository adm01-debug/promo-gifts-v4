export type { Product, ProductTechnique, ConfiguredEngraving, ProductColor } from './types';
// Barrel exports para os componentes do simulador
export type { SearchFilters, ProductWithCalculatedPrice, ViewMode } from "@/pages/advanced-price-search/types";
export * from './utils';
export { StepIndicator } from './StepIndicator';
export { ProductSearch } from './ProductSearch';
export { ProductVariantSelector, type ProductVariant } from './ProductVariantSelector';
export { TechniqueSelector } from './TechniqueSelector';
export { CustomizationOptions } from './CustomizationOptions';
export { QuantityAndResult } from './QuantityAndResult';
export { EngravingList } from './EngravingList';
export { MultiEngravingResult } from './MultiEngravingResult';
export { PriceResultV51, QuoteCodeBadge } from './PriceResultV51';
export { UpsellPlusPlus } from './upsell';
export { generateSuggestions } from './upsell';
export type { UpsellSuggestion, UpsellType, UpsellPriority } from './upsell';
