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
    const norm = await normalizeInvokeError({
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
