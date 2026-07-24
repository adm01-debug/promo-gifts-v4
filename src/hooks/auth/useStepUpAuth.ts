/**
 * useStepUpAuth — Client hook que orquestra o fluxo step-up (senha + OTP)
 * via edge function `step-up-verify`. Estado interno é consumido pelo
 * `StepUpAuthDialog`.
 *
 * Onda 19.1: chamadas migradas para `invokeEdge` (SSOT `invokeEdgeSafe`).
 */
import { useCallback, useRef, useState } from 'react';
import { invokeEdge } from '@/lib/edge/safeInvokeCall';
import { logger } from '@/lib/logger';

export type StepUpAction =
  | 'demote_dev'
  | 'mcp_full_escalate'
  | 'mcp_full_issue'
  | 'mcp_key_revoke'
  | 'mcp_key_rotate'
  | 'promote_dev'
  | 'secret_revoke'
  | 'secret_rotation';

interface ChallengeRequest {
  action: StepUpAction;
  actionLabel: string;
  targetRef?: string | null;
}

interface StepUpState {
  challengeId: string | null;
  passwordVerified: boolean;
  loading: boolean;
  error: string | null;
}

const INITIAL_STATE: StepUpState = {
  challengeId: null,
  passwordVerified: false,
  loading: false,
  error: null,
};

function readError(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const obj = data as { error?: unknown; message?: unknown };
    if (typeof obj.error === 'string') return obj.error;
    if (typeof obj.message === 'string') return obj.message;
  }
  return fallback;
}

export function useStepUpAuth() {
  const [state, setState] = useState<StepUpState>(INITIAL_STATE);
  const challengeIdRef = useRef<string | null>(null);

  const reset = useCallback(() => {
    challengeIdRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  const requestChallenge = useCallback(async (req: ChallengeRequest) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { data, error } = await invokeEdge<{ challenge_id?: string }>('step-up-verify', {
        op: 'step-up.request',
        body: {
          step: 'request',
          action: req.action,
          action_label: req.actionLabel,
          target_ref: req.targetRef ?? null,
        },
      });
      if (error || !data?.challenge_id) {
        setState({
          challengeId: null,
          passwordVerified: false,
          loading: false,
          error: readError(data ?? error, 'Não foi possível iniciar a verificação.'),
        });
        return;
      }
      challengeIdRef.current = data.challenge_id;
      setState({
        challengeId: data.challenge_id,
        passwordVerified: false,
        loading: false,
        error: null,
      });
    } catch {
      setState({
        challengeId: null,
        passwordVerified: false,
        loading: false,
        error: 'Falha de rede ao iniciar verificação.',
      });
    }
  }, []);

  const verifyPassword = useCallback(async (password: string) => {
    const challengeId = challengeIdRef.current;
    if (!challengeId) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { data, error } = await invokeEdge<{ password_verified?: boolean }>('step-up-verify', {
        op: 'step-up.verify_password',
        body: { step: 'verify_password', challenge_id: challengeId, password },
      });
      if (error || !data?.password_verified) {
        setState((s) => ({
          ...s,
          loading: false,
          error: readError(data ?? error, 'Senha incorreta.'),
        }));
        return;
      }
      setState((s) => ({ ...s, passwordVerified: true, loading: false, error: null }));
    } catch {
      setState((s) => ({ ...s, loading: false, error: 'Falha de rede ao validar senha.' }));
    }
  }, []);

  const verifyOtp = useCallback(async (otp: string): Promise<string | null> => {
    const challengeId = challengeIdRef.current;
    if (!challengeId) return null;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { data, error } = await invokeEdge<{ token?: string }>('step-up-verify', {
        op: 'step-up.verify_otp',
        body: { step: 'verify_otp', challenge_id: challengeId, otp },
      });
      if (error || !data?.token) {
        setState((s) => ({
          ...s,
          loading: false,
          error: readError(data ?? error, 'Código inválido ou expirado.'),
        }));
        return null;
      }
      setState((s) => ({ ...s, loading: false, error: null }));
      return data.token;
    } catch {
      setState((s) => ({ ...s, loading: false, error: 'Falha de rede ao validar código.' }));
      return null;
    }
  }, []);

  const cancel = useCallback(async (reason?: string) => {
    const challengeId = challengeIdRef.current;
    if (!challengeId) return;
    try {
      const { error: cancelErr } = await invokeEdge('step-up-verify', {
        op: 'step-up.cancel',
        body: { step: 'cancel', challenge_id: challengeId, cancel_reason: reason ?? null },
      });
      if (cancelErr) logger.warn('[step-up] cancel RPC failed:', cancelErr);
    } catch {
      /* best-effort */
    }
  }, []);

  return { state, reset, requestChallenge, verifyPassword, verifyOtp, cancel };
}
