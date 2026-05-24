import { describe, it, expect } from 'vitest';
import { resolveContractVersion } from '../../supabase/functions/_shared/contracts/versioning';
import { makeRequest } from './_helpers';

const config = {
  supported: ['1', '2'],
  default: '1',
  deprecated: [
    {
      version: '1',
      sunset: '2026-08-31',
      migrationUrl: 'https://example.com/migrate',
    },
  ],
};

describe('contracts/versioning — negociação de versão', () => {
  it('resolve default quando nenhum hint é fornecido', () => {
    const req = makeRequest({});
    const r = resolveContractVersion(req, config);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.resolved.version).toBe('1');
  });

  it('header accept-version tem prioridade sobre query', () => {
    const req = makeRequest({
      url: 'https://edge.local/fn?v=2',
      headers: { 'accept-version': '1' },
    });
    const r = resolveContractVersion(req, config);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.resolved.version).toBe('1');
  });

  it('aceita formato v2, 2, 2.0', () => {
    for (const v of ['2', 'v2', '2.0']) {
      const req = makeRequest({ headers: { 'accept-version': v } });
      const r = resolveContractVersion(req, config);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.resolved.version).toBe('2');
    }
  });

  it('query ?v=2 é aceita quando header ausente', () => {
    const req = makeRequest({ url: 'https://edge.local/fn?v=2' });
    const r = resolveContractVersion(req, config);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.resolved.version).toBe('2');
  });

  it('versão não-suportada → 406 unsupported_version', async () => {
    const req = makeRequest({ headers: { 'accept-version': '99' } });
    const r = resolveContractVersion(req, config);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(406);
      const body = await r.response.json();
      expect(body.code).toBe('unsupported_version');
    }
  });

  it('versão deprecated → headers Deprecation/Sunset/Link (RFC 8594)', () => {
    const req = makeRequest({ headers: { 'accept-version': '1' } });
    const r = resolveContractVersion(req, config);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.resolved.deprecation).toBeDefined();
      const h = r.resolved.responseHeaders;
      expect(h['Deprecation']).toBe('true');
      expect(h['Sunset']).toMatch(/\d{4}/);
      expect(h['Link']).toContain('https://example.com/migrate');
      expect(h['Link']).toContain('rel="deprecation"');
    }
  });

  it('versão não-deprecated → sem headers Deprecation', () => {
    const req = makeRequest({ headers: { 'accept-version': '2' } });
    const r = resolveContractVersion(req, config);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.resolved.deprecation).toBeUndefined();
      expect(r.resolved.responseHeaders['Deprecation']).toBeUndefined();
      expect(r.resolved.responseHeaders['x-contract-version']).toBe('2');
    }
  });
});
