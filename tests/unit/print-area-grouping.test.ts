/**
 * Unit tests for src/lib/print-area-grouping.ts
 *
 * Tests the hierarchical grouping logic (Component → Location → Techniques),
 * deduplication, sorting, filtering, counters, summary, and largest-area detection.
 */
import { describe, it, expect } from 'vitest';
import type { PrintAreaWithTechniques } from '@/types/gravacao';
import type { TecnicaSimples } from '@/types/gravacao';
import {
  groupPrintAreasByComponent,
  getUniqueTechniques,
  filterGroupsByTechnique,
  filterGroupsByComponent,
  flattenTechniques,
  countTotalAreas,
  countTotalLocations,
  countTotalComponents,
  summarizeGroups,
  findLargestArea,
} from '@/lib/print-area-grouping';

// ============================================
// FIXTURES
// ============================================

const tech = (codigo: string, nome = 'Tech'): TecnicaSimples => ({ id: codigo, nome, codigo });

const area = (overrides: Partial<PrintAreaWithTechniques> = {}): PrintAreaWithTechniques => ({
  area_id: 'a1',
  area_code: 'AC1',
  area_name: 'Frente',
  component_name: null,
  location_name: null,
  max_width: 10,
  max_height: 5,
  unit: 'cm',
  shape: 'rectangle',
  is_curved: false,
  is_primary: true,
  display_order: 1,
  techniques: [tech('SERIGRAFIA')],
  ...overrides,
});

// ============================================
// groupPrintAreasByComponent
// ============================================

describe('groupPrintAreasByComponent', () => {
  it('returns empty array for empty input', () => {
    expect(groupPrintAreasByComponent([])).toEqual([]);
  });

  it('groups area without component_name under "Produto"', () => {
    const result = groupPrintAreasByComponent([area()]);
    expect(result).toHaveLength(1);
    expect(result[0].componentName).toBe('Produto');
    expect(result[0].componentCode).toBe('produto');
  });

  it('uses location_name when provided', () => {
    const result = groupPrintAreasByComponent([area({ location_name: 'Frente' })]);
    expect(result[0].locations[0].locationName).toBe('Frente');
    expect(result[0].locations[0].locationCode).toBe('frente');
  });

  it('falls back to area_name when location_name is null', () => {
    const result = groupPrintAreasByComponent([area({ location_name: null, area_name: 'Costas' })]);
    expect(result[0].locations[0].locationName).toBe('Costas');
  });

  it('computes areaCm2 as width × height rounded to 2 decimal places', () => {
    const result = groupPrintAreasByComponent([area({ max_width: 7.5, max_height: 3.3 })]);
    const t = result[0].locations[0].techniques[0];
    expect(t.areaCm2).toBe(24.75); // 7.5 * 3.3 = 24.75
  });

  it('sets areaCm2 to null when max_width is 0', () => {
    const result = groupPrintAreasByComponent([area({ max_width: 0, max_height: 5 })]);
    expect(result[0].locations[0].techniques[0].areaCm2).toBeNull();
  });

  it('sets maxColors to null (downstream responsibility)', () => {
    const result = groupPrintAreasByComponent([area()]);
    expect(result[0].locations[0].techniques[0].maxColors).toBeNull();
  });

  it('sets servCode equal to techniqueCode', () => {
    const result = groupPrintAreasByComponent([area({ techniques: [tech('PAD')] })]);
    const t = result[0].locations[0].techniques[0];
    expect(t.servCode).toBe(t.techniqueCode);
    expect(t.servCode).toBe('PAD');
  });

  it('deduplicates same techniqueCode + area_id in the same location', () => {
    const dupArea = area({ techniques: [tech('SERIGRAFIA'), tech('SERIGRAFIA')] });
    const result = groupPrintAreasByComponent([dupArea]);
    expect(result[0].locations[0].techniques).toHaveLength(1);
  });

  it('does NOT deduplicate same code for different area_ids', () => {
    const a1 = area({ area_id: 'a1', location_name: 'Frente', techniques: [tech('SERIGRAFIA')] });
    const a2 = area({ area_id: 'a2', location_name: 'Frente', techniques: [tech('SERIGRAFIA')] });
    const result = groupPrintAreasByComponent([a1, a2]);
    expect(result[0].locations[0].techniques).toHaveLength(2);
  });

  it('puts "Produto" component first regardless of insertion order', () => {
    const branded = area({ component_name: 'Alça', location_name: 'L1', techniques: [tech('PAD')] });
    const default_ = area({ component_name: null, location_name: 'L2', techniques: [tech('SERIGRAFIA')] });
    const result = groupPrintAreasByComponent([branded, default_]);
    expect(result[0].componentName).toBe('Produto');
    expect(result[1].componentName).toBe('Alça');
  });

  it('sorts remaining components alphabetically after "Produto"', () => {
    const c = (name: string) => area({ component_name: name, area_id: name, location_name: name, techniques: [tech('X')] });
    const result = groupPrintAreasByComponent([c('Zíper'), c('Bolso'), c('Alça')]);
    expect(result.map((g) => g.componentName)).toEqual(['Alça', 'Bolso', 'Zíper']);
  });

  it('sorts locations so primary areas come first', () => {
    const secondary = area({
      area_id: 'sec',
      location_name: 'Costas',
      is_primary: false,
      techniques: [tech('PAD')],
    });
    const primary = area({
      area_id: 'pri',
      location_name: 'Frente',
      is_primary: true,
      techniques: [tech('SERIGRAFIA')],
    });
    const result = groupPrintAreasByComponent([secondary, primary]);
    expect(result[0].locations[0].locationName).toBe('Frente');
    expect(result[0].locations[1].locationName).toBe('Costas');
  });

  it('preserves isCurved and isPrimary flags on output techniques', () => {
    const curved = area({ is_curved: true, is_primary: false });
    const result = groupPrintAreasByComponent([curved]);
    const t = result[0].locations[0].techniques[0];
    expect(t.isCurved).toBe(true);
    expect(t.isPrimary).toBe(false);
  });

  it('locationCode converts spaces to dashes and lowercases', () => {
    const result = groupPrintAreasByComponent([area({ location_name: 'Manga Esquerda' })]);
    expect(result[0].locations[0].locationCode).toBe('manga-esquerda');
  });

  it('componentCode converts spaces to dashes and lowercases', () => {
    const result = groupPrintAreasByComponent([area({ component_name: 'Corpo Frontal' })]);
    expect(result[0].componentCode).toBe('corpo-frontal');
  });
});

// ============================================
// getUniqueTechniques
// ============================================

describe('getUniqueTechniques', () => {
  it('returns empty array for empty groups', () => {
    expect(getUniqueTechniques([])).toEqual([]);
  });

  it('returns unique technique codes sorted alphabetically', () => {
    const areas = [
      area({ area_id: 'a1', location_name: 'L1', techniques: [tech('SERIGRAFIA'), tech('PAD')] }),
      area({ area_id: 'a2', location_name: 'L2', techniques: [tech('BORDADO'), tech('PAD')] }),
    ];
    const groups = groupPrintAreasByComponent(areas);
    expect(getUniqueTechniques(groups)).toEqual(['BORDADO', 'PAD', 'SERIGRAFIA']);
  });

  it('deduplicates codes that appear in multiple components', () => {
    const a1 = area({ area_id: 'a1', component_name: 'Comp A', location_name: 'L1', techniques: [tech('PAD')] });
    const a2 = area({ area_id: 'a2', component_name: 'Comp B', location_name: 'L1', techniques: [tech('PAD')] });
    const groups = groupPrintAreasByComponent([a1, a2]);
    expect(getUniqueTechniques(groups)).toEqual(['PAD']);
  });
});

// ============================================
// filterGroupsByTechnique
// ============================================

describe('filterGroupsByTechnique', () => {
  it('keeps only locations that have the specified technique', () => {
    const a1 = area({ area_id: 'a1', location_name: 'Frente', techniques: [tech('SERIGRAFIA')] });
    const a2 = area({ area_id: 'a2', location_name: 'Costas', techniques: [tech('PAD')] });
    const groups = groupPrintAreasByComponent([a1, a2]);

    const filtered = filterGroupsByTechnique(groups, 'SERIGRAFIA');
    expect(filtered[0].locations).toHaveLength(1);
    expect(filtered[0].locations[0].locationName).toBe('Frente');
  });

  it('removes groups entirely when no locations match', () => {
    const a1 = area({ area_id: 'a1', component_name: 'Comp A', techniques: [tech('PAD')] });
    const a2 = area({ area_id: 'a2', component_name: 'Comp B', techniques: [tech('SERIGRAFIA')] });
    const groups = groupPrintAreasByComponent([a1, a2]);

    const filtered = filterGroupsByTechnique(groups, 'BORDADO');
    expect(filtered).toHaveLength(0);
  });

  it('returns all groups when every location has that technique', () => {
    const a1 = area({ area_id: 'a1', location_name: 'L1', techniques: [tech('SERIGRAFIA')] });
    const a2 = area({ area_id: 'a2', location_name: 'L2', techniques: [tech('SERIGRAFIA')] });
    const groups = groupPrintAreasByComponent([a1, a2]);

    const filtered = filterGroupsByTechnique(groups, 'SERIGRAFIA');
    expect(filtered[0].locations).toHaveLength(2);
  });
});

// ============================================
// filterGroupsByComponent
// ============================================

describe('filterGroupsByComponent', () => {
  it('returns only the matching component', () => {
    const a1 = area({ area_id: 'a1', component_name: 'Alça' });
    const a2 = area({ area_id: 'a2', component_name: 'Bolso' });
    const groups = groupPrintAreasByComponent([a1, a2]);

    const filtered = filterGroupsByComponent(groups, 'Alça');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].componentName).toBe('Alça');
  });

  it('returns empty array when component does not exist', () => {
    const groups = groupPrintAreasByComponent([area({ component_name: 'Alça' })]);
    expect(filterGroupsByComponent(groups, 'Zíper')).toEqual([]);
  });

  it('matches "Produto" fallback component', () => {
    const groups = groupPrintAreasByComponent([area({ component_name: null })]);
    const filtered = filterGroupsByComponent(groups, 'Produto');
    expect(filtered).toHaveLength(1);
  });
});

// ============================================
// flattenTechniques
// ============================================

describe('flattenTechniques', () => {
  it('returns empty array for empty groups', () => {
    expect(flattenTechniques([])).toEqual([]);
  });

  it('flattens hierarchy preserving component and location context', () => {
    const a1 = area({
      area_id: 'a1',
      component_name: 'Corpo',
      location_name: 'Frente',
      techniques: [tech('PAD')],
      max_width: 10,
      max_height: 5,
      is_primary: true,
      is_curved: false,
    });
    const groups = groupPrintAreasByComponent([a1]);
    const flat = flattenTechniques(groups);

    expect(flat).toHaveLength(1);
    expect(flat[0]).toMatchObject({
      componentName: 'Corpo',
      componentCode: 'corpo',
      locationName: 'Frente',
      locationCode: 'frente',
      techniqueCode: 'PAD',
      areaName: 'Frente',
      maxWidth: 10,
      maxHeight: 5,
      areaCm2: 50,
      isPrimary: true,
      isCurved: false,
    });
  });

  it('produces one entry per technique per area', () => {
    const multi = area({ area_id: 'a1', techniques: [tech('PAD'), tech('SERIGRAFIA')] });
    const groups = groupPrintAreasByComponent([multi]);
    expect(flattenTechniques(groups)).toHaveLength(2);
  });
});

// ============================================
// countTotalAreas / Locations / Components
// ============================================

describe('countTotalAreas', () => {
  it('returns 0 for empty groups', () => {
    expect(countTotalAreas([])).toBe(0);
  });

  it('sums all technique entries across all groups and locations', () => {
    const a1 = area({ area_id: 'a1', location_name: 'L1', techniques: [tech('A'), tech('B')] });
    const a2 = area({ area_id: 'a2', location_name: 'L2', techniques: [tech('C')] });
    const groups = groupPrintAreasByComponent([a1, a2]);
    expect(countTotalAreas(groups)).toBe(3);
  });
});

describe('countTotalLocations', () => {
  it('returns 0 for empty groups', () => {
    expect(countTotalLocations([])).toBe(0);
  });

  it('counts distinct locations across all components', () => {
    const a1 = area({ area_id: 'a1', component_name: 'CompA', location_name: 'L1', techniques: [tech('X')] });
    const a2 = area({ area_id: 'a2', component_name: 'CompA', location_name: 'L2', techniques: [tech('X')] });
    const a3 = area({ area_id: 'a3', component_name: 'CompB', location_name: 'L1', techniques: [tech('X')] });
    const groups = groupPrintAreasByComponent([a1, a2, a3]);
    expect(countTotalLocations(groups)).toBe(3); // 2 in CompA + 1 in CompB
  });
});

describe('countTotalComponents', () => {
  it('returns 0 for empty groups', () => {
    expect(countTotalComponents([])).toBe(0);
  });

  it('counts each distinct component once', () => {
    const a1 = area({ area_id: 'a1', component_name: 'A', techniques: [tech('X')] });
    const a2 = area({ area_id: 'a2', component_name: 'B', techniques: [tech('X')] });
    const groups = groupPrintAreasByComponent([a1, a2]);
    expect(countTotalComponents(groups)).toBe(2);
  });
});

// ============================================
// summarizeGroups
// ============================================

describe('summarizeGroups', () => {
  it('returns zeroed summary for empty groups', () => {
    const summary = summarizeGroups([]);
    expect(summary).toEqual({
      totalComponents: 0,
      totalLocations: 0,
      totalTechniqueSlots: 0,
      uniqueTechniques: [],
      hasPrimaryArea: false,
      hasCurvedArea: false,
      maxAreaCm2: null,
      primaryLocations: [],
    });
  });

  it('detects hasPrimaryArea = true when at least one isPrimary', () => {
    const groups = groupPrintAreasByComponent([area({ is_primary: true })]);
    expect(summarizeGroups(groups).hasPrimaryArea).toBe(true);
  });

  it('sets hasPrimaryArea = false when no area is primary', () => {
    const groups = groupPrintAreasByComponent([area({ is_primary: false })]);
    expect(summarizeGroups(groups).hasPrimaryArea).toBe(false);
  });

  it('detects hasCurvedArea = true when at least one isCurved', () => {
    const groups = groupPrintAreasByComponent([area({ is_curved: true })]);
    expect(summarizeGroups(groups).hasCurvedArea).toBe(true);
  });

  it('collects primary location names without duplicates', () => {
    const a1 = area({ area_id: 'a1', location_name: 'Frente', is_primary: true, techniques: [tech('A')] });
    const a2 = area({ area_id: 'a2', location_name: 'Frente', is_primary: true, techniques: [tech('B')] });
    const groups = groupPrintAreasByComponent([a1, a2]);
    expect(summarizeGroups(groups).primaryLocations).toEqual(['Frente']);
  });

  it('sets maxAreaCm2 to the largest areaCm2 among all techniques', () => {
    const a1 = area({ area_id: 'a1', location_name: 'L1', max_width: 5, max_height: 5, techniques: [tech('A')] });
    const a2 = area({ area_id: 'a2', location_name: 'L2', max_width: 10, max_height: 10, techniques: [tech('B')] });
    const groups = groupPrintAreasByComponent([a1, a2]);
    expect(summarizeGroups(groups).maxAreaCm2).toBe(100);
  });

  it('maxAreaCm2 is null when all areas have zero dimensions', () => {
    const groups = groupPrintAreasByComponent([area({ max_width: 0, max_height: 0 })]);
    expect(summarizeGroups(groups).maxAreaCm2).toBeNull();
  });

  it('totalTechniqueSlots counts all technique entries', () => {
    const a1 = area({ area_id: 'a1', location_name: 'L1', techniques: [tech('A'), tech('B')] });
    const a2 = area({ area_id: 'a2', location_name: 'L2', techniques: [tech('C')] });
    const groups = groupPrintAreasByComponent([a1, a2]);
    expect(summarizeGroups(groups).totalTechniqueSlots).toBe(3);
  });

  it('uniqueTechniques is sorted and deduplicated', () => {
    const a1 = area({ area_id: 'a1', location_name: 'L1', techniques: [tech('SERIGRAFIA'), tech('PAD')] });
    const a2 = area({ area_id: 'a2', location_name: 'L2', techniques: [tech('PAD'), tech('BORDADO')] });
    const groups = groupPrintAreasByComponent([a1, a2]);
    expect(summarizeGroups(groups).uniqueTechniques).toEqual(['BORDADO', 'PAD', 'SERIGRAFIA']);
  });
});

// ============================================
// findLargestArea
// ============================================

describe('findLargestArea', () => {
  it('returns null for empty groups', () => {
    expect(findLargestArea([])).toBeNull();
  });

  it('returns null when all areas have null areaCm2 (zero dimensions)', () => {
    const groups = groupPrintAreasByComponent([area({ max_width: 0, max_height: 0 })]);
    expect(findLargestArea(groups)).toBeNull();
  });

  it('returns the area with the largest areaCm2', () => {
    const small = area({ area_id: 'a1', location_name: 'L1', max_width: 5, max_height: 5, techniques: [tech('A')] });
    const large = area({ area_id: 'a2', location_name: 'L2', max_width: 10, max_height: 10, techniques: [tech('B')] });
    const groups = groupPrintAreasByComponent([small, large]);

    const result = findLargestArea(groups);
    expect(result).not.toBeNull();
    expect(result!.areaCm2).toBe(100);
    expect(result!.locationName).toBe('L2');
  });

  it('includes the correct componentName in the result', () => {
    const a1 = area({ area_id: 'a1', component_name: 'Corpo', location_name: 'Frente', max_width: 20, max_height: 15, techniques: [tech('X')] });
    const groups = groupPrintAreasByComponent([a1]);

    const result = findLargestArea(groups);
    expect(result!.componentName).toBe('Corpo');
    expect(result!.areaCm2).toBe(300);
  });

  it('picks the single largest when multiple groups have areas with dimensions', () => {
    const areas = [
      area({ area_id: 'a1', component_name: 'A', location_name: 'L1', max_width: 8, max_height: 8, techniques: [tech('X')] }),
      area({ area_id: 'a2', component_name: 'B', location_name: 'L1', max_width: 12, max_height: 3, techniques: [tech('X')] }),
      area({ area_id: 'a3', component_name: 'C', location_name: 'L1', max_width: 6, max_height: 11, techniques: [tech('X')] }),
    ];
    const groups = groupPrintAreasByComponent(areas);
    const result = findLargestArea(groups);
    // 8*8=64, 12*3=36, 6*11=66 → largest is C/L1 with 66
    expect(result!.areaCm2).toBe(66);
    expect(result!.componentName).toBe('C');
  });
});
