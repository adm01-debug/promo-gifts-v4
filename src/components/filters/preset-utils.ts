// ─── Preset Constants & Utilities ─────────────────────────
import type { FilterState } from './FilterPanel';

export const PRESET_COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#6366f1',
  '#a855f7',
];

export const PRESET_EMOJIS = [
  '\u{1f4e6}',
  '\u{1f3af}',
  '\u{2b50}',
  '\u{1f525}',
  '\u{1f48e}',
  '\u{1f3f7}\u{fe0f}',
  '\u{1f3a8}',
  '\u{1f6d2}',
  '\u{1f4cb}',
  '\u{1f680}',
  '\u{1f4a1}',
  '\u{1f381}',
  '\u{1f3c6}',
  '\u{1f4cc}',
  '\u{2728}',
  '\u{1f516}',
];

export const PRESET_SIZES = ['P', 'M', 'G', 'GG', 'XGG'];

export type FilterPreset = {
  id: string;
  label: string;
  icon?: string;
  filters: Partial<FilterState>;
  color?: string;
};

export function countActiveFilters(filters: FilterState): number {
  let count = 0;
  if (filters.search) count++;
  if (filters.categories?.length) count += filters.categories.length;
  if (filters.suppliers?.length) count += filters.suppliers.length;
  if (filters.colorGroups?.length) count += filters.colorGroups.length;
  if (filters.colorVariations?.length) count += filters.colorVariations.length;
  if (filters.gender?.length) count += filters.gender.length;
  if (filters.sizes?.length) count += filters.sizes.length;
  if (filters.priceRange?.[0] > 0 || filters.priceRange?.[1] < 500) count++;
  if (filters.minStock > 0) count++;
  if (filters.inStock) count++;
  if (filters.featured) count++;
  if (filters.isNew) count++;
  return count;
}

export const countFilters = countActiveFilters;

/** Build a human-readable summary of a preset's filters */
export function summarizeFilters(filters: FilterState): string {
  const parts: string[] = [];
  if (filters.categories?.length)
    parts.push(`${filters.categories.length} categoria${filters.categories.length > 1 ? 's' : ''}`);
  if (filters.suppliers?.length)
    parts.push(`${filters.suppliers.length} fornecedor${filters.suppliers.length > 1 ? 'es' : ''}`);
  if (filters.colorGroups?.length)
    parts.push(`${filters.colorGroups.length} cor${filters.colorGroups.length > 1 ? 'es' : ''}`);
  if (filters.gender?.length)
    parts.push(`${filters.gender.length} g\u00eanero${filters.gender.length > 1 ? 's' : ''}`);
  if (filters.sizes?.length)
    parts.push(`${filters.sizes.length} tamanho${filters.sizes.length > 1 ? 's' : ''}`);
  if (filters.priceRange?.[0] > 0 || filters.priceRange?.[1] < 500)
    parts.push('faixa de pre\u00e7o');
  if (filters.inStock) parts.push('em estoque');
  if (filters.featured) parts.push('destaques');
  if (filters.isNew) parts.push('novidades');
  return parts.length > 0 ? parts.join(' \u00b7 ') : 'Sem filtros';
}
