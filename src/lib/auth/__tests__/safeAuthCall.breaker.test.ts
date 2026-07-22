/**
 * safeAuthCall — Onda 11: circuit breaker tests.
 * Após 5 falhas server/network/timeout consecutivas, breaker abre por 60s.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { safeAuthCall, breakerIsOpen, __resetBreakers } from '@/lib/auth/safeAuthCall';
import { resetStructuredLoggerMock, structuredLoggerMockFactory } from '@/test/mockStructuredLogger';

vi.mock('@/lib/telemetry/structuredLogger', async () => {
  const mod = await import('@/test/mockStructuredLogger');
  return mod.structuredLoggerMockFactory();
});
void structuredLoggerMockFactory;

describe('safeAuthCall — circuit breaker (Onda 11)', () => {
  beforeEach(() => {
    __resetBreakers();
    resetStructuredLoggerMock();
  });

  it('abre após 5 falhas 500', async () => {
    for (let i = 0; i < 5; i++) {
      await safeAuthCall(
        async () => ({ data: null, error: { status: 500, message: 'boom' } }),
        { op: 'breakerA', maxRetries: 1, timeoutMs: 100 },
      );
    }
    expect(breakerIsOpen('breakerA')).toBe(true);
  });

  it('short-circuita quando aberto — attempts=0', async () => {
    for (let i = 0; i < 5; i++) {
      await safeAuthCall(
        async () => ({ data: null, error: { status: 500, message: 'boom' } }),
        { op: 'breakerB', maxRetries: 1 },
      );
    }
    let called = 0;
    const r = await safeAuthCall(
      async () => {
        called++;
        return { data: {}, error: null };
      },
      { op: 'breakerB', maxRetries: 1 },
    );
    expect(called).toBe(0);
    expect(r.kind).toBe('err');
    if (r.kind === 'err') expect(r.attempts).toBe(0);
  });

  it('credenciais 401 não abrem o breaker', async () => {
    for (let i = 0; i < 10; i++) {
      await safeAuthCall(
        async () => ({ data: null, error: { status: 401, message: 'invalid_credentials' } }),
        { op: 'breakerC', maxRetries: 1 },
      );
    }
    expect(breakerIsOpen('breakerC')).toBe(false);
  });

  it('sucesso reseta contador', async () => {
    for (let i = 0; i < 4; i++) {
      await safeAuthCall(
        async () => ({ data: null, error: { status: 500, message: 'boom' } }),
        { op: 'breakerD', maxRetries: 1 },
      );
    }
    await safeAuthCall(async () => ({ data: {}, error: null }), {
      op: 'breakerD',
      maxRetries: 1,
    });
    // agora 3 falhas não devem abrir
    for (let i = 0; i < 3; i++) {
      await safeAuthCall(
        async () => ({ data: null, error: { status: 500, message: 'boom' } }),
        { op: 'breakerD', maxRetries: 1 },
      );
    }
    expect(breakerIsOpen('breakerD')).toBe(false);
  });
});
