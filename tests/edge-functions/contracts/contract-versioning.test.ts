/**
 * Contract tests — versionamento de API (parseApiVersion + withVersionHeaders).
 *
 * Cobre:
 *   - Resolução por header x-api-version
 *   - Resolução por query string ?v= e ?api_version=
 *   - Fallback para defaultVersion
 *   - Erro 400 UNSUPPORTED_VERSION para versão desconhecida
 *   - Decoração de headers Deprecation/Sunset/Link em versões depreciadas
 *   - Normalização "1" → "v1"
 */

import { describe, expect, it } from 'vitest';
import {
  parseApiVersion,
  readRequestedVersion,
  withVersionHeaders,
} from '../../../supabase/functions/_shared/contract-versioning';

const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

function buildReq(opts: { url?: string; headers?: Record<string, string> } = {}) {
  return new Request(opts.url ?? 'https://example.com/fn', {
    method: 'POST',
    headers: opts.headers ?? {},
    body: '{}',
  });
}

async function readJson(res: Response) {
  return JSON.parse(await res.text());
}

describe('readRequestedVersion', () => {
  it('aceita header x-api-version', () => {
    const req = buildReq({ headers: { 'x-api-version': 'v2' } });
    expect(readRequestedVersion(req)).toBe('v2');
  });

  it('aceita header sem prefixo "v" (normaliza)', () => {
    const req = buildReq({ headers: { 'x-api-version': '2' } });
    expect(readRequestedVersion(req)).toBe('v2');
  });

  it('aceita query string ?v=', () => {
    const req = buildReq({ url: 'https://example.com/fn?v=2' });
    expect(readRequestedVersion(req)).toBe('v2');
  });

  it('aceita query string ?api_version=', () => {
    const req = buildReq({ url: 'https://example.com/fn?api_version=2' });
    expect(readRequestedVersion(req)).toBe('v2');
  });

  it('header tem prioridade sobre query', () => {
    const req = buildReq({
      url: 'https://example.com/fn?v=2',
      headers: { 'x-api-version': 'v1' },
    });
    expect(readRequestedVersion(req)).toBe('v1');
  });

  it('null quando ausente', () => {
    expect(readRequestedVersion(buildReq())).toBeNull();
  });
});

describe('parseApiVersion', () => {
  it('usa defaultVersion quando nada é solicitado', () => {
    const res = parseApiVersion(buildReq(), ['v1', 'v2'] as const, {
      defaultVersion: 'v1',
      corsHeaders,
    });
    if ('error' in res) throw new Error('expected success');
    expect(res.version).toBe('v1');
    expect(res.isDeprecated).toBe(false);
  });

  it('respeita versão pedida quando suportada', () => {
    const req = buildReq({ headers: { 'x-api-version': 'v2' } });
    const res = parseApiVersion(req, ['v1', 'v2'] as const, {
      defaultVersion: 'v1',
      corsHeaders,
    });
    if ('error' in res) throw new Error('expected success');
    expect(res.version).toBe('v2');
  });

  it('rejeita versão desconhecida com 400 UNSUPPORTED_VERSION', async () => {
    const req = buildReq({ headers: { 'x-api-version': 'v99' } });
    const res = parseApiVersion(req, ['v1', 'v2'] as const, {
      defaultVersion: 'v1',
      corsHeaders,
    });
    expect('error' in res).toBe(true);
    if (!('error' in res)) return;
    expect(res.error.status).toBe(400);
    const body = await readJson(res.error);
    expect(body.code).toBe('UNSUPPORTED_VERSION');
    expect(body.message).toContain('v99');
  });

  it('marca versão depreciada', () => {
    const req = buildReq({ headers: { 'x-api-version': 'v1' } });
    const res = parseApiVersion(req, ['v1', 'v2'] as const, {
      defaultVersion: 'v2',
      deprecated: {
        v1: {
          sunsetAt: '2026-12-31T00:00:00Z',
          migrationGuideUrl: 'https://docs.example.com/v2',
        },
      },
      corsHeaders,
    });
    if ('error' in res) throw new Error('expected success');
    expect(res.isDeprecated).toBe(true);
    expect(res.deprecationInfo?.sunsetAt).toBe('2026-12-31T00:00:00Z');
  });
});

describe('withVersionHeaders', () => {
  it('adiciona x-api-version a qualquer Response', () => {
    const base = new Response('hi', { status: 200 });
    const decorated = withVersionHeaders(base, {
      version: 'v1',
      isDeprecated: false,
    });
    expect(decorated.headers.get('x-api-version')).toBe('v1');
    expect(decorated.status).toBe(200);
  });

  it('adiciona Deprecation + Sunset quando depreciada', () => {
    const base = new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const decorated = withVersionHeaders(base, {
      version: 'v1',
      isDeprecated: true,
      deprecationInfo: {
        sunsetAt: '2026-12-31T00:00:00Z',
        migrationGuideUrl: 'https://docs.example.com/v2',
      },
    });
    expect(decorated.headers.get('Deprecation')).toBe('true');
    expect(decorated.headers.get('Sunset')).toContain('2026');
    expect(decorated.headers.get('Link')).toContain('rel="deprecation"');
    expect(decorated.headers.get('Content-Type')).toBe('application/json');
  });

  it('NÃO adiciona Deprecation quando versão é current', () => {
    const base = new Response('hi');
    const decorated = withVersionHeaders(base, { version: 'v2', isDeprecated: false });
    expect(decorated.headers.get('Deprecation')).toBeNull();
    expect(decorated.headers.get('Sunset')).toBeNull();
  });
});
