/**
 * safeMfaCall — Onda 9: 150+ cenários MFA (enroll/challenge/verify/unenroll) + race.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { safeMfaCall, type MfaErrorKind } from '@/lib/auth/safeMfaCall';
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

const OPS = ['mfaEnroll', 'mfaChallenge', 'mfaVerify', 'mfaUnenroll'] as const;

const MFA_ERRORS: Array<{ status: number; message: string; kind: MfaErrorKind }> = [
  { status: 400, message: 'Invalid otp code', kind: 'invalid_code' },
  { status: 422, message: 'invalid token', kind: 'invalid_code' },
  { status: 401, message: 'challenge expired', kind: 'expired_challenge' },
  { status: 403, message: 'factor locked — too many attempts', kind: 'factor_locked' },
  { status: 429, message: 'rate limit', kind: 'ratelimit' },
  { status: 500, message: 'boom', kind: 'server' },
  { status: 503, message: 'unavailable', kind: 'server' },
];

describe('safeMfaCall — fuzz classificação (Onda 9)', () => {
  beforeEach(() => {
    __resetBreakers();
    resetStructuredLoggerMock();
  });

  for (const op of OPS) {
    for (const e of MFA_ERRORS) {
      it(`op=${op} status=${e.status} msg="${e.message}" → kind=${e.kind}`, async () => {
        const r = await safeMfaCall(
          () => Promise.resolve({ data: null, error: { status: e.status, message: e.message } }),
          { op, maxRetries: 1, timeoutMs: 300 },
        );
        expect(r.kind).toBe('err');
        if (r.kind === 'err') {
          expect(r.errorKind).toBe(e.kind);
          expect(r.userMessage.length).toBeGreaterThan(0);
        }
      });
    }
  }

  // Sucesso
  for (const op of OPS) {
    it(`op=${op} sucesso`, async () => {
      const r = await safeMfaCall(() => Promise.resolve({ data: { id: 'f1' }, error: null }), {
        op,
        maxRetries: 1,
      });
      expect(r.kind).toBe('ok');
    });
  }

  // Throws
  const THROWS = [
    new TypeError('Failed to fetch'),
    Object.assign(new Error('aborted'), { name: 'AbortError' }),
    'boom',
    null,
  ];
  for (const op of OPS) {
    for (const t of THROWS) {
      it(`op=${op} throws ${String((t as { name?: string } | null)?.name ?? typeof t)} → err`, async () => {
        const r = await safeMfaCall(
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          () => Promise.reject(t),
          { op, maxRetries: 1, timeoutMs: 200 },
        );
        expect(r.kind).toBe('err');
      });
    }
  }

  // AbortSignal
  for (const op of OPS) {
    it(`op=${op} aborta imediatamente se signal já abortado`, async () => {
      const c = new AbortController();
      c.abort();
      const r = await safeMfaCall(() => Promise.resolve({ data: {}, error: null }), {
        op,
        signal: c.signal,
        maxRetries: 1,
      });
      expect(r.kind).toBe('err');
    });
  }

  // Race — 3 challenges concorrentes, apenas 1 sucesso possível
  it('race entre 3 challenges concorrentes — invariante nunca-throw em todos', async () => {
    const results = await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        safeMfaCall(
          () =>
            i === 0
              ? Promise.resolve({ data: { id: 'ok' }, error: null })
              : Promise.resolve({
                  data: null,
                  error: { status: 401, message: 'challenge expired' },
                }),
          { op: 'mfaChallenge', maxRetries: 1, timeoutMs: 200 },
        ),
      ),
    );
    expect(results.every((r) => r.kind === 'ok' || r.kind === 'err')).toBe(true);
    expect(results.filter((r) => r.kind === 'ok').length).toBe(1);
  });

  // Fuzz aleatório × 80
  it('fuzz aleatório × 80', async () => {
    for (let i = 0; i < 80; i++) {
      const op = OPS[i % OPS.length];
      const roll = Math.random();
      const call = (): Promise<{ data: unknown; error: unknown }> => {
        if (roll < 0.15) return Promise.reject(new TypeError('Failed to fetch'));
        if (roll < 0.35)
          return Promise.resolve({ data: null, error: { status: 422, message: 'invalid otp' } });
        if (roll < 0.55)
          return Promise.resolve({ data: null, error: { status: 401, message: 'expired' } });
        if (roll < 0.7)
          return Promise.resolve({ data: null, error: { status: 500, message: 'boom' } });
        return Promise.resolve({ data: { ok: true }, error: null });
      };
      const r = await safeMfaCall(call, { op, maxRetries: 1, timeoutMs: 150 });
      expect(['ok', 'err']).toContain(r.kind);
    }
  });
});
