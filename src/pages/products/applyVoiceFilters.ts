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
  // FIX-11: clamp to ≥0 — voice agent may produce negative values from misrecognition.
  // FIX-14: use Number.isFinite() — typeof NaN === 'number' would corrupt priceRange with NaN/Infinity.
  // FIX-18: auto-swap when result is inverted (e.g. new maxPrice < inherited minPrice).
  //   Exception: [lo, 9999] where lo > 9999 is valid — 9999 is the sentinel for "no upper bound".
  const PRICE_SENTINEL = 9999;
  const hasMin = Number.isFinite(f.minPrice);
  const hasMax = Number.isFinite(f.maxPrice);
  if (hasMin || hasMax) {
    const rawMin = hasMin ? Number(f.minPrice) : next.priceRange[0];
    const rawMax = hasMax ? Number(f.maxPrice) : next.priceRange[1];
    const lo = Math.max(0, rawMin);
    const hi = Math.max(0, rawMax);
    next.priceRange = lo > hi && hi !== PRICE_SENTINEL ? [hi, lo] : [lo, hi];
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
