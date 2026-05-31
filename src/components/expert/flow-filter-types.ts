/**
 * FlowFilter shared types — extracted to break circular dependency.
 *
 * FlowFilterPanel <-> FlowFilterSections had a circular import that caused
 * "Cannot access 'fe' before initialization" in production builds with SWC.
 */

export interface FlowFilterState {
  priceMin: string;
  priceMax: string;
  selectedCategories: string[];
  selectedMaterials: string[];
  selectedColors: string[];
  selectedGenders: string[];
  selectedSuppliers: string[];
  selectedTechniques: string[];
  selectedPublicos: string[];
  selectedDatasComemorativas: string[];
  selectedEndomarketing: string[];
  selectedNichos: string[];
  selectedTags: string[];
  onlyInStock: boolean;
  onlyNew: boolean;
  onlyKit: boolean;
  onlyBestseller: boolean;
  onlyFeatured: boolean;
  hasPersonalization: boolean;
}

export interface FlowFilterOptions {
  categories: string[];
  materials: string[];
  colors: string[];
  suppliers: string[];
  techniques: string[];
  publicoAlvo: string[];
  datasComemorativas: string[];
  endomarketing: string[];
  nichos: string[];
  tags: string[];
}
