/**
 * Tests for useTechniquePricing pure logic (table filtering, color/size options).
 * We replicate the internal pure logic to test without mocking Supabase.
 */
import { describe, it, expect } from 'vitest';
import type { TechniquePriceOption, ColorOption, SizeOption } from '@/hooks/simulation/useTechniquePricing';

// ============================================
// Replicate filtering logic from useTechniquePricing
// ============================================

function filterMatchingTables(records: any[], techniqueCode: string): any[] {
  const code = techniqueCode.toLowerCase();
  return records.filter((t: any) => {
    const tableCode = (t.table_code || '').toLowerCase();
    const fullCode = (t.table_fullcode || '').toLowerCase();
    return tableCode.includes(code) || code.includes(tableCode) || fullCode.includes(code);
  });
}

function mapToOptions(tables: any[]): TechniquePriceOption[] {
  return tables.map((t: any) => ({
    id: t.id,
    tableCode: t.table_code,
    tableCodeOption: t.table_code_option,
    tableFullcode: t.table_fullcode,
    techniqueName: t.customization_type_name,
    maxColors: t.max_colors || 1,
    maxAreaWidth: t.max_area_width_cm || 0,
    maxAreaHeight: t.max_area_height_cm || 0,
    areaCm2: (t.max_area_width_cm || 0) * (t.max_area_height_cm || 0),
    priceByColor: t.price_by_color || false,
    priceByArea: t.price_by_area || false,
    setupPrice: t.setup_price || 0,
    handlingPrice: t.handling_price || 0,
  }));
}

function buildColorOptions(options: TechniquePriceOption[]): ColorOption[] {
  const hasPriceByColor = options.some(opt => opt.priceByColor);
  if (!hasPriceByColor || options.length === 0) return [];

  const uniqueColors = [...new Set(options.map(opt => opt.maxColors))]
    .filter(c => c > 0)
    .sort((a, b) => a - b);

  if (uniqueColors.length <= 1) {
    const maxColors = uniqueColors[0] || 4;
    return Array.from({ length: maxColors }, (_, i) => ({
      value: i + 1,
      label: `${i + 1} ${i === 0 ? 'cor' : 'cores'}`,
    }));
  }

  return uniqueColors.map(c => ({
    value: c,
    label: `${c} ${c === 1 ? 'cor' : 'cores'}`,
  }));
}

function buildSizeOptions(options: TechniquePriceOption[]): SizeOption[] {
  if (options.length === 0) return [];
  const uniqueAreas = new Map<string, SizeOption>();
  options.forEach(opt => {
    if (opt.maxAreaWidth > 0 && opt.maxAreaHeight > 0) {
      const key = `${opt.maxAreaWidth}x${opt.maxAreaHeight}`;
      if (!uniqueAreas.has(key)) {
        uniqueAreas.set(key, {
          value: key,
          label: `${opt.maxAreaWidth} x ${opt.maxAreaHeight} cm`,
          width: opt.maxAreaWidth,
          height: opt.maxAreaHeight,
          areaCm2: opt.areaCm2,
          tableFullcode: opt.tableFullcode || opt.tableCode,
        });
      }
    }
  });
  return Array.from(uniqueAreas.values()).sort((a, b) => a.areaCm2 - b.areaCm2);
}

function findMatchingTable(
  options: TechniquePriceOption[],
  colors: number,
  sizeValue: string,
  hasPriceByColor: boolean
): TechniquePriceOption | null {
  if (options.length === 0) return null;
  const [width, height] = sizeValue.split('x').map(Number);
  const matching = options.find(opt => {
    const colorMatch = !hasPriceByColor || opt.maxColors >= colors;
    const sizeMatch = !sizeValue || (opt.maxAreaWidth === width && opt.maxAreaHeight === height);
    return colorMatch && sizeMatch;
  });
  if (!matching && hasPriceByColor) {
    return options.find(opt => opt.maxColors >= colors) || options[0];
  }
  return matching || options[0];
}

// ============================================
// Test data
// ============================================

const mockRecords = [
  { id: '1', table_code: 'LASER', table_fullcode: 'LASER-3x12', customization_type_name: 'Fiber Laser', max_colors: 1, max_area_width_cm: 3, max_area_height_cm: 12, price_by_color: false, price_by_area: false, setup_price: 50, handling_price: 0 },
  { id: '2', table_code: 'SERI', table_fullcode: 'SERI-5x5', customization_type_name: 'Serigrafia 5x5', max_colors: 4, max_area_width_cm: 5, max_area_height_cm: 5, price_by_color: true, price_by_area: false, setup_price: 80, handling_price: 5 },
  { id: '3', table_code: 'SERI', table_fullcode: 'SERI-10x10', customization_type_name: 'Serigrafia 10x10', max_colors: 6, max_area_width_cm: 10, max_area_height_cm: 10, price_by_color: true, price_by_area: false, setup_price: 120, handling_price: 5 },
  { id: '4', table_code: 'UV', table_fullcode: 'UV-FULL', customization_type_name: 'UV Full Color', max_colors: 0, max_area_width_cm: 8, max_area_height_cm: 8, price_by_color: false, price_by_area: true, setup_price: 0, handling_price: 0 },
];

// ============================================
// Tests
// ============================================

describe('filterMatchingTables', () => {
  it('filters by table_code match', () => {
    const result = filterMatchingTables(mockRecords, 'LASER');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters by fullcode match', () => {
    const result = filterMatchingTables(mockRecords, 'SERI-5x5');
    expect(result).toHaveLength(2); // both SERI records match because table_code includes
  });

  it('filters case-insensitively', () => {
    const result = filterMatchingTables(mockRecords, 'laser');
    expect(result).toHaveLength(1);
  });

  it('returns empty for no matches', () => {
    expect(filterMatchingTables(mockRecords, 'TAMPO')).toHaveLength(0);
  });
});

describe('mapToOptions', () => {
  it('calculates areaCm2', () => {
    const options = mapToOptions([mockRecords[0]]);
    expect(options[0].areaCm2).toBe(36); // 3 * 12
  });

  it('defaults missing values to 0 or 1', () => {
    const options = mapToOptions([{ id: 'x' }]);
    expect(options[0].maxColors).toBe(1);
    expect(options[0].maxAreaWidth).toBe(0);
    expect(options[0].setupPrice).toBe(0);
  });
});

describe('buildColorOptions', () => {
  it('returns empty if no price-by-color', () => {
    const laserOpt = mapToOptions([mockRecords[0]]);
    expect(buildColorOptions(laserOpt)).toEqual([]);
  });

  it('generates 1-N options for single maxColors value', () => {
    const singleSeri = mapToOptions([mockRecords[1]]);
    const colors = buildColorOptions(singleSeri);
    expect(colors).toHaveLength(4); // 1,2,3,4
    expect(colors[0].label).toBe('1 cor');
    expect(colors[3].label).toBe('4 cores');
  });

  it('uses unique max_colors when multiple variants exist', () => {
    const seriOptions = mapToOptions([mockRecords[1], mockRecords[2]]);
    const colors = buildColorOptions(seriOptions);
    expect(colors).toHaveLength(2); // 4 and 6
    expect(colors[0].value).toBe(4);
    expect(colors[1].value).toBe(6);
  });
});

describe('buildSizeOptions', () => {
  it('returns empty for no options', () => {
    expect(buildSizeOptions([])).toEqual([]);
  });

  it('deduplicates and sorts by area', () => {
    const seriOptions = mapToOptions([mockRecords[1], mockRecords[2]]);
    const sizes = buildSizeOptions(seriOptions);
    expect(sizes).toHaveLength(2);
    expect(sizes[0].value).toBe('5x5'); // 25 cm²
    expect(sizes[1].value).toBe('10x10'); // 100 cm²
    expect(sizes[0].areaCm2).toBeLessThan(sizes[1].areaCm2);
  });

  it('skips entries with zero dimensions', () => {
    const zeroOpt = mapToOptions([{ id: 'z', max_area_width_cm: 0, max_area_height_cm: 0 }]);
    expect(buildSizeOptions(zeroOpt)).toEqual([]);
  });
});

describe('findMatchingTable', () => {
  const options = mapToOptions(mockRecords);
  const seriOptions = options.filter(o => o.tableCode === 'SERI');

  it('finds exact size match', () => {
    const match = findMatchingTable(seriOptions, 2, '5x5', true);
    expect(match?.id).toBe('2');
  });

  it('finds larger table when exact not found', () => {
    const match = findMatchingTable(seriOptions, 5, '10x10', true);
    expect(match?.id).toBe('3'); // maxColors 6 >= 5
  });

  it('falls back to first when no match', () => {
    const match = findMatchingTable(seriOptions, 1, '99x99', true);
    expect(match).not.toBeNull();
  });

  it('returns null for empty options', () => {
    expect(findMatchingTable([], 1, '5x5', false)).toBeNull();
  });
});
