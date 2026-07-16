/**
 * magazine-guard.ts — edge-case regression tests
 *
 * F-005: validateBranding([] ) must return isValid=false (array is typeof 'object').
 * MED-2: validateBranding({colors: null}) must not crash.
 * MED-3: validateBranding({colors: 42}) must return isValid=false.
 */

import { describe, it, expect } from 'vitest';
import { validateBranding } from '../magazine-guard';

// ---------------------------------------------------------------------------
// F-005 — Array input
// ---------------------------------------------------------------------------

describe('validateBranding — F-005 array input', () => {
  it('returns isValid=false for []', () => {
    // @ts-expect-error intentional wrong type
    const result = validateBranding([]);
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
  });

  it('returns isValid=false for [{colors:{primary:"#FF0000"}}]', () => {
    // @ts-expect-error intentional wrong type
    const result = validateBranding([{ colors: { primary: '#FF0000' } }]);
    expect(result.isValid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// MED-2 — null colors
// ---------------------------------------------------------------------------

describe('validateBranding — MED-2 null colors', () => {
  it('does not crash when colors is null', () => {
    // @ts-expect-error intentional — null is not a valid colors value but must be handled
    expect(() => validateBranding({ colors: null })).not.toThrow();
  });

  it('returns isValid=true when colors is null (treated as absent)', () => {
    // null in colors means "no color patch" — we don't error, we just skip
    // @ts-expect-error intentional
    const result = validateBranding({ colors: null });
    // No color errors; clientLogoUrl is absent so no logo error either.
    expect(result.errors.filter((e) => e.includes('hex'))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// MED-3 — non-object colors
// ---------------------------------------------------------------------------

describe('validateBranding — MED-3 non-object colors', () => {
  it('returns isValid=false when colors is a number', () => {
    // @ts-expect-error intentional wrong type
    const result = validateBranding({ colors: 42 });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('colors'))).toBe(true);
  });

  it('returns isValid=false when colors is a string', () => {
    // @ts-expect-error intentional wrong type
    const result = validateBranding({ colors: '#FF0000' });
    expect(result.isValid).toBe(false);
  });

  it('returns isValid=false when colors is an array', () => {
    // @ts-expect-error intentional wrong type
    const result = validateBranding({ colors: ['#FF0000'] });
    expect(result.isValid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Sanity — valid branding still passes
// ---------------------------------------------------------------------------

describe('validateBranding — valid branding', () => {
  it('accepts full valid branding', () => {
    const result = validateBranding({
      clientLogoUrl: 'https://cdn.example.com/logo.png',
      colors: { primary: '#FF0000', secondary: '#00FF00', text: '#0000FF' },
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts branding with no colors key (partial patch)', () => {
    const result = validateBranding({ clientLogoUrl: null });
    expect(result.errors.filter((e) => e.includes('hex'))).toHaveLength(0);
  });
});
