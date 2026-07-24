import { describe, it, expect } from 'vitest';
import { sortByColorGroup, sortVariationsByColor, sortColorSummary } from '@/utils/colorSorting';

describe('sortByColorGroup', () => {
  it('should return empty array for empty input', () => {
    expect(sortByColorGroup([], (x) => x)).toEqual([]);
  });

  it('should sort Preto before Branco before Azul', () => {
    const colors = ['Azul', 'Branco', 'Preto'];
    const sorted = sortByColorGroup(colors, (c) => c);
    expect(sorted[0]).toBe('Preto');
    expect(sorted[1]).toBe('Branco');
    expect(sorted[2]).toBe('Azul');
  });

  it('should sort dark variants before light within same group', () => {
    const colors = ['Azul Claro', 'Azul Escuro', 'Azul'];
    const sorted = sortByColorGroup(colors, (c) => c);
    expect(sorted[0]).toBe('Azul Escuro');
    expect(sorted[2]).toBe('Azul Claro');
  });

  it('should handle unknown colors at end', () => {
    const colors = ['Azul', 'Xadrez', 'Preto'];
    const sorted = sortByColorGroup(colors, (c) => c);
    expect(sorted[sorted.length - 1]).toBe('Xadrez');
  });

  it('should handle hex-based luminance sorting', () => {
    const items = [
      { name: 'Azul', hex: '#5555FF' },  // lighter blue
      { name: 'Azul', hex: '#000044' },  // very dark blue
    ];
    const sorted = sortByColorGroup(items, (i) => i.name, (i) => i.hex);
    // Darker hex (lower luminance) should come first
    expect(sorted[0].hex).toBe('#000044');
  });

  it('should handle null/undefined color names', () => {
    const items = ['', 'Azul', ''];
    const sorted = sortByColorGroup(items, (c) => c);
    expect(sorted).toHaveLength(3);
  });

  it('should recognize Portuguese color names', () => {
    const colors = ['Amarelo', 'Vermelho', 'Verde', 'Roxo'];
    const sorted = sortByColorGroup(colors, (c) => c);
    // Verde(4) < Vermelho(7) < Amarelo(8) < Roxo(10)
    expect(sorted).toEqual(['Verde', 'Vermelho', 'Amarelo', 'Roxo']);
  });

  it('should recognize English color names', () => {
    const colors = ['Red', 'Blue', 'Green'];
    const sorted = sortByColorGroup(colors, (c) => c);
    // Green(4) < Blue(6) < Red(7)
    expect(sorted).toEqual(['Green', 'Blue', 'Red']);
  });
});

describe('sortVariationsByColor', () => {
  it('should return empty for empty array', () => {
    expect(sortVariationsByColor([])).toEqual([]);
  });

  it('should sort variations by color group', () => {
    const variations = [
      { color: { name: 'Vermelho', hex: '#FF0000' } },
      { color: { name: 'Preto', hex: '#000000' } },
    ];
    const sorted = sortVariationsByColor(variations);
    expect(sorted[0].color.name).toBe('Preto');
    expect(sorted[1].color.name).toBe('Vermelho');
  });
});

describe('sortColorSummary', () => {
  it('should return empty for empty array', () => {
    expect(sortColorSummary([])).toEqual([]);
  });

  it('should sort color summary items', () => {
    const colors = [
      { name: 'Branco', hex: '#FFFFFF' },
      { name: 'Preto', hex: '#000000' },
    ];
    const sorted = sortColorSummary(colors);
    expect(sorted[0].name).toBe('Preto');
  });
});
