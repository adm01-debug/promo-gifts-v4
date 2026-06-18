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

// BUG-SF-13 FIX: removido tipo FilterPreset local duplicado (com campo 'label' errado).
// O tipo correto está em FilterPresets.ts (com campo 'name', alinhado ao DB).
// Não reexportar daqui para evitar confusão.

/**
 * Conta o número de filtros ativos em um FilterState.
 *
 * BUG-SF-04 FIX: era priceRange < 500 — correto é < 9999 (valor sentinela de "sem limite").
 * BUG-SF-05 FIX: 12 tipos de filtro estavam ausentes da contagem.
 */
export function countActiveFilters(filters: FilterState): number {
  let count = 0;
  if (filters.search) count++;
  // Cores (contadas como 1 grupo mesmo com múltiplos arrays)
  const totalCores =
    (filters.colorGroups?.length ?? 0) +
    (filters.colorVariations?.length ?? 0) +
    (filters.colorNuances?.length ?? 0) +
    (filters.colors?.length ?? 0);
  if (totalCores > 0) count++;
  if (filters.categories?.length) count++;
  if (filters.suppliers?.length) count++;
  if (filters.publicoAlvo?.length) count++;
  if (filters.datasComemorativas?.length) count++;
  if (filters.endomarketing?.length) count++;
  if (filters.ramosAtividade?.length || filters.segmentosAtividade?.length) count++;
  // Materiais (contados como 1 grupo)
  const totalMateriais =
    (filters.materialGroups?.length ?? 0) +
    (filters.materialTypes?.length ?? 0) +
    (filters.materiais?.length ?? 0);
  if (totalMateriais > 0) count++;
  if (filters.techniques?.length) count++;
  if (filters.tags?.length) count++;
  if (filters.gender?.length) count++;
  if (filters.sizes?.length) count++;
  // BUG-SF-04 FIX: threshold era 500, correto é 9999 (sentinela de "sem limite superior")
  if (filters.priceRange?.[0] > 0 || filters.priceRange?.[1] < 9999) count++;
  if (filters.minStock > 0) count++;
  if (filters.inStock) count++;
  if (filters.isKit) count++;
  if (filters.featured) count++;
  if (filters.isNew) count++;
  if (filters.hasPersonalization) count++;
  if (filters.hasCommercialPackaging) count++;
  // Ordenação só conta como filtro ativo quando foge do padrão global "Mais Recentes".
  if (filters.sortBy && filters.sortBy !== 'newest') count++;
  return count;
}

export const countFilters = countActiveFilters;

/**
 * Gera um resumo legível dos filtros ativos de um preset.
 *
 * BUG-SF-05 FIX: sumário estava incompleto, faltando maioria dos tipos de filtro.
 */
export function summarizeFilters(filters: FilterState): string {
  const parts: string[] = [];
  if (filters.search) parts.push(`busca: "${filters.search}"`);
  const totalCores =
    (filters.colorGroups?.length ?? 0) +
    (filters.colorVariations?.length ?? 0) +
    (filters.colorNuances?.length ?? 0) +
    (filters.colors?.length ?? 0);
  if (totalCores > 0) parts.push(`${totalCores} cor${totalCores > 1 ? 'es' : ''}`);
  if (filters.categories?.length)
    parts.push(`${filters.categories.length} categoria${filters.categories.length > 1 ? 's' : ''}`);
  if (filters.suppliers?.length)
    parts.push(`${filters.suppliers.length} fornecedor${filters.suppliers.length > 1 ? 'es' : ''}`);
  if (filters.publicoAlvo?.length) parts.push(`público-alvo`);
  if (filters.datasComemorativas?.length) parts.push(`datas comemorativas`);
  if (filters.endomarketing?.length) parts.push(`endomarketing`);
  if (filters.ramosAtividade?.length || filters.segmentosAtividade?.length)
    parts.push(`nichos/segmentos`);
  const totalMateriais =
    (filters.materialGroups?.length ?? 0) +
    (filters.materialTypes?.length ?? 0) +
    (filters.materiais?.length ?? 0);
  if (totalMateriais > 0) parts.push(`${totalMateriais} material${totalMateriais > 1 ? 'is' : ''}`);
  if (filters.techniques?.length)
    parts.push(`${filters.techniques.length} técnica${filters.techniques.length > 1 ? 's' : ''}`);
  if (filters.tags?.length)
    parts.push(`${filters.tags.length} tag${filters.tags.length > 1 ? 's' : ''}`);
  if (filters.gender?.length)
    parts.push(`${filters.gender.length} gênero${filters.gender.length > 1 ? 's' : ''}`);
  if (filters.sizes?.length)
    parts.push(`${filters.sizes.length} tamanho${filters.sizes.length > 1 ? 's' : ''}`);
  // BUG-SF-04 FIX: threshold era 500, correto é 9999
  if (filters.priceRange?.[0] > 0 || filters.priceRange?.[1] < 9999) parts.push('faixa de preço');
  if (filters.minStock > 0) parts.push(`estoque ≥ ${filters.minStock}`);
  if (filters.inStock) parts.push('em estoque');
  if (filters.isKit) parts.push('kits');
  if (filters.featured) parts.push('destaques');
  if (filters.isNew) parts.push('novidades');
  if (filters.hasPersonalization) parts.push('personalizável');
  if (filters.hasCommercialPackaging) parts.push('embalagem nativa');
  if (filters.sortBy && filters.sortBy !== 'newest') parts.push(`ordenado por ${filters.sortBy}`);
  return parts.length > 0 ? parts.join(' · ') : 'Sem filtros';
}
