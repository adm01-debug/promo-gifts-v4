/**
 * safeInvokeCall — Onda 17: SSOT para `supabase.functions.invoke`.
 *
 * Aplica o mesmo contrato "nunca-throw / nunca-vaza-técnica" já provado em
 * `safeAuthCall` (Ondas 7-16) a toda a superfície de chamadas de Edge Functions.
 *
 * - Timeout por tentativa (default 10s, edges são mais lentas que auth-server).
 * - Retry exponencial só em falhas transitórias (network/server/timeout).
 * - Circuit breaker por `fnName` (isolado entre edges — 5 falhas / 30s → cooldown 60s).
 * - Classificação de erro (`EdgeErrorKind`) cobrindo as 3 classes do supabase-js
 *   (`FunctionsHttpError`, `FunctionsRelayError`, `FunctionsFetchError`) + status HTTP.
 * - Parser defensivo do body (JSON quebrado / HTML de proxy não explode).
 * - `userMessage` sanitizada (sem status bruto / stack em produção).
 *
 * Uso:
 *   const r = await invokeEdgeSafe('log-login-attempt', { email }, { op: 'log-login' });
 *   if (r.kind === 'ok') { ... r.data ... } else { toast.error(r.userMessage); }
 */
import { safeAuthCall, type SafeAuthResult } from '@/lib/auth/safeAuthCall';
import { getSupabaseClient } from '@/integrations/supabase/lazy-client';

export type EdgeErrorKind =
  | 'client' // 4xx exceto 401/403/429
  | 'credential' // 401/403
  | 'ratelimit' // 429
  | 'network'
  | 'server'
  | 'timeout'
  | 'unknown';

export type SafeInvokeResult<T> = SafeAuthResult<T>;

export interface InvokeOptions {
  /** Nome curto p/ log e breaker. Default: `edge.<fnName>`. */
  op?: string;
  /** Body serializável (JSON). */
  body?: unknown;
  /** Headers extras. */
  headers?: Record<string, string>;
  /** Timeout por tentativa em ms. Default 10s. */
  timeoutMs?: number;
  /** Máx tentativas totais. Default 2 (edges já são caras). */
  maxRetries?: number;
  /** AbortSignal externo. */
  signal?: AbortSignal;
  /** Sobrescreve `isDev` do sanitizador. */
  isDev?: boolean;
}

interface NormalizedError {
  message: string;
  status: number;
  name?: string;
}

/**
 * Normaliza qualquer erro do supabase.functions.invoke em `{message,status,name}`.
 * Cobre as 3 classes do supabase-js e casos onde `context.status` é ausente.
 */
export async function normalizeInvokeError(err: unknown): Promise<NormalizedError> {
  if (!err || typeof err !== 'object') {
    return { message: String(err ?? 'unknown'), status: 0 };
  }
  const e = err as {
    name?: string;
    message?: string;
    context?: { status?: number; statusText?: string; body?: unknown };
  };
  const name = e.name ?? '';
  const baseMsg = e.message ?? '';
  const ctx = e.context;
  let status = ctx?.status ?? 0;
  let bodyMsg = '';

  // FunctionsHttpError: tenta extrair `error` do body (JSON) sem explodir.
  if (ctx?.body) {
    try {
      // context.body pode ser Response ou string/objeto já lido.
      if (typeof ctx.body === 'string') {
        try {
          const parsed = JSON.parse(ctx.body) as { error?: string; message?: string };
          bodyMsg = parsed.error ?? parsed.message ?? '';
        } catch {
          bodyMsg = ctx.body.slice(0, 200);
        }
      } else if (typeof ctx.body === 'object') {
        const b = ctx.body as { error?: string; message?: string };
        bodyMsg = b.error ?? b.message ?? '';
      }
    } catch {
      // parser defensivo: nunca propagar
      bodyMsg = '';
    }
  }

  // FunctionsRelayError / FunctionsFetchError → sem status HTTP real, mapear p/ network.
  if (
    status === 0 &&
    (name === 'FunctionsRelayError' ||
      name === 'FunctionsFetchError' ||
      name === 'TypeError' ||
      baseMsg.toLowerCase().includes('failed to fetch'))
  ) {
    status = 0; // classifyThrown resolverá como 'network'
  }

  return {
    message: bodyMsg || baseMsg || 'edge error',
    status,
    name,
  };
}

/**
 * Wrapper único para `supabase.functions.invoke`.
 * Delega ao motor `safeAuthCall` (breaker/timeout/retry) após normalizar erros.
 */
export async function invokeEdgeSafe<T = unknown>(
  fnName: string,
  options: InvokeOptions = {},
): Promise<SafeInvokeResult<T>> {
  const {
    op = `edge.${fnName}`,
    body,
    headers,
    timeoutMs = 10_000,
    maxRetries = 2,
    signal,
    isDev,
  } = options;

  const call = async (): Promise<{ data: T | null; error: NormalizedError | null }> => {
    const supa = await getSupabaseClient();
    const { data, error } = await supa.functions.invoke<T>(fnName, {
      body,
      headers,
    });
    if (error) {
      return { data: null, error: await normalizeInvokeError(error) };
    }
    return { data: (data ?? null) as T | null, error: null };
  };

  return safeAuthCall<T>(call as never, {
    op,
    timeoutMs,
    maxRetries,
    signal,
    isDev,
  }) as Promise<SafeInvokeResult<T>>;
}
