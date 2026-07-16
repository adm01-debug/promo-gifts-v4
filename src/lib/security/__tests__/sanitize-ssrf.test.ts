/**
 * sanitize.ts — SSRF & type-safety regression tests
 *
 * CRIT-1: sanitizeUrl must block private/loopback/link-local hosts
 *          (WHATWG parser normalises octal/hex/decimal before our check).
 * CRIT-2: sanitizeUrl must not throw on truthy non-string inputs.
 */

import { describe, it, expect } from 'vitest';
import { sanitizeUrl } from '../sanitize';

// ---------------------------------------------------------------------------
// CRIT-2 — typeof guard
// ---------------------------------------------------------------------------

describe('sanitizeUrl — CRIT-2 typeof guard', () => {
  it('returns null for a number (truthy non-string)', () => {
    // Before fix: url.trim() would throw TypeError
    // @ts-expect-error intentional wrong type test
    expect(sanitizeUrl(42)).toBeNull();
  });

  it('returns null for an object', () => {
    // @ts-expect-error intentional wrong type test
    expect(sanitizeUrl({})).toBeNull();
  });

  it('returns null for an array', () => {
    // @ts-expect-error intentional wrong type test
    expect(sanitizeUrl(['https://example.com'])).toBeNull();
  });

  it('still handles null and undefined gracefully', () => {
    expect(sanitizeUrl(null)).toBeNull();
    expect(sanitizeUrl(undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CRIT-1 — SSRF hostname blocklist
// ---------------------------------------------------------------------------

describe('sanitizeUrl — CRIT-1 SSRF blocklist (loopback)', () => {
  it('blocks http://localhost', () => {
    expect(sanitizeUrl('http://localhost')).toBeNull();
  });

  it('blocks http://localhost/path', () => {
    expect(sanitizeUrl('http://localhost/path')).toBeNull();
  });

  it('blocks http://127.0.0.1', () => {
    expect(sanitizeUrl('http://127.0.0.1')).toBeNull();
  });

  it('blocks http://127.1.2.3 (loopback range)', () => {
    expect(sanitizeUrl('http://127.1.2.3')).toBeNull();
  });

  it('blocks http://0.0.0.0', () => {
    expect(sanitizeUrl('http://0.0.0.0')).toBeNull();
  });

  it('blocks http://[::1] (IPv6 loopback)', () => {
    expect(sanitizeUrl('http://[::1]')).toBeNull();
  });
});

describe('sanitizeUrl — CRIT-1 SSRF blocklist (private ranges)', () => {
  it('blocks 10.0.0.1', () => {
    expect(sanitizeUrl('http://10.0.0.1')).toBeNull();
  });

  it('blocks 10.255.255.255', () => {
    expect(sanitizeUrl('http://10.255.255.255')).toBeNull();
  });

  it('blocks 192.168.1.1', () => {
    expect(sanitizeUrl('http://192.168.1.1')).toBeNull();
  });

  it('blocks 192.168.0.0', () => {
    expect(sanitizeUrl('http://192.168.0.0')).toBeNull();
  });

  it('blocks 172.16.0.1 (RFC1918)', () => {
    expect(sanitizeUrl('http://172.16.0.1')).toBeNull();
  });

  it('blocks 172.31.255.255 (RFC1918 end)', () => {
    expect(sanitizeUrl('http://172.31.255.255')).toBeNull();
  });

  it('allows 172.15.0.1 (just outside RFC1918)', () => {
    expect(sanitizeUrl('http://172.15.0.1')).not.toBeNull();
  });

  it('allows 172.32.0.1 (just outside RFC1918)', () => {
    expect(sanitizeUrl('http://172.32.0.1')).not.toBeNull();
  });
});

describe('sanitizeUrl — CRIT-1 SSRF blocklist (link-local)', () => {
  it('blocks 169.254.1.1 (link-local)', () => {
    expect(sanitizeUrl('http://169.254.1.1')).toBeNull();
  });

  it('blocks 169.254.169.254 (AWS metadata)', () => {
    expect(sanitizeUrl('http://169.254.169.254')).toBeNull();
  });

  it('blocks IPv6 link-local fe80::1', () => {
    expect(sanitizeUrl('http://[fe80::1]')).toBeNull();
  });

  it('blocks IPv6 link-local fe80::1%eth0', () => {
    // URL constructor strips zone IDs; hostname becomes 'fe80::1'
    expect(sanitizeUrl('http://[fe80::1%25eth0]')).toBeNull();
  });
});

describe('sanitizeUrl — CRIT-1 SSRF blocklist (internal TLDs)', () => {
  it('blocks host.local', () => {
    expect(sanitizeUrl('http://host.local')).toBeNull();
  });

  it('blocks service.internal', () => {
    expect(sanitizeUrl('http://service.internal')).toBeNull();
  });

  it('blocks corp.corp', () => {
    expect(sanitizeUrl('http://corp.corp')).toBeNull();
  });
});

describe('sanitizeUrl — CRIT-1 credential exfil', () => {
  it('blocks URL with embedded user:pass', () => {
    expect(sanitizeUrl('http://user:pass@example.com')).toBeNull();
  });

  it('blocks URL with embedded username only', () => {
    expect(sanitizeUrl('http://user@example.com')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Sanity — legitimate URLs must still pass
// ---------------------------------------------------------------------------

describe('sanitizeUrl — legitimate URLs pass through', () => {
  it('allows https://cdn.example.com/logo.png', () => {
    expect(sanitizeUrl('https://cdn.example.com/logo.png')).toBe('https://cdn.example.com/logo.png');
  });

  it('allows http://example.com', () => {
    expect(sanitizeUrl('http://example.com')).toBe('http://example.com/');
  });

  it('blocks http:// when httpsOnly=true', () => {
    expect(sanitizeUrl('http://example.com', { httpsOnly: true })).toBeNull();
  });

  it('allows https:// when httpsOnly=true', () => {
    expect(sanitizeUrl('https://example.com', { httpsOnly: true })).not.toBeNull();
  });
});
