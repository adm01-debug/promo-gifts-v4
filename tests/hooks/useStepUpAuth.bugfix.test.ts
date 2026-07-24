/**
 * Testes de regressão — BUG-01
 * Arquivo: src/hooks/auth/useStepUpAuth.ts
 *
 * BUG: stale closure em challengeId.
 * verifyPassword, verifyOtp e cancel capturavam state.challengeId = null
 * via closure, mesmo depois de requestChallenge ser resolvido.
 *
 * FIX: challengeIdRef (useRef) atualizado SINCRONAMENTE antes do setState.
 *
 * Estratégia de teste: mock do supabase.functions.invoke, capturando os
 * body.challenge_id enviados para a Edge Function. O bug faria challenge_id=null.
 * Com o fix, challenge_id deve ser o valor real retornado por requestChallenge.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ─── Mock Supabase ─────────────────────────────────────────────────────────
// BUG-HOIST: vi.mock é hoisted antes das declarações const. Usar vi.hoisted()
// para que mockInvoke seja inicializado antes da factory do vi.mock executar.

const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
}));

vi.mock('../../src/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
  },
}));

vi.mock('../../src/lib/security/sanitize-error', () => ({
  sanitizeError: (e: unknown) => String(e),
  SAFE_MESSAGES: {
    AUTH_GENERIC: 'Erro de autenticação',
    STEP_UP_FAILED: 'Falha na verificação',
  },
}));

// ─── Import após mock ──────────────────────────────────────────────────────

import { useStepUpAuth } from '../../src/hooks/auth/useStepUpAuth';

// ─── Testes ────────────────────────────────────────────────────────────────

describe('useStepUpAuth – BUG-01: challengeId não deve ser null em verifyPassword/verifyOtp/cancel', () => {
  const CHALLENGE_ID = 'challenge-abc-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifyPassword deve enviar challenge_id correto (não null) após requestChallenge', async () => {
    // requestChallenge retorna challenge_id
    mockInvoke.mockImplementation(async (_: string, opts: { body: Record<string, unknown> }) => {
      if (opts.body.step === 'request') {
        return { data: { challenge_id: CHALLENGE_ID, expires_at: '2099-01-01T00:00:00Z' }, error: null };
      }
      if (opts.body.step === 'verify_password') {
        return { data: { passwordVerified: true }, error: null };
      }
      return { data: null, error: 'unexpected' };
    });

    const { result } = renderHook(() => useStepUpAuth());

    // Dispara requestChallenge
    await act(async () => {
      await result.current.requestChallenge({ action: 'promote_dev' });
    });

    // Chama verifyPassword IMEDIATAMENTE (sem esperar próximo render)
    await act(async () => {
      await result.current.verifyPassword('senha123');
    });

    // Pega o body da chamada verify_password
    const verifyCalls = mockInvoke.mock.calls.filter(
      ([, opts]) => opts.body.step === 'verify_password',
    );
    expect(verifyCalls).toHaveLength(1);

    const sentChallengeId = verifyCalls[0][1].body.challenge_id;

    // BUG seria: sentChallengeId === null
    // FIX garante: sentChallengeId === CHALLENGE_ID
    expect(sentChallengeId).toBe(CHALLENGE_ID);
    expect(sentChallengeId).not.toBeNull();
  });

  it('verifyOtp deve enviar challenge_id correto (não null)', async () => {
    mockInvoke.mockImplementation(async (_: string, opts: { body: Record<string, unknown> }) => {
      if (opts.body.step === 'request') {
        return { data: { challenge_id: CHALLENGE_ID, expires_at: '2099-01-01T00:00:00Z' }, error: null };
      }
      if (opts.body.step === 'verify_otp') {
        return { data: { token: 'tok-xyz', expires_at: '2099-01-01T00:00:00Z' }, error: null };
      }
      return { data: null, error: 'unexpected' };
    });

    const { result } = renderHook(() => useStepUpAuth());

    await act(async () => {
      await result.current.requestChallenge({ action: 'mcp_key_revoke' });
    });

    await act(async () => {
      await result.current.verifyOtp('123456');
    });

    const otpCalls = mockInvoke.mock.calls.filter(
      ([, opts]) => opts.body.step === 'verify_otp',
    );
    expect(otpCalls).toHaveLength(1);
    expect(otpCalls[0][1].body.challenge_id).toBe(CHALLENGE_ID);
    expect(otpCalls[0][1].body.challenge_id).not.toBeNull();
  });

  it('cancel deve enviar challenge_id correto (não null)', async () => {
    mockInvoke.mockImplementation(async (_: string, opts: { body: Record<string, unknown> }) => {
      if (opts.body.step === 'request') {
        return { data: { challenge_id: CHALLENGE_ID, expires_at: '2099-01-01T00:00:00Z' }, error: null };
      }
      if (opts.body.step === 'cancel') {
        return { data: {}, error: null };
      }
      return { data: null, error: 'unexpected' };
    });

    const { result } = renderHook(() => useStepUpAuth());

    await act(async () => {
      await result.current.requestChallenge({ action: 'secret_revoke' });
    });

    await act(async () => {
      await result.current.cancel('user_dismissed');
    });

    const cancelCalls = mockInvoke.mock.calls.filter(
      ([, opts]) => opts.body.step === 'cancel',
    );
    expect(cancelCalls).toHaveLength(1);
    expect(cancelCalls[0][1].body.challenge_id).toBe(CHALLENGE_ID);
    expect(cancelCalls[0][1].body.challenge_id).not.toBeNull();
  });

  it('state.challengeId deve ser populado após requestChallenge', async () => {
    mockInvoke.mockResolvedValue({
      data: { challenge_id: CHALLENGE_ID, expires_at: '2099-01-01T00:00:00Z' },
      error: null,
    });

    const { result } = renderHook(() => useStepUpAuth());

    expect(result.current.state.challengeId).toBeNull();

    await act(async () => {
      await result.current.requestChallenge({ action: 'demote_dev' });
    });

    expect(result.current.state.challengeId).toBe(CHALLENGE_ID);
  });

  it('reset deve limpar challengeId do state e do ref', async () => {
    mockInvoke.mockResolvedValue({
      data: { challenge_id: CHALLENGE_ID, expires_at: '2099-01-01T00:00:00Z' },
      error: null,
    });

    const { result } = renderHook(() => useStepUpAuth());

    await act(async () => {
      await result.current.requestChallenge({ action: 'promote_dev' });
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.state.challengeId).toBeNull();
    expect(result.current.state.loading).toBe(false);
    expect(result.current.state.error).toBeNull();
  });
});
