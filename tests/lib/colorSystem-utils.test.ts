import { describe, it, expect } from 'vitest';
import {
  findGroupBySlug, findVariationBySlug,
  formatColorName, isLightColor,
} from '@/hooks/products/useColorSystem';
import type { ColorGroup } from '@/hooks/products/useColorSystem';

const mockGroup: ColorGroup = {
  id: '1',
  name: 'Azul',
  slug: 'azul',
  hex_code: '#0000FF',
  internal_code: 'AZ',
  variations: [
    { id: 'v1', name: 'Azul Claro', slug: 'azul-claro', hex_code: '#ADD8E6', internal_code: 'AZC', group_id: '1' },
    { id: 'v2', name: 'Azul Escuro', slug: 'azul-escuro', hex_code: '#00008B', internal_code: 'AZE', group_id: '1' },
  ],
};

const mockGroups: ColorGroup[] = [
  mockGroup,
  { id: '2', name: 'Vermelho', slug: 'vermelho', hex_code: '#FF0000', internal_code: 'VM', variations: [] },
];

describe('findGroupBySlug', () => {
  it('finds group by slug', () => {
    expect(findGroupBySlug(mockGroups, 'azul')?.name).toBe('Azul');
  });
  it('returns undefined for unknown slug', () => {
    expect(findGroupBySlug(mockGroups, 'roxo')).toBeUndefined();
  });
});

describe('findVariationBySlug', () => {
  it('finds variation within group', () => {
    expect(findVariationBySlug(mockGroup, 'azul-claro')?.name).toBe('Azul Claro');
  });
  it('returns undefined for unknown variation', () => {
    expect(findVariationBySlug(mockGroup, 'azul-neon')).toBeUndefined();
  });
});

describe('formatColorName', () => {
  it('returns just variation name without nuance', () => {
    expect(formatColorName('Azul Claro')).toBe('Azul Claro');
  });
  it('appends nuance name', () => {
    expect(formatColorName('Azul Claro', 'Fosco')).toBe('Azul Claro Fosco');
  });
});

describe('isLightColor', () => {
  it('returns true for white', () => {
    expect(isLightColor('#FFFFFF')).toBe(true);
  });
  it('returns false for black', () => {
    expect(isLightColor('#000000')).toBe(false);
  });
  it('returns true for yellow (light)', () => {
    expect(isLightColor('#FFFF00')).toBe(true);
  });
  it('returns false for dark blue', () => {
    expect(isLightColor('#00008B')).toBe(false);
  });
  it('returns true for null hex', () => {
    expect(isLightColor(null)).toBe(true);
  });
});
