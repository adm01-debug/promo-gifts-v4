/**
 * Onda 17 — Contrato do invokeEdgeSafe.
 * Garante nunca-throw + classificação correta das 3 classes de erro do supabase-js.
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

import { invokeEdgeSafe, normalizeInvokeError } from '@/lib/edge/safeInvokeCall';

describe('safeInvokeCall — Onda 17', () => {
  beforeEach(() => {
    __resetBreakers();
    resetStructuredLoggerMock();
    mockInvoke.mockReset();
  });

  it('ok → kind=ok, data propagada', async () => {
    mockInvoke.mockResolvedValue({ data: { foo: 1 }, error: null });
    const r = await invokeEdgeSafe<{ foo: number }>('my-fn', { body: {} });
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect(r.data).toEqual({ foo: 1 });
  });

  it('data=null (204) → ok/null', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });
    const r = await invokeEdgeSafe('empty');
    expect(r.kind).toBe('ok');
  });

  it.each([
    [401, 'credential'],
    [403, 'credential'],
    [429, 'ratelimit'],
    [500, 'server'],
    [502, 'server'],
  ] as const)('status=%i → err/%s', async (status, kind) => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { name: 'FunctionsHttpError', message: 'x', context: { status } },
    });
    const r = await invokeEdgeSafe('x', { maxRetries: 1 });
    expect(r.kind).toBe('err');
    if (r.kind === 'err') expect(r.errorKind).toBe(kind);
  });

  it('FunctionsRelayError → err/network (retryable)', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { name: 'FunctionsRelayError', message: 'relay down' },
    });
    const r = await invokeEdgeSafe('x', { maxRetries: 1 });
    expect(r.kind).toBe('err');
    if (r.kind === 'err') expect(r.errorKind).toBe('network');
  });

  it('throw TypeError:Failed to fetch → nunca lança, err/network', async () => {
    mockInvoke.mockRejectedValue(new TypeError('Failed to fetch'));
    const r = await invokeEdgeSafe('x', { maxRetries: 1 });
    expect(r.kind).toBe('err');
    if (r.kind === 'err') expect(r.errorKind).toBe('network');
  });

  it('body JSON quebrado no context.body → não explode, msg fallback', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        name: 'FunctionsHttpError',
        message: 'bad',
        context: { status: 500, body: '<html>proxy error</html>' },
      },
    });
    const r = await invokeEdgeSafe('x', { maxRetries: 1 });
    expect(r.kind).toBe('err');
    if (r.kind === 'err') expect(r.userMessage.length).toBeGreaterThan(0);
  });

  it('body JSON válido com {error:"..."} → mensagem extraída', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        name: 'FunctionsHttpError',
        message: 'fallback',
        context: { status: 500, body: JSON.stringify({ error: 'db offline' }) },
      },
    });
    const norm = normalizeInvokeError({
      name: 'FunctionsHttpError',
      message: 'fallback',
      context: { status: 500, body: JSON.stringify({ error: 'db offline' }) },
    });
    expect(norm.message).toBe('db offline');
    const r = await invokeEdgeSafe('x', { maxRetries: 1 });
    expect(r.kind).toBe('err');
  });

  it('AbortSignal externo já abortado → err imediato', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    mockInvoke.mockResolvedValue({ data: {}, error: null });
    const r = await invokeEdgeSafe('x', { signal: ctrl.signal, maxRetries: 1 });
    expect(r.kind).toBe('err');
  });

  it('userMessage nunca vaza status bruto (não-dev)', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        name: 'FunctionsHttpError',
        message: '500: internal boom stack at foo.ts:12',
        context: { status: 500 },
      },
    });
    const r = await invokeEdgeSafe('x', { maxRetries: 1, isDev: false });
    if (r.kind === 'err') {
      expect(r.userMessage).not.toMatch(/\bstack\b/i);
      expect(r.userMessage).not.toMatch(/foo\.ts/);
    }
  });

  it('breaker isolado por fnName (5 falhas → open)', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { name: 'FunctionsHttpError', message: 'x', context: { status: 500 } },
    });
    for (let i = 0; i < 5; i++) {
      await invokeEdgeSafe('fn-a', { maxRetries: 1 });
    }
    mockInvoke.mockClear();
    const r = await invokeEdgeSafe('fn-a', { maxRetries: 1 });
    expect(r.kind).toBe('err');
    expect(mockInvoke).not.toHaveBeenCalled(); // short-circuit
    // outra fn não é afetada
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
    const r2 = await invokeEdgeSafe('fn-b', { maxRetries: 1 });
    expect(r2.kind).toBe('ok');
  });

  // Fuzz aleatório × 60
  it('fuzz × 60 — invariante nunca-throw', async () => {
    for (let i = 0; i < 60; i++) {
      const roll = Math.random();
      if (roll < 0.2) mockInvoke.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      else if (roll < 0.4)
        mockInvoke.mockResolvedValueOnce({
          data: null,
          error: { name: 'FunctionsHttpError', message: 'x', context: { status: 500 } },
        });
      else if (roll < 0.6)
        mockInvoke.mockResolvedValueOnce({
          data: null,
          error: { name: 'FunctionsHttpError', message: 'x', context: { status: 429 } },
        });
      else if (roll < 0.8)
        mockInvoke.mockResolvedValueOnce({
          data: null,
          error: { name: 'FunctionsHttpError', message: 'x', context: { status: 401 } },
        });
      else mockInvoke.mockResolvedValueOnce({ data: { ok: 1 }, error: null });
      const r = await invokeEdgeSafe('fuzz', { maxRetries: 1, timeoutMs: 200 });
      expect(['ok', 'err']).toContain(r.kind);
      if (r.kind === 'err') expect(r.userMessage.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// Onda 20 — Telemetria & Propagação de X-Request-Id
// ============================================================================
import {
  filterLoggerEvents,
  findLoggerEvent,
} from '@/test/mockStructuredLogger';
import { REQUEST_ID_HEADER } from '@/lib/telemetry/requestId';

describe('safeInvokeCall — Onda 20 telemetria', () => {
  beforeEach(() => {
    __resetBreakers();
    resetStructuredLoggerMock();
    mockInvoke.mockReset();
  });

  it('sucesso → emite start + ok com request_id e latency_ms', async () => {
    mockInvoke.mockResolvedValue({ data: { x: 1 }, error: null });
    const r = await invokeEdgeSafe('my-fn', { body: { a: 1 } });
    expect(r.kind).toBe('ok');
    const start = findLoggerEvent('edge.invoke', 'edge_invoke_start');
    const ok = findLoggerEvent('edge.invoke', 'edge_invoke_ok');
    expect(start?.fields.fn).toBe('my-fn');
    expect(start?.fields.request_id).toMatch(/^[0-9a-f-]{16,}$/);
    expect(ok?.fields.fn).toBe('my-fn');
    expect(ok?.fields.request_id).toBe(start?.fields.request_id);
    expect(typeof ok?.fields.latency_ms).toBe('number');
  });

  it('falha → emite edge_invoke_failed com error_kind e latency_ms', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { name: 'FunctionsHttpError', message: 'x', context: { status: 500 } },
    });
    const r = await invokeEdgeSafe('my-fn', { maxRetries: 1 });
    expect(r.kind).toBe('err');
    const failed = findLoggerEvent('edge.invoke', 'edge_invoke_failed');
    expect(failed?.fields.error_kind).toBe('server');
    expect(failed?.fields.fn).toBe('my-fn');
    expect(typeof failed?.fields.latency_ms).toBe('number');
  });

  it('breaker aberto → emite edge_invoke_breaker_open', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { name: 'FunctionsHttpError', message: 'x', context: { status: 500 } },
    });
    for (let i = 0; i < 5; i++) {
      await invokeEdgeSafe('bk-fn', { maxRetries: 1 });
    }
    resetStructuredLoggerMock();
    const r = await invokeEdgeSafe('bk-fn', { maxRetries: 1 });
    expect(r.kind).toBe('err');
    const brk = findLoggerEvent('edge.invoke', 'edge_invoke_breaker_open');
    expect(brk?.fields.fn).toBe('bk-fn');
  });

  it('injeta X-Request-Id outbound (gerado) quando caller não fornece', async () => {
    mockInvoke.mockResolvedValue({ data: {}, error: null });
    const r = await invokeEdgeSafe('hdr-fn', {});
    expect(r.kind).toBe('ok');
    const call = mockInvoke.mock.calls[0];
    const hdrs = call?.[1]?.headers as Record<string, string>;
    expect(hdrs[REQUEST_ID_HEADER]).toBeTruthy();
    expect(hdrs[REQUEST_ID_HEADER]).toBe(r.requestId);
  });

  it('respeita X-Request-Id fornecido via option.requestId', async () => {
    mockInvoke.mockResolvedValue({ data: {}, error: null });
    const fixed = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const r = await invokeEdgeSafe('hdr-fn', { requestId: fixed });
    expect(r.requestId).toBe(fixed);
    const hdrs = mockInvoke.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(hdrs[REQUEST_ID_HEADER]).toBe(fixed);
  });

  it('respeita X-Request-Id fornecido via headers custom', async () => {
    mockInvoke.mockResolvedValue({ data: {}, error: null });
    const fixed = 'cccccccc-dddd-4eee-8fff-000000000000';
    const r = await invokeEdgeSafe('hdr-fn', {
      headers: { [REQUEST_ID_HEADER]: fixed },
    });
    expect(r.requestId).toBe(fixed);
    const hdrs = mockInvoke.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(hdrs[REQUEST_ID_HEADER]).toBe(fixed);
  });

  it('fuzz × 120 — sempre emite start; ok|failed|breaker_open depois', async () => {
    for (let i = 0; i < 120; i++) {
      resetStructuredLoggerMock();
      const roll = Math.random();
      if (roll < 0.25) mockInvoke.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      else if (roll < 0.5)
        mockInvoke.mockResolvedValueOnce({
          data: null,
          error: { name: 'FunctionsHttpError', message: 'x', context: { status: 500 } },
        });
      else if (roll < 0.75)
        mockInvoke.mockResolvedValueOnce({
          data: null,
          error: { name: 'FunctionsHttpError', message: 'x', context: { status: 429 } },
        });
      else mockInvoke.mockResolvedValueOnce({ data: { ok: 1 }, error: null });
      const r = await invokeEdgeSafe(`fz-${i % 3}`, { maxRetries: 1, timeoutMs: 200 });
      const starts = filterLoggerEvents('edge.invoke', 'edge_invoke_start');
      expect(starts.length).toBe(1);
      // request_id do resultado bate com o do log
      expect(starts[0].fields.request_id).toBe(r.requestId);
      const terminal =
        findLoggerEvent('edge.invoke', 'edge_invoke_ok') ||
        findLoggerEvent('edge.invoke', 'edge_invoke_failed') ||
        findLoggerEvent('edge.invoke', 'edge_invoke_breaker_open');
      expect(terminal).toBeTruthy();
    }
  });
});
