/**
 * magazine-guard.ts — adversarial regression suite
 *
 * G6: sanitized.colors must contain ONLY {primary, secondary, text} — no extra keys
 *     (prototype pollution attempt via __proto__, constructor, xss keys)
 * G7: validateBranding({colors: null}) must set isValid: true (absent ≠ error)
 * G8: clientLogoUrl with SSRF payload must be sanitized to null
 * G9: clientLogoUrl with XSS scheme must be sanitized to null
 */

import { describe, it, expect } from 'vitest';
import { validateBranding } from '../magazine-guard';

const VALID_COLORS = { primary: '#FF0000', secondary: '#00FF00', text: '#0000FF' };

// ---------------------------------------------------------------------------
// G6 — Color key whitelist
// The sanitize step must emit EXACTLY {primary, secondary, text} and drop all
// other keys, including prototype-pollution vectors like __proto__ and
// constructor, and any XSS-via-key attempts.
// ---------------------------------------------------------------------------

describe('validateBranding — G6 color key whitelist', () => {
  it('drops unknown key "xss" from sanitized.colors', () => {
    const result = validateBranding({
      colors: { ...VALID_COLORS, xss: '<script>alert(1)</script>' } as never,
    });
    expect(result.sanitized?.colors).not.toHaveProperty('xss');
    expect(result.isValid).toBe(true);
  });

  it('drops unknown key "__proto__" from sanitized.colors', () => {
    const result = validateBranding({
      colors: { ...VALID_COLORS, __proto__: 'polluted' } as never,
    });
    expect(result.sanitized?.colors).not.toHaveProperty('__proto__');
    expect(result.isValid).toBe(true);
  });

  it('drops unknown key "constructor" from sanitized.colors', () => {
    const result = validateBranding({
      colors: { ...VALID_COLORS, constructor: 'evil' } as never,
    });
    expect(result.sanitized?.colors).not.toHaveProperty('constructor');
    expect(result.isValid).toBe(true);
  });

  it('drops unknown key "toString" from sanitized.colors', () => {
    const result = validateBranding({
      colors: { ...VALID_COLORS, toString: () => 'PWNED' } as never,
    });
    expect(result.sanitized?.colors).not.toHaveProperty('toString');
  });

  it('sanitized.colors has exactly the three expected keys', () => {
    const result = validateBranding({
      colors: { ...VALID_COLORS, extra1: '#AAAAAA', extra2: '#BBBBBB' } as never,
    });
    const keys = Object.keys(result.sanitized?.colors ?? {});
    expect(keys.sort()).toEqual(['primary', 'secondary', 'text']);
  });

  it('sanitized.colors key count is exactly 3 even when input has 10 keys', () => {
    const manyKeys: Record<string, string> = { ...VALID_COLORS };
    for (let i = 0; i < 7; i++) manyKeys[`key${i}`] = '#FFFFFF';
    const result = validateBranding({ colors: manyKeys as never });
    expect(Object.keys(result.sanitized?.colors ?? {}).length).toBe(3);
  });

  it('valid keys still have correct values after whitelist filter', () => {
    const result = validateBranding({
      colors: { ...VALID_COLORS, injected: '#DEAD00' } as never,
    });
    expect(result.sanitized?.colors?.primary).toBe('#FF0000');
    expect(result.sanitized?.colors?.secondary).toBe('#00FF00');
    expect(result.sanitized?.colors?.text).toBe('#0000FF');
  });
});

// ---------------------------------------------------------------------------
// G7 — colors: null is not an error (treated as "no colors patch")
// This is technically already in magazine-guard-edge.test.ts (MED-2) but that
// test only checks errors — it never asserts isValid: true explicitly.
// ---------------------------------------------------------------------------

describe('validateBranding — G7 colors null is isValid=true', () => {
  it('returns isValid=true when colors is null', () => {
    // @ts-expect-error intentional null
    const result = validateBranding({ colors: null });
    expect(result.isValid).toBe(true);
  });

  it('returns empty errors array when colors is null', () => {
    // @ts-expect-error intentional null
    const result = validateBranding({ colors: null });
    expect(result.errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// G8 — SSRF via clientLogoUrl
// Magazine branding accepts a logo URL — must never allow private/loopback hosts.
// validateBranding uses httpsOnly: true for clientLogoUrl, so any http:// URL
// is also blocked. But the critical SSRF test is with https:// on private hosts.
// ---------------------------------------------------------------------------

describe('validateBranding — G8 SSRF in clientLogoUrl', () => {
  it('sanitizes clientLogoUrl with AWS metadata endpoint to null', () => {
    const result = validateBranding({
      clientLogoUrl: 'https://169.254.169.254/latest/meta-data/iam/security-credentials/',
    });
    expect(result.sanitized?.clientLogoUrl).toBeNull();
    // The validation error should be reported
    expect(result.errors.some((e) => e.includes('logo'))).toBe(true);
  });

  it('sanitizes clientLogoUrl with localhost to null', () => {
    const result = validateBranding({
      clientLogoUrl: 'https://localhost/internal-api',
    });
    expect(result.sanitized?.clientLogoUrl).toBeNull();
  });

  it('sanitizes clientLogoUrl with 127.0.0.1 to null', () => {
    const result = validateBranding({
      clientLogoUrl: 'https://127.0.0.1/logo.png',
    });
    expect(result.sanitized?.clientLogoUrl).toBeNull();
  });

  it('sanitizes clientLogoUrl with RFC1918 address to null', () => {
    const result = validateBranding({
      clientLogoUrl: 'https://192.168.1.1/logo.png',
    });
    expect(result.sanitized?.clientLogoUrl).toBeNull();
  });

  it('sanitizes clientLogoUrl with IPv4-mapped IPv6 SSRF to null', () => {
    // ::ffff:7f00:1 decodes to 127.0.0.1
    const result = validateBranding({
      clientLogoUrl: 'https://[::ffff:7f00:1]/logo.png',
    });
    expect(result.sanitized?.clientLogoUrl).toBeNull();
  });

  it('sanitizes http:// clientLogoUrl to null (httpsOnly enforced)', () => {
    // Even a public IP fails because httpsOnly: true
    const result = validateBranding({
      clientLogoUrl: 'http://cdn.example.com/logo.png',
    });
    expect(result.sanitized?.clientLogoUrl).toBeNull();
  });

  it('allows https:// clientLogoUrl with public CDN host', () => {
    const result = validateBranding({
      clientLogoUrl: 'https://cdn.example.com/logo.png',
    });
    expect(result.sanitized?.clientLogoUrl).toBe('https://cdn.example.com/logo.png');
    expect(result.isValid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// G9 — XSS via clientLogoUrl scheme
// javascript: and data: in the logo URL must be blocked.
// ---------------------------------------------------------------------------

describe('validateBranding — G9 XSS schemes in clientLogoUrl', () => {
  it('sanitizes javascript:alert(1) to null', () => {
    const result = validateBranding({
      clientLogoUrl: 'javascript:alert(1)', // eslint-disable-line no-script-url
    });
    expect(result.sanitized?.clientLogoUrl).toBeNull();
    expect(result.isValid).toBe(false);
  });

  it('sanitizes data:image/png;base64,... to null', () => {
    const result = validateBranding({
      clientLogoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==',
    });
    expect(result.sanitized?.clientLogoUrl).toBeNull();
  });

  it('sanitizes vbscript:msgbox to null', () => {
    const result = validateBranding({
      clientLogoUrl: 'vbscript:msgbox(1)',
    });
    expect(result.sanitized?.clientLogoUrl).toBeNull();
  });

  it('sanitizes URL with embedded credentials to null', () => {
    // user:pass@ credential exfil via logo URL
    const result = validateBranding({
      clientLogoUrl: 'https://user:pass@cdn.example.com/logo.png',
    });
    expect(result.sanitized?.clientLogoUrl).toBeNull();
  });
});
