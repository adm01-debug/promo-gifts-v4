/**
 * Contratos invokeEdge — 4 edges críticas: secrets-manager, visual-search,
 * connection-tester, dropbox-list.
 *
 * Foco: garantir o shape do envelope (sucesso + erro) consumido pelos call
 * sites reais. Mocka `supabase.functions.invoke` — não bate na rede.
 *
 * Espelha o padrão de `src/lib/edge/__tests__/safeInvokeCall.test.ts`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __resetBreakers } from '@/lib/auth/safeAuthCall';
import {
  resetStructuredLoggerMock,
  structuredLoggerMockFactory,
} from '@/test/mockStructuredLogger';

vi.mock('@/lib/telemetry/structuredLogger', async () => {
  const mod = await import('@/test/mockStructuredLogger');
  return mod.structuredLoggerMockFactory();
});
void structuredLoggerMockFactory;

const mockInvoke = vi.fn();
vi.mock('@/integrations/supabase/lazy-client', () => ({
  getSupabaseClient: async () => ({ functions: { invoke: mockInvoke } }),
}));

import { invokeEdge } from '@/lib/edge/safeInvokeCall';

// ─── Helpers ───────────────────────────────────────────────────────────────
function ok<T>(data: T) {
  mockInvoke.mockResolvedValueOnce({ data, error: null });
}
function httpErr(status: number, body?: unknown) {
  mockInvoke.mockResolvedValueOnce({
    data: null,
    error: {
      name: 'FunctionsHttpError',
      message: `HTTP ${status}`,
      context: { status, body },
    },
  });
}
function relayErr() {
  mockInvoke.mockResolvedValueOnce({
    data: null,
    error: { name: 'FunctionsRelayError', message: 'relay down' },
  });
}

beforeEach(() => {
  __resetBreakers();
  resetStructuredLoggerMock();
  mockInvoke.mockReset();
});

// ─── secrets-manager ───────────────────────────────────────────────────────
describe('invokeEdge contract — secrets-manager', () => {
  it('cache_metrics: sucesso devolve envelope { ok, metrics }', async () => {
    ok({ ok: true, metrics: { hits: 42, misses: 3 } });
    const r = await invokeEdge<{ ok?: boolean; metrics?: { hits: number; misses: number } }>(
      'secrets-manager',
      { body: { action: 'cache_metrics' } },
    );
    expect(r.error).toBeNull();
    expect(r.data?.ok).toBe(true);
    expect(r.data?.metrics?.hits).toBe(42);
    expect(r.requestId).toMatch(/[0-9a-f-]{16,}/i);
  });

  it('reset_cache_metrics: 403 → error credential, data=null', async () => {
    httpErr(403, { error: 'forbidden' });
    const r = await invokeEdge<{ ok?: boolean }>('secrets-manager', {
      body: { action: 'reset_cache_metrics' },
      maxRetries: 1,
    });
    expect(r.data).toBeNull();
    expect(r.error?.name).toBe('credential');
    expect(r.error?.request_id).toBeDefined();
  });

  it('erro embutido em envelope (200) é preservado para o caller', async () => {
    ok({ ok: false, error: { message: 'secret_not_found' } });
    const r = await invokeEdge<{ ok?: boolean; error?: { message?: string } }>(
      'secrets-manager',
      { body: { action: 'cache_metrics' } },
    );
    // 200 com error no body é sucesso do wrapper — a UI trata o `ok:false`.
    expect(r.error).toBeNull();
    expect(r.data?.ok).toBe(false);
    expect(r.data?.error?.message).toBe('secret_not_found');
  });
});

// ─── visual-search ─────────────────────────────────────────────────────────
describe('invokeEdge contract — visual-search', () => {
  it('sucesso devolve { products, analysis }', async () => {
    ok({
      products: [{ id: 'p1', name: 'Caneta', score: 0.9 }],
      analysis: { dominantColor: '#ff0000', tags: ['office'] },
    });
    const r = await invokeEdge<{
      products: Array<{ id: string; name: string; score: number }>;
      analysis: { dominantColor: string; tags: string[] };
      error?: string;
    }>('visual-search', { body: { image: 'data:image/png;base64,xxx' } });
    expect(r.error).toBeNull();
    expect(r.data?.products).toHaveLength(1);
    expect(r.data?.analysis.dominantColor).toBe('#ff0000');
  });

  it('429 (rate limit) → errorKind=ratelimit', async () => {
    httpErr(429);
    const r = await invokeEdge('visual-search', { body: {}, maxRetries: 1 });
    expect(r.error?.name).toBe('ratelimit');
  });

  it('500 sem body → errorKind=server, requestId propagado', async () => {
    httpErr(500);
    const r = await invokeEdge('visual-search', { body: {}, maxRetries: 1 });
    expect(r.error?.name).toBe('server');
    expect(r.error?.request_id).toBeTruthy();
    expect(r.requestId).toBe(r.error?.request_id);
  });

  it('erro semântico em envelope 200 (e.g. imagem inválida) chega ao caller', async () => {
    ok({ products: [], analysis: null, error: 'invalid_image' });
    const r = await invokeEdge<{ products: unknown[]; error?: string }>('visual-search', {
      body: { image: 'garbage' },
    });
    expect(r.error).toBeNull();
    expect(r.data?.error).toBe('invalid_image');
    expect(r.data?.products).toEqual([]);
  });
});

// ─── connection-tester ─────────────────────────────────────────────────────
describe('invokeEdge contract — connection-tester', () => {
  it('list_history: envelope { items, total }', async () => {
    ok({
      items: [
        { id: 't1', status: 'ok', latency_ms: 120 },
        { id: 't2', status: 'fail', latency_ms: 5000 },
      ],
      total: 2,
    });
    const r = await invokeEdge<{
      items?: Array<{ id: string; status: string; latency_ms: number }>;
      total?: number;
    }>('connection-tester', { body: { action: 'list_history', limit: 10 } });
    expect(r.error).toBeNull();
    expect(r.data?.total).toBe(2);
    expect(r.data?.items?.[0].status).toBe('ok');
  });

  it('test_now: sucesso devolve { ok, latency_ms }', async () => {
    ok({ ok: true, latency_ms: 87 });
    const r = await invokeEdge<{ ok?: boolean; latency_ms?: number }>('connection-tester', {
      body: { action: 'test_now', connection_id: 'std_abc' },
    });
    expect(r.data?.ok).toBe(true);
    expect(r.data?.latency_ms).toBeGreaterThan(0);
  });

  it('relay error → errorKind=network (retryable)', async () => {
    relayErr();
    relayErr();
    const r = await invokeEdge('connection-tester', {
      body: { action: 'test_now' },
      maxRetries: 1,
    });
    expect(r.error?.name).toBe('network');
  });

  it('401 (JWT ausente/inválido) → errorKind=credential', async () => {
    httpErr(401, { error: 'unauthorized' });
    const r = await invokeEdge('connection-tester', {
      body: { action: 'list_history' },
      maxRetries: 1,
    });
    expect(r.error?.name).toBe('credential');
  });
});

// ─── dropbox-list ──────────────────────────────────────────────────────────
describe('invokeEdge contract — dropbox-list', () => {
  it('action=check: envelope { connected }', async () => {
    ok({ connected: true });
    const r = await invokeEdge<{ connected?: boolean }>('dropbox-list', {
      body: { action: 'check' },
    });
    expect(r.error).toBeNull();
    expect(r.data?.connected).toBe(true);
  });

  it('action=list: envelope { entries }', async () => {
    ok({
      entries: [
        { name: 'logo.png', path: '/logo.png', size: 1024, is_folder: false },
        { name: 'assets', path: '/assets', size: 0, is_folder: true },
      ],
    });
    const r = await invokeEdge<{
      entries?: Array<{ name: string; path: string; size: number; is_folder: boolean }>;
    }>('dropbox-list', { body: { action: 'list', path: '/' } });
    expect(r.data?.entries).toHaveLength(2);
    expect(r.data?.entries?.[1].is_folder).toBe(true);
  });

  it('sem conexão Dropbox: envelope { connected: false } (200)', async () => {
    ok({ connected: false });
    const r = await invokeEdge<{ connected?: boolean }>('dropbox-list', {
      body: { action: 'check' },
    });
    expect(r.error).toBeNull();
    expect(r.data?.connected).toBe(false);
  });

  it('502 upstream → errorKind=server, data=null', async () => {
    httpErr(502);
    const r = await invokeEdge('dropbox-list', {
      body: { action: 'list', path: '/' },
      maxRetries: 1,
    });
    expect(r.data).toBeNull();
    expect(r.error?.name).toBe('server');
  });

  it('TypeError:Failed to fetch → nunca lança, errorKind=network', async () => {
    mockInvoke.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    mockInvoke.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const r = await invokeEdge('dropbox-list', {
      body: { action: 'check' },
      maxRetries: 1,
    });
    expect(r.error?.name).toBe('network');
    expect(r.requestId).toBeTruthy();
  });
});

// ─── Cross-cutting: X-Request-Id ────────────────────────────────────────────
describe('invokeEdge contract — X-Request-Id propagation', () => {
  it('propaga requestId fornecido pelo caller em outboundHeaders', async () => {
    ok({ ok: true });
    const providedId = '00000000-0000-4000-8000-000000000001';
    await invokeEdge('secrets-manager', {
      body: { action: 'cache_metrics' },
      requestId: providedId,
    });
    const [, opts] = mockInvoke.mock.calls[0] as [string, { headers?: Record<string, string> }];
    const headers = opts.headers ?? {};
    const idHeader = Object.entries(headers).find(([k]) => k.toLowerCase() === 'x-request-id')?.[1];
    expect(idHeader).toBe(providedId);
  });

  it('gera requestId estável entre 4 fluxos distintos (não colide)', async () => {
    ok({ ok: true });
    ok({ products: [], analysis: null });
    ok({ ok: true, latency_ms: 10 });
    ok({ connected: true });
    const [r1, r2, r3, r4] = await Promise.all([
      invokeEdge('secrets-manager', { body: {} }),
      invokeEdge('visual-search', { body: {} }),
      invokeEdge('connection-tester', { body: {} }),
      invokeEdge('dropbox-list', { body: {} }),
    ]);
    const ids = [r1.requestId, r2.requestId, r3.requestId, r4.requestId];
    expect(new Set(ids).size).toBe(4);
    for (const id of ids) expect(id).toMatch(/[0-9a-f-]{16,}/i);
  });
});
