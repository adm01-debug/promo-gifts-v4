/**
 * applyVoiceFilters — pure function that merges a VoiceAgentAction filter payload
 * into an existing FilterState without touching React state.
 *
 * Extracted from FiltersPage.handleVoiceAction so the mapping logic can be unit-tested
 * independently of the React component lifecycle.
 */
import type { FilterState } from '@/components/filters/FilterPanel';
import type { VoiceAgentAction } from '@/hooks/voice/types';

type VoiceFilters = NonNullable<NonNullable<VoiceAgentAction['data']>['filters']>;

export function applyVoiceFilters(prev: FilterState, f: VoiceFilters): FilterState {
  const next = { ...prev };

  if (f.color) next.colors = [...new Set([...prev.colors, f.color])];
  if (f.category) next.categories = [...new Set([...prev.categories, f.category])];
  if (f.material) next.materiais = [...new Set([...prev.materiais, f.material])];

  // BUG-VOZ-PRICE FIX: apply min AND max atomically so both survive in a single command.
  const hasMin = typeof f.minPrice === 'number';
  const hasMax = typeof f.maxPrice === 'number';
  if (hasMin || hasMax) {
    next.priceRange = [
      hasMin ? (f.minPrice as number) : next.priceRange[0],
      hasMax ? (f.maxPrice as number) : next.priceRange[1],
    ];
  }

  if (f.inStock) next.inStock = true;
  if (f.isKit) next.isKit = true;
  if (f.gender) next.gender = [...new Set([...prev.gender, f.gender])];
  if (f.featured) next.featured = true;
  if (f.isNew) next.isNew = true;
  if (f.hasPersonalization) next.hasPersonalization = true;
  if (f.onSale) next.onSale = true;
  if (typeof f.minStock === 'number' && f.minStock > 0) next.minStock = f.minStock;
  if (f.publicoAlvo) next.publicoAlvo = [...new Set([...prev.publicoAlvo, f.publicoAlvo])];
  if (f.endomarketing) next.endomarketing = [...new Set([...prev.endomarketing, 'endomarketing'])];

  return next;
}
