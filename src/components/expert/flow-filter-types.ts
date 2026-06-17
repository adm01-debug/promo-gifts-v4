/**
 * Shared types and utilities for the expert chat flow-filter system.
 *
 * Extracted from FlowFilterPanel.tsx to break the circular dependency:
 *   FlowFilterPanel → FlowFilterSections → FlowFilterPanel
 * which caused a ReferenceError (TDZ) at runtime after Vite bundling.
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

export const defaultFlowFilters: FlowFilterState = {
  priceMin: '',
  priceMax: '',
  selectedCategories: [],
  selectedMaterials: [],
  selectedColors: [],
  selectedGenders: [],
  selectedSuppliers: [],
  selectedTechniques: [],
  selectedPublicos: [],
  selectedDatasComemorativas: [],
  selectedEndomarketing: [],
  selectedNichos: [],
  selectedTags: [],
  onlyInStock: false,
  onlyNew: false,
  onlyKit: false,
  onlyBestseller: false,
  onlyFeatured: false,
  hasPersonalization: false,
};

export function countActiveFilters(f: FlowFilterState): number {
  let count = 0;
  if (f.priceMin || f.priceMax) count++;
  count += f.selectedCategories.length + f.selectedMaterials.length + f.selectedColors.length;
  count += f.selectedGenders.length + f.selectedSuppliers.length + f.selectedTechniques.length;
  count += f.selectedPublicos.length + f.selectedDatasComemorativas.length;
  count += f.selectedEndomarketing.length + f.selectedNichos.length + f.selectedTags.length;
  if (f.onlyInStock) count++;
  if (f.onlyNew) count++;
  if (f.onlyKit) count++;
  if (f.onlyBestseller) count++;
  if (f.onlyFeatured) count++;
  if (f.hasPersonalization) count++;
  return count;
}

export function getActiveFilterLabels(
  f: FlowFilterState,
): { label: string; key: string; value?: string }[] {
  const labels: { label: string; key: string; value?: string }[] = [];
  if (f.priceMin || f.priceMax) {
    const l =
      f.priceMin && f.priceMax
        ? `R$${f.priceMin}–${f.priceMax}`
        : f.priceMin
          ? `R$${f.priceMin}+`
          : `Até R$${f.priceMax}`;
    labels.push({ label: l, key: 'price' });
  }
  const arrayKeys: [keyof FlowFilterState, string][] = [
    ['selectedCategories', 'selectedCategories'],
    ['selectedColors', 'selectedColors'],
    ['selectedMaterials', 'selectedMaterials'],
    ['selectedGenders', 'selectedGenders'],
    ['selectedSuppliers', 'selectedSuppliers'],
    ['selectedTechniques', 'selectedTechniques'],
    ['selectedPublicos', 'selectedPublicos'],
    ['selectedDatasComemorativas', 'selectedDatasComemorativas'],
    ['selectedEndomarketing', 'selectedEndomarketing'],
    ['selectedNichos', 'selectedNichos'],
    ['selectedTags', 'selectedTags'],
  ];
  labels.push(
    ...arrayKeys.flatMap(([k, key]) =>
      (f[k] as string[]).map((v) => ({ label: v, key, value: v })),
    ),
  );
  if (f.onlyInStock) labels.push({ label: 'Em estoque', key: 'onlyInStock' });
  if (f.onlyNew) labels.push({ label: 'Novidades', key: 'onlyNew' });
  if (f.onlyKit) labels.push({ label: 'Kits', key: 'onlyKit' });
  if (f.onlyBestseller) labels.push({ label: '+ Vendidos', key: 'onlyBestseller' });
  if (f.onlyFeatured) labels.push({ label: 'Destaques', key: 'onlyFeatured' });
  if (f.hasPersonalization) labels.push({ label: 'Personalização', key: 'hasPersonalization' });
  return labels;
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
