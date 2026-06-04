/**
 * Security Headers Validation
 * Verifies that vercel.json configures all required security headers
 * per OWASP best practices.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

interface VercelHeader {
  key: string;
  value: string;
}

interface VercelHeaderBlock {
  source: string;
  headers: VercelHeader[];
}

interface VercelConfig {
  headers?: VercelHeaderBlock[];
}

let allHeaders: VercelHeader[] = [];

beforeAll(() => {
  const vercelPath = path.resolve(__dirname, '../../vercel.json');
  const config: VercelConfig = JSON.parse(fs.readFileSync(vercelPath, 'utf-8'));
  const blocks = config.headers || [];
  for (const block of blocks) {
    allHeaders.push(...(block.headers || []));
  }
});

function findHeader(name: string): string | undefined {
  const h = allHeaders.find((h) => h.key.toLowerCase() === name.toLowerCase());
  return h?.value;
}

describe('Security Headers: HSTS', () => {
  it('Strict-Transport-Security is configured', () => {
    const val = findHeader('Strict-Transport-Security');
    expect(val).toBeDefined();
  });

  it('HSTS max-age is at least 1 year (31536000)', () => {
    const val = findHeader('Strict-Transport-Security')!;
    const maxAge = parseInt(val.match(/max-age=(\d+)/)?.[1] || '0', 10);
    expect(maxAge).toBeGreaterThanOrEqual(31536000);
  });

  it('HSTS includes includeSubDomains', () => {
    const val = findHeader('Strict-Transport-Security')!;
    expect(val).toContain('includeSubDomains');
  });

  it('HSTS includes preload', () => {
    const val = findHeader('Strict-Transport-Security')!;
    expect(val).toContain('preload');
  });
});

describe('Security Headers: X-Frame-Options', () => {
  it('is set to DENY', () => {
    const val = findHeader('X-Frame-Options');
    expect(val).toBe('DENY');
  });
});

describe('Security Headers: X-Content-Type-Options', () => {
  it('is set to nosniff', () => {
    const val = findHeader('X-Content-Type-Options');
    expect(val).toBe('nosniff');
  });
});

describe('Security Headers: Referrer-Policy', () => {
  it('is configured with a strict policy', () => {
    const val = findHeader('Referrer-Policy');
    expect(val).toBeDefined();
    const safeValues = [
      'no-referrer',
      'same-origin',
      'strict-origin',
      'strict-origin-when-cross-origin',
    ];
    expect(safeValues).toContain(val);
  });
});

describe('Security Headers: Permissions-Policy', () => {
  it('is configured', () => {
    const val = findHeader('Permissions-Policy');
    expect(val).toBeDefined();
  });

  it('restricts camera', () => {
    const val = findHeader('Permissions-Policy')!;
    expect(val).toMatch(/camera=\(\)/);
  });

  it('restricts geolocation', () => {
    const val = findHeader('Permissions-Policy')!;
    expect(val).toMatch(/geolocation=\(\)/);
  });

  it('restricts payment', () => {
    const val = findHeader('Permissions-Policy')!;
    expect(val).toMatch(/payment=\(\)/);
  });
});

describe('Security Headers: Content-Security-Policy', () => {
  let csp = '';

  beforeAll(() => {
    csp = findHeader('Content-Security-Policy') || '';
  });

  it('CSP header exists', () => {
    expect(csp.length).toBeGreaterThan(0);
  });

  it('has default-src directive', () => {
    expect(csp).toContain("default-src 'self'");
  });

  it('does not allow unsafe-eval in script-src', () => {
    const scriptSrc = csp.match(/script-src\s+([^;]+)/)?.[1] || '';
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it('restricts object-src to none', () => {
    expect(csp).toContain("object-src 'none'");
  });

  it('has frame-ancestors none (anti-clickjacking)', () => {
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('restricts base-uri to self', () => {
    expect(csp).toContain("base-uri 'self'");
  });

  it('restricts form-action to self', () => {
    expect(csp).toContain("form-action 'self'");
  });

  it('enables upgrade-insecure-requests', () => {
    expect(csp).toContain('upgrade-insecure-requests');
  });

  it('has report-uri or report-to configured', () => {
    const hasReport =
      csp.includes('report-uri') || csp.includes('report-to');
    expect(hasReport).toBe(true);
  });
});
