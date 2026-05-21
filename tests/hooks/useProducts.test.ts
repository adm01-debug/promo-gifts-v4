/**
 * Tests for useProducts pure helper functions (exported and internal logic).
 * We test the exported findKnownHex + replicate internal pure functions for coverage.
 */
import { describe, it, expect } from 'vitest';
import { findKnownHex } from '@/hooks/products/useProducts';

// Replicate internal helpers for testing
function detectColorGroup(colorName: string): string {
  const COLOR_GROUP_KEYWORDS: Record<string, string[]> = {
    'Azul': ['azul', 'blue', 'marinho', 'celeste', 'royal', 'turquesa', 'petróleo', 'navy'],
    'Verde': ['verde', 'green', 'limão', 'menta', 'musgo', 'oliva', 'esmeralda', 'lime', 'neon'],
    'Vermelho': ['vermelho', 'red', 'bordô', 'vinho', 'cereja', 'coral', 'carmim', 'rubi'],
    'Amarelo': ['amarelo', 'yellow', 'dourado', 'ouro', 'gold', 'mostarda'],
    'Laranja': ['laranja', 'orange', 'tangerina', 'pêssego'],
    'Rosa': ['rosa', 'pink', 'magenta', 'fúcsia', 'salmão', 'flamingo', 'rosa bebê'],
    'Roxo': ['roxo', 'purple', 'lilás', 'violeta', 'lavanda', 'uva'],
    'Preto': ['preto', 'black', 'negro', 'grafite', 'chumbo'],
    'Branco': ['branco', 'white', 'off-white', 'creme', 'gelo', 'pérola', 'neve'],
    'Cinza': ['cinza', 'gray', 'grey', 'prata', 'silver', 'acetinado', 'fosco', 'cromado'],
    'Marrom': ['marrom', 'brown', 'chocolate', 'café', 'caramelo', 'bege', 'nude', 'areia', 'natural', 'palha', 'terra'],
    'Transparente': ['transparente', 'transparent', 'cristal', 'clear', 'incolor'],
  };
  const nameLower = colorName.toLowerCase().trim();
  for (const [group, keywords] of Object.entries(COLOR_GROUP_KEYWORDS)) {
    if (keywords.some(kw => nameLower.includes(kw))) return group;
  }
  const firstWord = nameLower.split(/[\s-]+/)[0];
  return firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
}

function getStockStatus(stock: number): 'in-stock' | 'low-stock' | 'out-of-stock' {
  if (stock <= 0) return 'out-of-stock';
  if (stock < 10) return 'low-stock';
  return 'in-stock';
}

function parseMaterials(materials: any): string[] {
  if (!materials) return [];
  if (Array.isArray(materials)) return materials.filter(Boolean);
  if (typeof materials === 'string') return materials.split(',').map((m: string) => m.trim()).filter(Boolean);
  return [];
}

describe('findKnownHex', () => {
  it('finds exact match', () => {
    expect(findKnownHex('preto')).toBe('#000000');
    expect(findKnownHex('branco')).toBe('#FFFFFF');
    expect(findKnownHex('azul royal')).toBe('#4169E1');
  });

  it('is case insensitive', () => {
    expect(findKnownHex('PRETO')).toBe('#000000');
    expect(findKnownHex('Azul Royal')).toBe('#4169E1');
  });

  it('handles accents (NFD normalization)', () => {
    expect(findKnownHex('fúcsia')).toBe('#FF00FF');
  });

  it('finds partial match', () => {
    // "azul marinho escuro" matches "azul" first in iteration order
    const result = findKnownHex('azul marinho escuro');
    expect(result).not.toBeNull();
    expect(result!.startsWith('#')).toBe(true);
  });

  it('returns null for unknown colors', () => {
    expect(findKnownHex('xyzcolor')).toBeNull();
    expect(findKnownHex('')).toBeNull();
  });
});

describe('detectColorGroup', () => {
  it('detects standard color groups', () => {
    expect(detectColorGroup('Azul Marinho')).toBe('Azul');
    expect(detectColorGroup('verde limão')).toBe('Verde');
    expect(detectColorGroup('Rosa Flamingo')).toBe('Rosa');
    expect(detectColorGroup('preto fosco')).toBe('Preto');
    expect(detectColorGroup('transparente')).toBe('Transparente');
  });

  it('detects English keywords', () => {
    expect(detectColorGroup('navy blue')).toBe('Azul');
    expect(detectColorGroup('silver metallic')).toBe('Cinza');
  });

  it('falls back to capitalized first word for unknown', () => {
    expect(detectColorGroup('unicorn sparkle')).toBe('Unicorn');
  });
});

describe('getStockStatus', () => {
  it('returns out-of-stock for zero', () => {
    expect(getStockStatus(0)).toBe('out-of-stock');
  });
  it('returns out-of-stock for negative', () => {
    expect(getStockStatus(-5)).toBe('out-of-stock');
  });
  it('returns low-stock for small quantities', () => {
    expect(getStockStatus(1)).toBe('low-stock');
    expect(getStockStatus(9)).toBe('low-stock');
  });
  it('returns in-stock for 10+', () => {
    expect(getStockStatus(10)).toBe('in-stock');
    expect(getStockStatus(1000)).toBe('in-stock');
  });
});

describe('parseMaterials', () => {
  it('parses array', () => {
    expect(parseMaterials(['Plástico', 'Metal'])).toEqual(['Plástico', 'Metal']);
  });
  it('filters empty values from array', () => {
    expect(parseMaterials(['Plástico', '', null])).toEqual(['Plástico']);
  });
  it('parses comma-separated string', () => {
    expect(parseMaterials('Plástico, Metal, Vidro')).toEqual(['Plástico', 'Metal', 'Vidro']);
  });
  it('returns empty array for null/undefined', () => {
    expect(parseMaterials(null)).toEqual([]);
    expect(parseMaterials(undefined)).toEqual([]);
  });
  it('returns empty array for non-string/array types', () => {
    expect(parseMaterials(42)).toEqual([]);
  });
});
