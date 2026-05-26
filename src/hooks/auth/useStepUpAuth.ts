import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeError, SAFE_MESSAGES } from '@/lib/security/sanitize-error';

export type StepUpAction =
  | 'promote_dev'
  | 'demote_dev'
  | 'mcp_full_issue'
  | 'mcp_full_escalate'
  | 'mcp_key_revoke'
  | 'mcp_key_rotate'
  | 'secret_rotation'
  | 'secret_revoke';

interface StartParams {
  action: StepUpAction;
  targetRef?: string | null;
  /** Texto humano da ação. Propagado para audit log e UI server-side. */
  actionLabel?: string;
}

interface StepUpState {
  challengeId: string | null;
  passwordVerified: boolean;
  token: string | null;
  expiresAt: string | null;
  loading: boolean;
  error: string | null;
}

const initial: StepUpState = {
  challengeId: null,
  passwordVerified: false,
  token: null,
  expiresAt: null,
  loading: false,
  error: null,
};

export function useStepUpAuth() {
  const [state, setState] = useState<StepUpState>(initial);

  const ctxRef = useRef<{
    action: StepUpAction | null;
    targetRef: string | null;
    actionLabel: string | null;
  }>({
    action: null,
    targetRef: null,
    actionLabel: null,
  });

  /**
   * BUG-01 FIX: useRef para challengeId evita stale closure.
   *
   * PROBLEMA ORIGINAL: verifyPassword, verifyOtp e cancel capturavam
   * state.challengeId via closure. Como requestChallenge atualiza o estado
   * via setState (assíncrono), essas closures ainda tinham challengeId = null
   * quando chamadas logo após requestChallenge — enviando challenge_id: null
   * para a Edge Function e fazendo o MFA falhar silenciosamente.
   *
   * SOLUÇÃO: challengeIdRef é atualizado sincronamente em requestChallenge,
   * antes do re-render. Os callbacks leem .current diretamente.
   */
  const challengeIdRef = useRef<string | null>(null);

  const reset = useCallback(() => {
    setState(initial);
    ctxRef.current = { action: null, targetRef: null, actionLabel: null };
    challengeIdRef.current = null;
  }, []);

  const requestChallenge = useCallback(async ({ action, targetRef, actionLabel }: StartParams) => {
    ctxRef.current = {
      action,
      targetRef: targetRef ?? null,
      actionLabel: actionLabel ?? null,
    };
    setState((s) => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.functions.invoke('step-up-verify', {
      body: {
        step: 'request',
        action,
        target_ref: targetRef ?? null,
        action_label: actionLabel ?? null,
      },
    });
    if (error || data?.error) {
      setState((s) => ({ ...s, loading: false, error: sanitizeError(data ?? error) }));
      return false;
    }
    // FIX: atualiza ref ANTES do setState para que verifyPassword/Otp já
    // tenham o valor correto caso chamados antes do próximo render.
    challengeIdRef.current = data.challenge_id;
    setState((s) => ({
      ...s,
      loading: false,
      challengeId: data.challenge_id,
      expiresAt: data.expires_at,
    }));
    return true;
  }, []);

  const verifyPassword = useCallback(
    async (password: string) => {
      setState((s) => ({ ...s, loading: true, error: null }));
      const { action, targetRef, actionLabel } = ctxRef.current;
      // FIX: usa challengeIdRef.current em vez de state.challengeId (stale closure)
      const { data, error } = await supabase.functions.invoke('step-up-verify', {
        body: {
          step: 'verify_password',
          challenge_id: challengeIdRef.current,
          password,
          action,
          target_ref: targetRef,
          action_label: actionLabel,
        },
      });
      if (error || data?.error) {
        // Mensagem genérica — não diferencia "senha errada" de outros erros (anti-enumeration)
        setState((s) => ({ ...s, loading: false, error: SAFE_MESSAGES.AUTH_GENERIC }));
        return false;
      }
      setState((s) => ({ ...s, loading: false, passwordVerified: true }));
      return true;
    },
    [],
  );

  const verifyOtp = useCallback(
    async (otp: string) => {
      setState((s) => ({ ...s, loading: true, error: null }));
      const { action, targetRef, actionLabel } = ctxRef.current;
      // FIX: usa challengeIdRef.current em vez de state.challengeId (stale closure)
      const { data, error } = await supabase.functions.invoke('step-up-verify', {
        body: {
          step: 'verify_otp',
          challenge_id: challengeIdRef.current,
          otp,
          action,
          target_ref: targetRef,
          action_label: actionLabel,
        },
      });
      if (error || data?.error) {
        setState((s) => ({ ...s, loading: false, error: SAFE_MESSAGES.STEP_UP_FAILED }));
        return null;
      }
      setState((s) => ({ ...s, loading: false, token: data.token, expiresAt: data.expires_at }));
      return data.token as string;
    },
    [],
  );

  /**
   * Registra cancelamento server-side. Best-effort: nunca propaga erro.
   */
  const cancel = useCallback(
    async (reason: string = 'user_dismissed') => {
      const { action, targetRef, actionLabel } = ctxRef.current;
      // FIX: usa challengeIdRef.current em vez de state.challengeId (stale closure)
      if (!action && !challengeIdRef.current) return;
      try {
        await supabase.functions.invoke('step-up-verify', {
          body: {
            step: 'cancel',
            challenge_id: challengeIdRef.current,
            action,
            target_ref: targetRef,
            action_label: actionLabel,
            cancel_reason: reason,
          },
        });
      } catch {
        // Audit best-effort
      }
    },
    [],
  );

  return { state, reset, requestChallenge, verifyPassword, verifyOtp, cancel };
}
