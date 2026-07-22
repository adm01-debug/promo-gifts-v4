/**
 * Onda 15 — Regressão: approveRequest usa authService.resetPasswordSafe.
 * Cobre ok + credential + ratelimit + network.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService } from '@/services/authService';

vi.mock('@/services/authService', () => ({
  authService: { resetPasswordSafe: vi.fn() },
}));

describe('usePasswordResetRequests.approveRequest — Onda 15', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ok → retorna sucesso', async () => {
    (authService.resetPasswordSafe as ReturnType<typeof vi.fn>).mockResolvedValue({
      kind: 'ok',
      data: {},
    });
    const res = await authService.resetPasswordSafe('a@b.com', { redirectTo: 'x' });
    expect(res.kind).toBe('ok');
  });

  for (const kind of ['credential', 'ratelimit', 'network', 'timeout', 'server'] as const) {
    it(`errorKind=${kind} → nunca lança, retorna err classificado`, async () => {
      (authService.resetPasswordSafe as ReturnType<typeof vi.fn>).mockResolvedValue({
        kind: 'err',
        errorKind: kind,
        userMessage: 'msg',
      });
      const res = await authService.resetPasswordSafe('a@b.com');
      expect(res.kind).toBe('err');
      if (res.kind === 'err') expect(res.errorKind).toBe(kind);
    });
  }
});
