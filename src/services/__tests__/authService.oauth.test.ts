/**
 * Onda 16 — Contrato dos wrappers OAuth Safe.
 * signInWithOAuthSafe + exchangeCodeForSessionSafe: nunca lançam, classificam errorKind.
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

const mockAuth = {
  signInWithOAuth: vi.fn(),
  exchangeCodeForSession: vi.fn(),
};
vi.mock('@/integrations/supabase/lazy-client', () => ({
  getSupabaseClient: () => Promise.resolve({ auth: mockAuth }),
}));

import { authService } from '@/services/authService';

describe('authService — Onda 16 (OAuth Safe wrappers)', () => {
  beforeEach(() => {
    __resetBreakers();
    resetStructuredLoggerMock();
    vi.clearAllMocks();
  });

  describe('signInWithOAuthSafe', () => {
    it('ok → kind=ok', async () => {
      mockAuth.signInWithOAuth.mockResolvedValue({ data: { url: 'https://x' }, error: null });
      const r = await authService.signInWithOAuthSafe({ provider: 'google', redirectTo: '/x' });
      expect(r.kind).toBe('ok');
    });
    for (const [status, kind] of [
      [429, 'ratelimit'],
      [500, 'server'],
      [401, 'credential'],
    ] as const) {
      it(`status=${status} → err/${kind}`, async () => {
        mockAuth.signInWithOAuth.mockResolvedValue({
          data: null,
          error: { status, message: 'x' },
        });
        const r = await authService.signInWithOAuthSafe({ provider: 'google' });
        expect(r.kind).toBe('err');
        if (r.kind === 'err') expect(r.errorKind).toBe(kind);
      });
    }
    it('throw TypeError → nunca lança', async () => {
      mockAuth.signInWithOAuth.mockRejectedValue(new TypeError('Failed to fetch'));
      const r = await authService.signInWithOAuthSafe({ provider: 'google' });
      expect(r.kind).toBe('err');
    });
  });

  describe('exchangeCodeForSessionSafe', () => {
    it('ok', async () => {
      mockAuth.exchangeCodeForSession.mockResolvedValue({
        data: { session: { user: {} } },
        error: null,
      });
      const r = await authService.exchangeCodeForSessionSafe('code-123');
      expect(r.kind).toBe('ok');
    });
    it('server 500 → err/server', async () => {
      mockAuth.exchangeCodeForSession.mockResolvedValue({
        data: null,
        error: { status: 500, message: 'boom' },
      });
      const r = await authService.exchangeCodeForSessionSafe('code-x');
      expect(r.kind).toBe('err');
      if (r.kind === 'err') expect(r.errorKind).toBe('server');
    });
    it('throw AbortError → err', async () => {
      mockAuth.exchangeCodeForSession.mockRejectedValue(
        Object.assign(new Error('abort'), { name: 'AbortError' }),
      );
      const r = await authService.exchangeCodeForSessionSafe('c');
      expect(r.kind).toBe('err');
    });
  });
});
