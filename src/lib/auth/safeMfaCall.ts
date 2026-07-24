/**
 * safeMfaCall — Onda 9: variante de safeAuthCall para MFA (TOTP enroll/challenge/verify/unenroll).
 *
 * Estende AuthErrorKind com códigos específicos:
 *  - `invalid_code`        → OTP incorreto (não retenta)
 *  - `expired_challenge`   → challenge_id expirado (não retenta)
 *  - `factor_locked`       → fator bloqueado por tentativas
 *
 * Reutiliza o motor de retry/timeout/log de safeAuthCall via composição.
 */
import { safeAuthCall, type SafeAuthResult, type AuthErrorKind } from './safeAuthCall';

export type MfaErrorKind = AuthErrorKind | 'invalid_code' | 'expired_challenge' | 'factor_locked';

export interface SafeMfaOptions {
  op: 'mfaEnroll' | 'mfaChallenge' | 'mfaVerify' | 'mfaUnenroll' | 'mfaListFactors' | 'mfaGetAAL';
  timeoutMs?: number;
  maxRetries?: number;
  signal?: AbortSignal;
  isDev?: boolean;
}

export type SafeMfaResult<T> =
  | { kind: 'ok'; data: T; attempts: number; elapsedMs: number }
  | {
      kind: 'err';
      errorKind: MfaErrorKind;
      userMessage: string;
      raw: unknown;
      attempts: number;
      elapsedMs: number;
    };

function refineMfaError(msg: string, status: number | undefined, base: AuthErrorKind): MfaErrorKind {
  const m = (msg ?? '').toLowerCase();
  if (m.includes('invalid') && (m.includes('code') || m.includes('otp') || m.includes('token'))) {
    return 'invalid_code';
  }
  if (m.includes('expired') || m.includes('challenge_expired')) return 'expired_challenge';
  if (m.includes('locked') || m.includes('too many attempts')) return 'factor_locked';
  if (status === 422) return 'invalid_code';
  return base;
}

export async function safeMfaCall<T>(
  call: () => Promise<{ data?: T; error?: { message?: string; status?: number; name?: string } | null }>,
  options: SafeMfaOptions,
): Promise<SafeMfaResult<T>> {
  const inner: SafeAuthResult<T> = await safeAuthCall(call, {
    op: options.op,
    timeoutMs: options.timeoutMs ?? 6_000,
    maxRetries: options.maxRetries ?? 2,
    signal: options.signal,
    isDev: options.isDev,
  });

  if (inner.kind === 'ok') return inner;

  const rawErr = inner.raw as { message?: string; status?: number } | null;
  const refined = refineMfaError(rawErr?.message ?? '', rawErr?.status, inner.errorKind);

  return {
    kind: 'err',
    errorKind: refined,
    userMessage: inner.userMessage,
    raw: inner.raw,
    attempts: inner.attempts,
    elapsedMs: inner.elapsedMs,
  };
}
