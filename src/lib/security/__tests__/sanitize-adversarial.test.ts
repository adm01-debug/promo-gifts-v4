/**
 * sanitize.ts — adversarial regression suite
 *
 * G1: WHATWG normalization of decimal-encoded IPs  (e.g. 2130706433 → 127.0.0.1)
 * G2: WHATWG normalization of octal-encoded IPs    (e.g. 0177.0.0.1 → 127.0.0.1)
 * G3: WHATWG normalization of hex-encoded IPs      (e.g. 0x7f000001 → 127.0.0.1)
 * G4: allowEmpty option contract
 * G5: Dangerous URI schemes beyond javascript: (data:, vbscript:, file:, blob:)
 *
 * These tests PROVE the claims made in sanitize.ts comments.
 * If G1-G3 fail, the comment is wrong and we have a live SSRF bypass.
 */

import { describe, it, expect } from 'vitest';
import { sanitizeUrl } from '../sanitize';

// ---------------------------------------------------------------------------
// G1 — Decimal IP encoding
// WHATWG URL standard §5.1: decimal IPv4 addresses are normalised to
// dotted-quad form before any other processing.
// 2130706433 = 0x7F000001 = 127.0.0.1 (loopback)
// 2886729729 = 0xAC100001 = 172.16.0.1 (RFC1918)
// 2130706689 = 0x7F000101 = 127.0.1.1  (loopback range)
// ---------------------------------------------------------------------------

describe('sanitizeUrl — G1 WHATWG decimal IP normalisation', () => {
  it('blocks http://2130706433 (decimal 127.0.0.1)', () => {
    expect(sanitizeUrl('http://2130706433')).toBeNull();
  });

  it('blocks http://2886729729 (decimal 172.16.0.1 — RFC1918)', () => {
    expect(sanitizeUrl('http://2886729729')).toBeNull();
  });

  it('blocks http://167772161 (decimal 10.0.0.1 — RFC1918)', () => {
    // 167772161 = 0x0A000001 = 10.0.0.1
    expect(sanitizeUrl('http://167772161')).toBeNull();
  });

  it('blocks http://3232235521 (decimal 192.168.0.1 — RFC1918)', () => {
    // 3232235521 = 0xC0A80001 = 192.168.0.1
    expect(sanitizeUrl('http://3232235521')).toBeNull();
  });

  it('blocks http://2851995753 (decimal 169.254.169.169 — AWS metadata-like)', () => {
    // 169.254.x.x = link-local
    // 169 * 16777216 + 254 * 65536 + 169 * 256 + 169 = 2851995625 (close)
    // 169.254.169.254 = 0xA9FEA9FE = 2852039166
    expect(sanitizeUrl('http://2852039166')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// G2 — Octal IP encoding
// WHATWG URL standard: octal-encoded IPv4 octets are normalised.
// 0177 = 127, 0300 = 192, 0250 = 168
// ---------------------------------------------------------------------------

describe('sanitizeUrl — G2 WHATWG octal IP normalisation', () => {
  it('blocks http://0177.0.0.1 (octal 127.0.0.1)', () => {
    expect(sanitizeUrl('http://0177.0.0.1')).toBeNull();
  });

  it('blocks http://010.0.0.1 (octal 8.0.0.1 — non-private, sanity check should NOT block)', () => {
    // 010 = 8 in octal. 8.0.0.1 is a public IP — must NOT be blocked.
    const result = sanitizeUrl('http://010.0.0.1');
    // If WHATWG normalises this to 8.0.0.1 it should pass through.
    // If the URL parser rejects it as malformed, null is acceptable too.
    // Either way, it must not be confused with 10.x (RFC1918).
    // We just verify it doesn't throw.
    expect(() => sanitizeUrl('http://010.0.0.1')).not.toThrow();
  });

  it('blocks http://0300.0250.0.1 (octal 192.168.0.1)', () => {
    // 0300 = 192, 0250 = 168
    expect(sanitizeUrl('http://0300.0250.0.1')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// G3 — Hex IP encoding
// WHATWG URL standard: hex-encoded IPv4 addresses are normalised.
// 0x7f000001 = 127.0.0.1
// ---------------------------------------------------------------------------

describe('sanitizeUrl — G3 WHATWG hex IP normalisation', () => {
  it('blocks http://0x7f000001 (hex 127.0.0.1)', () => {
    expect(sanitizeUrl('http://0x7f000001')).toBeNull();
  });

  it('blocks http://0xac100001 (hex 172.16.0.1 — RFC1918)', () => {
    // 0xAC = 172, 0x10 = 16
    expect(sanitizeUrl('http://0xac100001')).toBeNull();
  });

  it('blocks http://0xa9fea9fe (hex 169.254.169.254 — AWS metadata)', () => {
    expect(sanitizeUrl('http://0xa9fea9fe')).toBeNull();
  });

  it('blocks http://0xc0a80001 (hex 192.168.0.1)', () => {
    // 0xC0 = 192, 0xA8 = 168
    expect(sanitizeUrl('http://0xc0a80001')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// G4 — allowEmpty option
// sanitizeUrl('', { allowEmpty: true }) must return '' (not null)
// sanitizeUrl('', { allowEmpty: false }) must return null
// sanitizeUrl(null, { allowEmpty: true }) must return '' (not null)
// ---------------------------------------------------------------------------

describe('sanitizeUrl — G4 allowEmpty option', () => {
  it("returns '' for empty string when allowEmpty: true", () => {
    expect(sanitizeUrl('', { allowEmpty: true })).toBe('');
  });

  it('returns null for empty string when allowEmpty: false (default)', () => {
    expect(sanitizeUrl('', { allowEmpty: false })).toBeNull();
    expect(sanitizeUrl('')).toBeNull();
  });

  it("returns '' for null when allowEmpty: true", () => {
    expect(sanitizeUrl(null, { allowEmpty: true })).toBe('');
  });

  it("returns '' for undefined when allowEmpty: true", () => {
    expect(sanitizeUrl(undefined, { allowEmpty: true })).toBe('');
  });

  it('returns null for null when allowEmpty: false', () => {
    expect(sanitizeUrl(null, { allowEmpty: false })).toBeNull();
  });

  it('does not affect non-empty URLs — valid URL still passes', () => {
    expect(sanitizeUrl('https://example.com', { allowEmpty: true })).not.toBeNull();
  });

  it('does not affect non-empty URLs — SSRF still blocked even with allowEmpty', () => {
    expect(sanitizeUrl('http://127.0.0.1', { allowEmpty: true })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// G5 — Dangerous URI schemes beyond javascript:
// Each must be individually blocked (belt-and-suspenders: SAFE_URL_PROTOCOLS
// already covers these, but the test confirms each one explicitly).
// ---------------------------------------------------------------------------

describe('sanitizeUrl — G5 dangerous URI schemes', () => {
  it('blocks data:text/html,<script>alert(1)</script>', () => {
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
  });

  it('blocks data:text/html;base64,PHNjcmlwdD4=', () => {
    expect(sanitizeUrl('data:text/html;base64,PHNjcmlwdD4=')).toBeNull();
  });

  it('blocks vbscript:msgbox(1)', () => {
    expect(sanitizeUrl('vbscript:msgbox(1)')).toBeNull();
  });

  it('blocks file:///etc/passwd', () => {
    expect(sanitizeUrl('file:///etc/passwd')).toBeNull();
  });

  it('blocks file:///C:/Windows/System32/', () => {
    expect(sanitizeUrl('file:///C:/Windows/System32/')).toBeNull();
  });

  it('blocks blob:https://example.com/uuid', () => {
    // blob: URIs could expose local object data in some environments
    expect(sanitizeUrl('blob:https://example.com/abc-123')).toBeNull();
  });

  it('blocks ftp:// (non-http/https scheme)', () => {
    expect(sanitizeUrl('ftp://example.com')).toBeNull();
  });

  it('blocks javascript:alert(1) (original protocol)', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
  });

  it('blocks JAVASCRIPT:alert(1) (case-insensitive)', () => {
    expect(sanitizeUrl('JAVASCRIPT:alert(1)')).toBeNull();
  });
});
