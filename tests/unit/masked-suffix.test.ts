/**
 * Unit tests for src/lib/masked-suffix.ts
 *
 * normalizeMaskedSuffix, formatMaskedSuffix, diagnoseMaskedSuffix,
 * resolveDisplaySuffix, formatDisplaySuffix
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeMaskedSuffix,
  formatMaskedSuffix,
  diagnoseMaskedSuffix,
  resolveDisplaySuffix,
  formatDisplaySuffix,
} from '@/lib/masked-suffix';

// ============================================
// normalizeMaskedSuffix
// ============================================

describe('normalizeMaskedSuffix', () => {
  it('returns ???? for null', () => {
    expect(normalizeMaskedSuffix(null)).toBe('????');
  });

  it('returns ???? for undefined', () => {
    expect(normalizeMaskedSuffix(undefined)).toBe('????');
  });

  it('returns ???? for empty string', () => {
    expect(normalizeMaskedSuffix('')).toBe('????');
  });

  it('pads whitespace-only string to 4 bullets (trims to empty, then pads)', () => {
    expect(normalizeMaskedSuffix('   ')).toBe('••••');
  });

  it('returns exact 4-char input unchanged', () => {
    expect(normalizeMaskedSuffix('abcd')).toBe('abcd');
    expect(normalizeMaskedSuffix('1234')).toBe('1234');
  });

  it('pads a 1-char suffix to 4 chars with • on the left', () => {
    expect(normalizeMaskedSuffix('a')).toBe('•••a');
  });

  it('pads a 2-char suffix', () => {
    expect(normalizeMaskedSuffix('ab')).toBe('••ab');
  });

  it('pads a 3-char suffix', () => {
    expect(normalizeMaskedSuffix('abc')).toBe('•abc');
  });

  it('takes the last 4 chars when input is longer than 4', () => {
    expect(normalizeMaskedSuffix('abcdef')).toBe('cdef');
    expect(normalizeMaskedSuffix('12345678')).toBe('5678');
  });

  it('trims whitespace before processing', () => {
    expect(normalizeMaskedSuffix('  1234  ')).toBe('1234');
    expect(normalizeMaskedSuffix('  ab  ')).toBe('••ab');
  });
});

// ============================================
// formatMaskedSuffix
// ============================================

describe('formatMaskedSuffix', () => {
  it('prepends •••• to a valid 4-char suffix', () => {
    expect(formatMaskedSuffix('1234')).toBe('••••1234');
  });

  it('normalizes short suffix and prepends ••••', () => {
    expect(formatMaskedSuffix('ab')).toBe('••••••ab');
  });

  it('uses ???? placeholder for null', () => {
    expect(formatMaskedSuffix(null)).toBe('••••????');
  });

  it('always produces 8 visible chars for valid input', () => {
    const result = formatMaskedSuffix('abcd');
    expect([...result]).toHaveLength(8);
  });
});

// ============================================
// diagnoseMaskedSuffix
// ============================================

describe('diagnoseMaskedSuffix', () => {
  it('returns "missing" for null input', () => {
    const d = diagnoseMaskedSuffix(null);
    expect(d.status).toBe('missing');
    expect(d.realLength).toBe(0);
  });

  it('returns "missing" for empty string', () => {
    const d = diagnoseMaskedSuffix('');
    expect(d.status).toBe('missing');
    expect(d.label).toContain('ausente');
  });

  it('returns "short" for 1-char suffix', () => {
    const d = diagnoseMaskedSuffix('a');
    expect(d.status).toBe('short');
    expect(d.realLength).toBe(1);
  });

  it('returns "short" for 3-char suffix with correct realLength', () => {
    const d = diagnoseMaskedSuffix('abc');
    expect(d.status).toBe('short');
    expect(d.realLength).toBe(3);
    expect(d.label).toContain('3/4');
  });

  it('returns "valid" for exactly 4 chars', () => {
    const d = diagnoseMaskedSuffix('abcd');
    expect(d.status).toBe('valid');
    expect(d.realLength).toBe(4);
  });

  it('returns "valid" for more than 4 chars', () => {
    const d = diagnoseMaskedSuffix('abcdef');
    expect(d.status).toBe('valid');
    expect(d.realLength).toBe(6);
  });

  it('includes secretName in missing message when provided', () => {
    const d = diagnoseMaskedSuffix(null, { secretName: 'OPENAI_KEY' });
    expect(d.message).toContain('"OPENAI_KEY"');
  });
});

// ============================================
// resolveDisplaySuffix
// ============================================

describe('resolveDisplaySuffix', () => {
  it('returns last 4 chars for input >= 4 chars', () => {
    expect(resolveDisplaySuffix('abcdef')).toBe('cdef');
    expect(resolveDisplaySuffix('1234')).toBe('1234');
  });

  it('pads short non-empty input with •', () => {
    expect(resolveDisplaySuffix('ab')).toBe('••ab');
  });

  it('returns ???? when input is null and no length', () => {
    expect(resolveDisplaySuffix(null)).toBe('????');
    expect(resolveDisplaySuffix(null, {})).toBe('????');
  });

  it('shows L=NN for single-digit length', () => {
    expect(resolveDisplaySuffix(null, { length: 5 })).toBe('L=05');
  });

  it('shows L=NN for double-digit length', () => {
    expect(resolveDisplaySuffix(null, { length: 12 })).toBe('L=12');
    expect(resolveDisplaySuffix(null, { length: 99 })).toBe('L=99');
  });

  it('shows L99+ for length >= 100', () => {
    expect(resolveDisplaySuffix(null, { length: 100 })).toBe('L99+');
    expect(resolveDisplaySuffix(null, { length: 500 })).toBe('L99+');
  });

  it('returns exactly 4 characters in all branches', () => {
    const cases = [
      resolveDisplaySuffix('abcdef'),
      resolveDisplaySuffix('ab'),
      resolveDisplaySuffix(null),
      resolveDisplaySuffix(null, { length: 5 }),
      resolveDisplaySuffix(null, { length: 12 }),
      resolveDisplaySuffix(null, { length: 100 }),
    ];
    for (const c of cases) {
      expect([...c]).toHaveLength(4);
    }
  });
});

// ============================================
// formatDisplaySuffix
// ============================================

describe('formatDisplaySuffix', () => {
  it('prepends •••• to resolved suffix', () => {
    expect(formatDisplaySuffix('abcd')).toBe('••••abcd');
  });

  it('uses L=NN fallback when raw is null and length given', () => {
    expect(formatDisplaySuffix(null, { length: 5 })).toBe('••••L=05');
  });

  it('uses ???? when no info available', () => {
    expect(formatDisplaySuffix(null)).toBe('••••????');
  });

  it('always produces 8 visible characters', () => {
    const result = formatDisplaySuffix('1234');
    expect([...result]).toHaveLength(8);
  });
});
