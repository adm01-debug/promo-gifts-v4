/**
 * Unit tests for src/lib/supplier-colors.ts
 *
 * getSupplierColors, getSupplierBadgeClasses
 */
import { describe, it, expect } from 'vitest';
import { getSupplierColors, getSupplierBadgeClasses } from '@/lib/supplier-colors';

// ============================================
// getSupplierColors
// ============================================

describe('getSupplierColors', () => {
  it('returns XBZ blue config for "XBZ"', () => {
    const c = getSupplierColors('XBZ');
    expect(c.hex).toBe('#1E40AF');
    expect(c.text).toContain('1E40AF');
  });

  it('matches "xbz" case-insensitively', () => {
    expect(getSupplierColors('XBZ').hex).toBe(getSupplierColors('xbz').hex);
    expect(getSupplierColors('Xbz Brindes').hex).toBe('#1E40AF');
  });

  it('returns SPOT green config for "SPOT"', () => {
    const c = getSupplierColors('SPOT');
    expect(c.hex).toBe('#065F46');
  });

  it('matches "stricker" variant as SPOT green', () => {
    const c = getSupplierColors('Stricker');
    expect(c.hex).toBe('#065F46');
  });

  it('returns ASIA red config for "Asia Import"', () => {
    const c = getSupplierColors('Asia Import');
    expect(c.hex).toBe('#991B1B');
  });

  it('matches "asia" case-insensitively', () => {
    expect(getSupplierColors('ASIA').hex).toBe('#991B1B');
  });

  it('returns default orange config for unknown supplier', () => {
    const c = getSupplierColors('Unknown Supplier Co.');
    expect(c.hex).toBe('#9A3412');
  });

  it('returns default for empty string', () => {
    const c = getSupplierColors('');
    expect(c.hex).toBe('#9A3412');
  });

  it('each config has bg, text, and hex fields', () => {
    for (const name of ['XBZ', 'SPOT', 'Asia', 'Generic']) {
      const c = getSupplierColors(name);
      expect(c.bg).toBeTruthy();
      expect(c.text).toBeTruthy();
      expect(c.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

// ============================================
// getSupplierBadgeClasses
// ============================================

describe('getSupplierBadgeClasses', () => {
  it('returns a non-empty string', () => {
    expect(getSupplierBadgeClasses('XBZ').length).toBeGreaterThan(0);
  });

  it('includes "border" class in output', () => {
    expect(getSupplierBadgeClasses('SPOT')).toContain('border');
  });

  it('XBZ badge includes blue token', () => {
    expect(getSupplierBadgeClasses('XBZ Brindes')).toContain('1E40AF');
  });

  it('SPOT badge includes green token', () => {
    expect(getSupplierBadgeClasses('Spot Gráfica')).toContain('065F46');
  });

  it('Asia badge includes red token', () => {
    expect(getSupplierBadgeClasses('Asia Import')).toContain('991B1B');
  });

  it('unknown supplier badge includes default orange token', () => {
    expect(getSupplierBadgeClasses('Outro Fornecedor')).toContain('9A3412');
  });

  it('different suppliers produce different badge classes', () => {
    const xbz = getSupplierBadgeClasses('XBZ');
    const asia = getSupplierBadgeClasses('Asia');
    expect(xbz).not.toBe(asia);
  });
});
