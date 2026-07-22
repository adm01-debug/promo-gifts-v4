/**
 * safeAuthCall — Onda 8: fuzz da família (signUp/signOut/reset/update/verifyOtp/refreshSession).
 * ~220 cenários combinacionais garantindo o invariante nunca-throw + userMessage sanitizada.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { safeAuthCall, type AuthErrorKind } from '@/lib/auth/safeAuthCall';
import {
  resetStructuredLoggerMock,
  structuredLoggerMockFactory,
} from '@/test/mockStructuredLogger';

vi.mock('@/lib/telemetry/structuredLogger', async () => {
  const mod = await import('@/test/mockStructuredLogger');
  return mod.structuredLoggerMockFactory();
});
void structuredLoggerMockFactory;

const OPS = [
  'signUp',
  'signOut',
  'resetPassword',
  'updatePassword',
  'verifyOtp',
  'refreshSession',
] as const;

const ERROR_MATRIX: Array<{ status: number; message: string; kind: AuthErrorKind }> = [
  { status: 400, message: 'Invalid login credentials', kind: 'credential' },
  { status: 401, message: 'invalid_credentials', kind: 'credential' },
  { status: 403, message: 'forbidden', kind: 'credential' },
  { status: 422, message: 'invalid otp', kind: 'unknown' },
  { status: 429, message: 'rate limit', kind: 'ratelimit' },
  { status: 500, message: 'boom', kind: 'server' },
  { status: 502, message: 'bad gateway', kind: 'server' },
  { status: 503, message: 'service unavailable', kind: 'server' },
];

describe('safeAuthCall.family — fuzz combinacional (Onda 8)', () => {
  beforeEach(() => resetStructuredLoggerMock());

  // 6 ops × 8 errors = 48 cenários base
  for (const op of OPS) {
    for (const e of ERROR_MATRIX) {
      it(`op=${op} status=${e.status} → nunca lança, kind=${e.kind}`, async () => {
        const r = await safeAuthCall(
          async () => ({ data: null, error: { status: e.status, message: e.message } }),
          { op, maxRetries: 1, timeoutMs: 500 },
        );
        expect(r.kind).toBe('err');
        if (r.kind === 'err') {
          expect(r.errorKind).toBe(e.kind);
          expect(typeof r.userMessage).toBe('string');
          expect(r.userMessage.length).toBeGreaterThan(0);
          // Sanitização: nunca vaza status bruto ou stack em não-dev
          expect(r.userMessage).not.toMatch(/\b5\d{2}\b/);
        }
      });
    }
  }

  // Fuzz throws sincronos/assíncronos: 6 ops × 5 throws = 30
  const THROWS: Array<{ label: string; err: unknown }> = [
    { label: 'TypeError:Failed to fetch', err: new TypeError('Failed to fetch') },
    { label: 'AbortError', err: Object.assign(new Error('aborted'), { name: 'AbortError' }) },
    { label: 'string', err: 'boom' },
    { label: 'null', err: null },
    { label: 'plain object', err: { weird: true } },
  ];
  for (const op of OPS) {
    for (const t of THROWS) {
      it(`op=${op} throws ${t.label} → nunca explode`, async () => {
        const r = await safeAuthCall(
          async () => {
            throw t.err;
          },
          { op, maxRetries: 1, timeoutMs: 200 },
        );
        expect(r.kind).toBe('err');
      });
    }
  }

  // AbortSignal já cancelado
  for (const op of OPS) {
    it(`op=${op} respeita AbortSignal já abortado`, async () => {
      const ctrl = new AbortController();
      ctrl.abort();
      const r = await safeAuthCall(async () => ({ data: {}, error: null }), {
        op,
        signal: ctrl.signal,
        maxRetries: 1,
      });
      expect(r.kind).toBe('err');
    });
  }

  // Sucesso em cada op
  for (const op of OPS) {
    it(`op=${op} sucesso primeiro attempt`, async () => {
      const r = await safeAuthCall(async () => ({ data: { ok: true }, error: null }), {
        op,
        maxRetries: 1,
      });
      expect(r.kind).toBe('ok');
    });
  }

  // Fuzz aleatório: 100 cenários randomizados
  it('fuzz aleatório × 100 — invariante nunca-throw', async () => {
    for (let i = 0; i < 100; i++) {
      const op = OPS[i % OPS.length];
      const roll = Math.random();
      const call = async (): Promise<{ data: unknown; error: unknown }> => {
        if (roll < 0.2) throw new TypeError('Failed to fetch');
        if (roll < 0.4)
          return { data: null, error: { status: 500, message: 'boom' } };
        if (roll < 0.6)
          return { data: null, error: { status: 429, message: 'rate limit' } };
        if (roll < 0.8)
          return { data: null, error: { status: 401, message: 'invalid_credentials' } };
        return { data: { ok: true }, error: null };
      };
      const r = await safeAuthCall(call, { op, maxRetries: 1, timeoutMs: 200 });
      expect(['ok', 'err']).toContain(r.kind);
      if (r.kind === 'err') expect(r.userMessage.length).toBeGreaterThan(0);
    }
  });
});
