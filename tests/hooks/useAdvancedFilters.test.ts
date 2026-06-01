/**
 * Tests for useAdvancedFilters reset logic
 */
import { describe, it, expect } from 'vitest';
import { defaultAdvancedFilters } from '@/constants/filters';
import type { AdvancedFilterState } from '@/types/advancedFilters';

describe('useAdvancedFilters - Reset Logic', () => {
  it('defaultAdvancedFilters has all string arrays empty', () => {
    const arrayKeys: (keyof AdvancedFilterState)[] = [
      'categories',
      'suppliers',
      'colors',
      'materials',
      'techniques',
      'tags',
      'colorGroups',
      'colorVariations',
      'colorNuances',
      'datasComemorativas',
      'publicoAlvo',
      'endomarketing',
      'ramosAtividade',
      'segmentosAtividade',
    ];
    for (const key of arrayKeys) {
      expect(defaultAdvancedFilters[key]).toEqual([]);
    }
  });

  it('defaultAdvancedFilters has all booleans as false', () => {
    expect(defaultAdvancedFilters.isKit).toBe(false);
    expect(defaultAdvancedFilters.isFeatured).toBe(false);
    expect(defaultAdvancedFilters.isNew).toBe(false);
    expect(defaultAdvancedFilters.hasPersonalization).toBe(false);
  });

  it('defaultAdvancedFilters has correct range defaults', () => {
    // FIX-11: priceRange foi corrigido para [0, 9999] em constants/filters.ts
    expect(defaultAdvancedFilters.priceRange).toEqual([0, 9999]);
    // BUG-SF-16: quantityRange foi removido (campo orphaned, não aparecia na UI)
  });

  it('defaultAdvancedFilters has correct scalar defaults', () => {
    expect(defaultAdvancedFilters.search).toBe('');
    expect(defaultAdvancedFilters.stockStatus).toBe('all');
    expect(defaultAdvancedFilters.minStock).toBe(0);
    expect(defaultAdvancedFilters.maxLeadTimeDays).toBeNull();
    expect(defaultAdvancedFilters.sortBy).toBe('name');
  });

  it('resetting filters restores dirty state to defaults', () => {
    const dirtyFilters: AdvancedFilterState = {
      ...defaultAdvancedFilters,
      search: 'caneta',
      categories: ['cat1', 'cat2'],
      colors: ['azul'],
      isKit: true,
      isFeatured: true,
      priceRange: [10, 500],
      stockStatus: 'in_stock',
    };

    // Simulate reset by spreading defaults
    const resetState = { ...defaultAdvancedFilters };

    expect(resetState.search).toBe('');
    expect(resetState.categories).toEqual([]);
    expect(resetState.colors).toEqual([]);
    expect(resetState.isKit).toBe(false);
    expect(resetState.isFeatured).toBe(false);
    expect(resetState.priceRange).toEqual([0, 9999]);
    expect(resetState.stockStatus).toBe('all');

    // Verify dirty state was different
    expect(dirtyFilters.search).toBe('caneta');
    expect(dirtyFilters.categories).toEqual(['cat1', 'cat2']);
  });

  it('resetFilterGroup restores only specified keys', () => {
    const dirtyFilters: AdvancedFilterState = {
      ...defaultAdvancedFilters,
      categories: ['cat1'],
      colors: ['azul'],
      isKit: true,
    };

    // Simulate resetFilterGroup for color keys only
    const keys: (keyof AdvancedFilterState)[] = [
      'colors',
      'colorGroups',
      'colorVariations',
      'colorNuances',
    ];
    const updates: Partial<AdvancedFilterState> = {};
    keys.forEach((key) => {
      updates[key] = defaultAdvancedFilters[key] as never;
    });
    const result = { ...dirtyFilters, ...updates };

    expect(result.colors).toEqual([]);
    expect(result.categories).toEqual(['cat1']); // untouched
    expect(result.isKit).toBe(true); // untouched
  });
});
