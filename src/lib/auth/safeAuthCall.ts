/**
 * safeAuthCall — SSOT para chamadas Supabase Auth resilientes.
 *
 * Estende para o client o mesmo padrão "nunca-explodir" da edge
 * `log-login-attempt`: toda chamada auth passa por timeout, retry
 * exponencial (para falhas transitórias) e classificação de erro,
 * devolvendo uma mensagem sanitizada pronta para UI + o resultado
 * original do Supabase para o caller decidir o fluxo.
 *
 * Uso:
 *   const r = await safeAuthCall(
 *     () => supabase.auth.signInWithPassword({ email, password }),
 *     { op: 'signIn' },
 *   );
 *   if (r.kind === 'ok') { ... r.data ... }
 *   else { toast.error(r.userMessage); }
 *
 * Regras:
 *  - `credential` (401/invalid_credentials) NUNCA retenta — auth-server já
 *    decidiu, retry só aumentaria a chance de rate-limit lockout.
 *  - `ratelimit` (429) NUNCA retenta — respeita Retry-After.
 *  - `network`/`server`/`timeout` retenta até `maxRetries` (default 2) com
 *    backoff exponencial + jitter (200ms, 500ms).
 *  - Timeout default 8s por tentativa. Cancelável via AbortSignal externo.
 *  - Mensagem sanitizada via `sanitizeMessage` (respeita dev/não-dev).
 *  - Structured log de cada tentativa via `createClientLogger`.
 */
import { createClientLogger } from '@/lib/telemetry/structuredLogger';
import { sanitizeMessage } from '@/lib/security/sanitize-message';

export type AuthErrorKind =
  | 'credential'
  | 'ratelimit'
  | 'network'
  | 'server'
  | 'timeout'
  | 'unknown';

export interface SafeAuthOk<T> {
  kind: 'ok';
  data: T;
  attempts: number;
  elapsedMs: number;
}

export interface SafeAuthErr {
  kind: 'err';
  errorKind: AuthErrorKind;
  /** Mensagem pública, já sanitizada, segura para UI. */
  userMessage: string;
  /** Erro cru para telemetria — NUNCA renderize direto. */
  raw: unknown;
  attempts: number;
  elapsedMs: number;
}

export type SafeAuthResult<T> = SafeAuthOk<T> | SafeAuthErr;

export interface SafeAuthOptions {
  /** Nome curto da operação (ex.: 'signIn'). Vai no log e no scope. */
  op: string;
  /** Timeout por tentativa em ms. Default 8000. */
  timeoutMs?: number;
  /** Máximo de tentativas totais (inclui a primeira). Default 3 (1 + 2 retries). */
  maxRetries?: number;
  /** AbortSignal externo para cancelamento (ex.: unmount). */
  signal?: AbortSignal;
  /** Sobrescreve o `isDev` usado pelo sanitizador (default: import.meta.env.DEV). */
  isDev?: boolean;
}

interface SupabaseLikeResult<T> {
  data?: T;
  error?: { message?: string; status?: number; name?: string } | null;
}

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const BACKOFF_MS = [0, 200, 500] as const;

// ==== Onda 11 — Circuit breaker in-memory por op ====
interface BreakerState {
  failures: number;
  openedAt: number | null;
}
const BREAKER_THRESHOLD = 5;
const BREAKER_COOLDOWN_MS = 60_000;
const breakers: Map<string, BreakerState> = new Map();

function getBreaker(op: string): BreakerState {
  let s = breakers.get(op);
  if (!s) {
    s = { failures: 0, openedAt: null };
    breakers.set(op, s);
  }
  return s;
}

export function breakerIsOpen(op: string): boolean {
  const s = getBreaker(op);
  if (s.openedAt === null) return false;
  if (Date.now() - s.openedAt > BREAKER_COOLDOWN_MS) {
    s.failures = 0;
    s.openedAt = null;
    return false;
  }
  return true;
}

function breakerRecordFailure(op: string, kind: AuthErrorKind): void {
  if (kind !== 'network' && kind !== 'server' && kind !== 'timeout') return;
  const s = getBreaker(op);
  s.failures += 1;
  if (s.failures >= BREAKER_THRESHOLD && s.openedAt === null) {
    s.openedAt = Date.now();
  }
}

function breakerRecordSuccess(op: string): void {
  const s = getBreaker(op);
  s.failures = 0;
  s.openedAt = null;
}

/** Somente para testes. */
export function __resetBreakers(): void {
  breakers.clear();
}

function jitter(base: number): number {
  if (base === 0) return 0;
  // ±25% jitter
  return Math.round(base * (0.75 + Math.random() * 0.5));
}

function classifySupabaseError(err: {
  message?: string;
  status?: number;
  name?: string;
}): AuthErrorKind {
  const status = err.status ?? 0;
  const msg = (err.message ?? '').toLowerCase();
  if (status === 401 || status === 400) {
    if (
      msg.includes('invalid login') ||
      msg.includes('invalid credentials') ||
      msg.includes('invalid_credentials') ||
      msg.includes('email not confirmed') ||
      msg.includes('user not found')
    ) {
      return 'credential';
    }
    return 'credential';
  }
  if (status === 403) return 'credential';
  if (status === 429 || msg.includes('rate limit') || msg.includes('too many')) {
    return 'ratelimit';
  }
  if (status >= 500 && status < 600) return 'server';
  if (
    err.name === 'AbortError' ||
    msg.includes('timeout') ||
    msg.includes('aborted')
  ) {
    return 'timeout';
  }
  if (
    err.name === 'TypeError' ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed')
  ) {
    return 'network';
  }
  return 'unknown';
}

function classifyThrown(err: unknown): AuthErrorKind {
  if (!err || typeof err !== 'object') return 'unknown';
  const e = err as { name?: string; message?: string };
  const msg = (e.message ?? '').toLowerCase();
  if (e.name === 'AbortError' || msg.includes('timeout')) return 'timeout';
  if (
    e.name === 'TypeError' ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror')
  ) {
    return 'network';
  }
  return 'unknown';
}

function isRetryable(kind: AuthErrorKind): boolean {
  return kind === 'network' || kind === 'server' || kind === 'timeout';
}

/** Timeout wrapper que aborta a call via AbortController próprio + externo. */
async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  external?: AbortSignal,
): Promise<T> {
  const ctrl = new AbortController();
  const onExternalAbort = (): void => ctrl.abort();
  if (external) {
    if (external.aborted) ctrl.abort();
    else external.addEventListener('abort', onExternalAbort, { once: true });
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const abortPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      ctrl.abort();
      reject(Object.assign(new Error('timeout'), { name: 'AbortError' }));
    }, timeoutMs);
    if (ctrl.signal.aborted) {
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    } else {
      ctrl.signal.addEventListener(
        'abort',
        () =>
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
        { once: true },
      );
    }
  });
  try {
    return await Promise.race([fn(ctrl.signal), abortPromise]);
  } finally {
    if (timer) clearTimeout(timer);
    if (external) external.removeEventListener('abort', onExternalAbort);
  }
}

export async function safeAuthCall<T>(
  call: () => Promise<SupabaseLikeResult<T>>,
  options: SafeAuthOptions,
): Promise<SafeAuthResult<T>> {
  const {
    op,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_ATTEMPTS,
    signal,
    isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV === true,
  } = options;

  const log = createClientLogger(`auth.${op}`);
  const started = Date.now();
  let lastKind: AuthErrorKind = 'unknown';
  let lastRaw: unknown = null;
  let lastMsg = '';

  // Circuit breaker aberto — short-circuit para não sobrecarregar auth-server.
  if (breakerIsOpen(op)) {
    log.warn(`${op}_breaker_open`, { op });
    return {
      kind: 'err',
      errorKind: 'server',
      userMessage: sanitizeMessage('server temporarily unavailable', { isDev }),
      raw: { breaker: 'open' },
      attempts: 0,
      elapsedMs: 0,
    };
  }


  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      lastKind = 'timeout';
      lastMsg = 'aborted';
      break;
    }
    try {
      const result = await withTimeout(
        async () => call(),
        timeoutMs,
        signal,
      );
      if (result.error) {
        lastKind = classifySupabaseError(result.error);
        lastRaw = result.error;
        lastMsg = result.error.message ?? '';
        log.warn(`${op}_failed`, {
          attempt,
          error_kind: lastKind,
          status: result.error.status ?? null,
        });
        if (!isRetryable(lastKind) || attempt === maxRetries) {
          if (isRetryable(lastKind) && attempt === maxRetries) {
            log.error(`${op}_exhausted`, {
              attempts: attempt,
              error_kind: lastKind,
            });
          }
          breakerRecordFailure(op, lastKind);
          return {
            kind: 'err',
            errorKind: lastKind,
            userMessage: sanitizeMessage(lastMsg, { isDev }),
            raw: lastRaw,
            attempts: attempt,
            elapsedMs: Date.now() - started,
          };
        }
        breakerRecordFailure(op, lastKind);
      } else {
        breakerRecordSuccess(op);
        log.info(`${op}_ok`, { attempt });
        return {
          kind: 'ok',
          data: result.data as T,
          attempts: attempt,
          elapsedMs: Date.now() - started,
        };
      }
    } catch (thrown) {
      lastKind = classifyThrown(thrown);
      lastRaw = thrown;
      lastMsg = thrown instanceof Error ? thrown.message : String(thrown);
      log.warn(`${op}_thrown`, { attempt, error_kind: lastKind });
      if (!isRetryable(lastKind) || attempt === maxRetries) break;
    }
    // Backoff antes da próxima tentativa
    const wait = jitter(BACKOFF_MS[attempt] ?? 500);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }

  breakerRecordFailure(op, lastKind);
  log.error(`${op}_exhausted`, { attempts: maxRetries, error_kind: lastKind });
  return {
    kind: 'err',
    errorKind: lastKind,
    userMessage: sanitizeMessage(lastMsg, { isDev }),
    raw: lastRaw,
    attempts: maxRetries,
    elapsedMs: Date.now() - started,
  };
}
