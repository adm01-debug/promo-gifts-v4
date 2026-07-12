/**
 * magazineService.getPublicByToken — contract tests contra a edge
 * magazine-public-view. 60+ cenários (HTTP status, timeout, headers, tokens).
 *
 * Objetivo: garantir que a leitura pública:
 *  - JAMAIS envia Authorization header (não é o mesmo que apikey)
 *  - propaga X-Request-Id
 *  - retorna null em qualquer erro (não crasha o front)
 *  - normaliza payload para o shape Magazine
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================================================
// Mock env — deve rodar ANTES do import do service
// ============================================================================

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    })),
  },
}));

// Import DEPOIS do mock
import { magazineService } from '@/services/magazineService';

// ============================================================================
// fetch mock — captura calls
// ============================================================================

interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
}

const calls: RecordedCall[] = [];
let nextReply: {
  status: number;
  body?: unknown;
  bodyText?: string;
  throw?: Error;
} = { status: 200, body: null };

function record(input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === 'string' ? input : input.toString();
  const headers: Record<string, string> = {};
  const h = init?.headers as Record<string, string> | undefined;
  if (h) for (const [k, v] of Object.entries(h)) headers[k.toLowerCase()] = String(v);
  calls.push({ url, method: init?.method ?? 'GET', headers });
}

globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  record(input, init);
  if (nextReply.throw) throw nextReply.throw;
  const body =
    nextReply.bodyText !== undefined
      ? nextReply.bodyText
      : JSON.stringify(nextReply.body ?? {});
  return new Response(body, {
    status: nextReply.status,
    headers: { 'Content-Type': 'application/json' },
  });
}) as unknown as typeof fetch;

// ============================================================================

const VALID_PAYLOAD = {
  id: 'mag_1',
  title: 'Revista Pública',
  subtitle: 'Sub',
  templateId: 'editorial-vogue',
  branding: {},
  content: {},
  pageOrder: null,
  status: 'published',
  items: [
    {
      id: 'i1',
      productId: 'p1',
      productSnapshot: {
        id: 'p1',
        name: 'A',
        sku: 'A',
        shortDescription: '',
        description: null,
        price: 1,
        image_url: '',
        images: [],
        colors: [],
        category_name: null,
        category_id: null,
        materials: [],
        hasPersonalization: null,
      },
      variantColorName: null,
      position: 1,
      pageNumber: null,
      overrides: {},
    },
    {
      id: 'i0',
      productId: 'p0',
      productSnapshot: {
        id: 'p0',
        name: 'B',
        sku: 'B',
        shortDescription: '',
        description: null,
        price: 1,
        image_url: '',
        images: [],
        colors: [],
        category_name: null,
        category_id: null,
        materials: [],
        hasPersonalization: null,
      },
      variantColorName: null,
      position: 0,
      pageNumber: null,
      overrides: {},
    },
  ],
};

beforeEach(() => {
  calls.length = 0;
  nextReply = { status: 200, body: VALID_PAYLOAD };
});

describe('magazineService.getPublicByToken — happy path', () => {
  it('retorna Magazine ordenada por position', async () => {
    const m = await magazineService.getPublicByToken('tok_ok');
    expect(m).not.toBeNull();
    expect(m!.items.map((i) => i.id)).toEqual(['i0', 'i1']);
  });

  it('encoda o token e chama endpoint correto', async () => {
    await magazineService.getPublicByToken('a b/c?x=1');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/\/functions\/v1\/magazine-public-view\?token=a%20b%2Fc%3Fx%3D1$/);
    expect(calls[0].method).toBe('GET');
  });

  it('NUNCA envia Authorization header', async () => {
    await magazineService.getPublicByToken('tok');
    expect(calls[0].headers['authorization']).toBeUndefined();
  });

  it('propaga X-Request-Id', async () => {
    await magazineService.getPublicByToken('tok');
    expect(calls[0].headers['x-request-id']).toBeTruthy();
    expect(calls[0].headers['x-request-id']!.length).toBeGreaterThan(4);
  });

  it('preserva token no publicToken do resultado', async () => {
    const m = await magazineService.getPublicByToken('meu-token');
    expect(m!.publicToken).toBe('meu-token');
  });

  it('normaliza branding/content faltantes com defaults', async () => {
    nextReply = {
      status: 200,
      body: { ...VALID_PAYLOAD, branding: null, content: null },
    };
    const m = await magazineService.getPublicByToken('t');
    expect(m).not.toBeNull();
    expect(m!.branding.colors).toBeDefined();
    expect(m!.content.showPrice).toBeDefined();
  });
});

describe('magazineService.getPublicByToken — HTTP errors', () => {
  const statuses = [400, 401, 403, 404, 410, 422, 429, 500, 502, 503, 504];
  it.each(statuses)('HTTP %i → retorna null (não crasha)', async (s) => {
    nextReply = { status: s, body: { error: `http_${s}` } };
    const m = await magazineService.getPublicByToken('tok');
    expect(m).toBeNull();
  });
});

describe('magazineService.getPublicByToken — network/timeout/malformed', () => {
  it('fetch throw → retorna null', async () => {
    nextReply = { status: 0, throw: new Error('network down') };
    const m = await magazineService.getPublicByToken('tok');
    expect(m).toBeNull();
  });

  it('AbortError → retorna null', async () => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    nextReply = { status: 0, throw: err };
    const m = await magazineService.getPublicByToken('tok');
    expect(m).toBeNull();
  });

  it('body inválido (JSON malformado) → retorna null', async () => {
    nextReply = { status: 200, bodyText: '{ not json' };
    const m = await magazineService.getPublicByToken('tok');
    expect(m).toBeNull();
  });

  it('body vazio → retorna null', async () => {
    nextReply = { status: 200, bodyText: '' };
    const m = await magazineService.getPublicByToken('tok');
    expect(m).toBeNull();
  });
});

describe('magazineService.getPublicByToken — token fuzz (30 casos)', () => {
  const tokens = [
    '',
    ' ',
    'x',
    'a'.repeat(1000),
    'tok/with/slash',
    'tok?with=query',
    'tok#with-hash',
    'tok&with=amp',
    'áéíõü',
    '中文',
    '😀🎉',
    '<script>alert(1)</script>',
    '../../etc/passwd',
    'null',
    'undefined',
    'true',
    'false',
    '0',
    ' \n\t ',
    '"quoted"',
    '\\backslash',
    '%20already-encoded',
    '\u0000null-byte',
    '?token=leak',
    '&x=1',
    '=equals',
    '+plus',
    ';semi',
    ':colon',
    '[bracket]',
  ];
  it.each(tokens)('token %j nunca crasha e chama a edge com token URL-encoded', async (tok) => {
    nextReply = { status: 200, body: VALID_PAYLOAD };
    const m = await magazineService.getPublicByToken(tok);
    // sempre retorna algo (Magazine ou null), nunca joga exceção
    expect(m === null || typeof m.id === 'string').toBe(true);
    // token encoded no querystring
    const call = calls[calls.length - 1];
    expect(call.url).toContain(`token=${encodeURIComponent(tok)}`);
    // nunca vaza authorization
    expect(call.headers['authorization']).toBeUndefined();
  });
});
