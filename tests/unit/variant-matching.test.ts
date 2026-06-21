/**
 * Unit tests for src/lib/variant-matching.ts
 *
 * Covers normalizeColorName, hexDistance, and findMatchingColorIndex.
 * All functions are pure — no mocking required.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeColorName,
  hexDistance,
  findMatchingColorIndex,
} from '@/lib/variant-matching';

// ─── normalizeColorName ────────────────────────────────────────────────────────

describe('normalizeColorName', () => {
  it('returns empty string for null', () => {
    expect(normalizeColorName(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(normalizeColorName(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(normalizeColorName('')).toBe('');
  });

  it('lowercases ASCII names', () => {
    expect(normalizeColorName('Azul')).toBe('azul');
  });

  it('strips accents (NFD decomposition)', () => {
    expect(normalizeColorName('Vermelhão')).toBe('vermelhao');
    expect(normalizeColorName('Vinhó')).toBe('vinho');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeColorName('  Azul  ')).toBe('azul');
  });

  it('handles mixed accent + case', () => {
    expect(normalizeColorName('Prêto')).toBe('preto');
  });

  it('makes two differently-cased names match', () => {
    expect(normalizeColorName('AZUL')).toBe(normalizeColorName('azul'));
  });
});

// ─── hexDistance ──────────────────────────────────────────────────────────────

describe('hexDistance', () => {
  it('returns 0 for identical hex values', () => {
    expect(hexDistance('#FF0000', '#FF0000')).toBe(0);
  });

  it('returns Infinity when either arg is null', () => {
    expect(hexDistance(null, '#FF0000')).toBe(Infinity);
    expect(hexDistance('#FF0000', null)).toBe(Infinity);
  });

  it('returns Infinity when either arg is undefined', () => {
    expect(hexDistance(undefined, '#FF0000')).toBe(Infinity);
  });

  it('returns Infinity for invalid hex strings', () => {
    expect(hexDistance('gg0000', '#FF0000')).toBe(Infinity);
    expect(hexDistance('#FFF', '#FF0000')).toBe(Infinity); // 3-char hex not supported
  });

  it('max distance between black and white is ~441', () => {
    const d = hexDistance('#000000', '#FFFFFF');
    // sqrt(255^2 * 3) = 255 * sqrt(3) ≈ 441.67
    expect(d).toBeCloseTo(441.67, 1);
  });

  it('works without leading # (strips it)', () => {
    expect(hexDistance('FF0000', '#FF0000')).toBe(0);
  });

  it('pure red vs pure green distance', () => {
    // sqrt((255-0)^2 + (0-255)^2 + 0^2) = 255*sqrt(2) ≈ 360.62
    const d = hexDistance('#FF0000', '#00FF00');
    expect(d).toBeCloseTo(360.62, 1);
  });

  it('very close colors have small distance', () => {
    // #FF0000 vs #FE0000 → diff in R only by 1
    const d = hexDistance('#FF0000', '#FE0000');
    expect(d).toBe(1);
  });
});

// ─── findMatchingColorIndex ────────────────────────────────────────────────────

describe('findMatchingColorIndex', () => {
  const colors = [
    { name: 'Azul', hex: '#0000FF' },
    { name: 'Vermelho', hex: '#FF0000' },
    { name: 'Verde', hex: '#00FF00' },
  ];

  it('returns -1 for empty colors array', () => {
    expect(findMatchingColorIndex({ name: 'Azul' }, [])).toBe(-1);
  });

  it('matches by exact name (case/accent insensitive)', () => {
    expect(findMatchingColorIndex({ name: 'azul' }, colors)).toBe(0);
    expect(findMatchingColorIndex({ name: 'VERMELHO' }, colors)).toBe(1);
  });

  it('name match takes priority over hex match', () => {
    // Target: "Vermelho" (index 1), but hex close to Azul
    const target = { name: 'verde', hex: '#0000FE' };
    expect(findMatchingColorIndex(target, colors)).toBe(2); // name match wins
  });

  it('falls back to hex proximity when name has no match', () => {
    // Target: no name, hex very close to Azul (#0000FE → dist 1)
    const target = { hex: '#0000FE' };
    expect(findMatchingColorIndex(target, colors)).toBe(0);
  });

  it('returns -1 when hex distance >= 30 and no name match', () => {
    // #888888 is far from all three primaries
    const target = { hex: '#888888' };
    expect(findMatchingColorIndex(target, colors)).toBe(-1);
  });

  it('returns -1 when both name and hex are missing', () => {
    expect(findMatchingColorIndex({}, colors)).toBe(-1);
  });

  it('returns -1 when target name normalizes to empty string', () => {
    expect(findMatchingColorIndex({ name: '' }, colors)).toBe(-1);
  });

  it('picks the closest hex when multiple are within range', () => {
    const nearColors = [
      { name: undefined, hex: '#0000F0' }, // dist from #0000FF: 15
      { name: undefined, hex: '#0000FD' }, // dist: 2
      { name: undefined, hex: '#0000F8' }, // dist: 7
    ];
    const target = { hex: '#0000FF' };
    expect(findMatchingColorIndex(target, nearColors)).toBe(1); // closest
  });
});
