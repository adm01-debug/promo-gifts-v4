/**
 * safeInvokeCall — Onda 17: SSOT para `supabase.functions.invoke`.
 * Onda 20: telemetria estruturada + propagação de X-Request-Id.
 *
 * - Timeout, retry, circuit breaker delegados a `safeAuthCall`.
 * - Logger dedicado `edge.invoke` emite `edge_invoke_{start,ok,failed,breaker_open}`
 *   com fnName, request_id, latência e status. Nunca vaza PII (só metadata).
 * - `X-Request-Id` outbound: gerado por chamada (UUID v4) quando o caller não
 *   fornecer; devolvido no resultado para correlação Sentry/edge-logs.
 * - Parser defensivo do body (JSON quebrado / HTML de proxy não explode).
 *
 * Uso:
 *   const r = await invokeEdgeSafe('log-login-attempt', { body: { email } });
 *   if (r.kind === 'ok') { ... r.data ... } else { toast.error(r.userMessage); }
 *   console.log('correlation:', r.requestId);
 */
import { safeAuthCall, type SafeAuthResult } from '@/lib/auth/safeAuthCall';
import { getSupabaseClient } from '@/integrations/supabase/lazy-client';
import { createClientLogger } from '@/lib/telemetry/structuredLogger';
import { newRequestId, REQUEST_ID_HEADER } from '@/lib/telemetry/requestId';
import { recordInvokeEvent } from '@/lib/edge/invokeTelemetrySink';

export type EdgeErrorKind =
  | 'client'
  | 'credential'
  | 'network'
  | 'ratelimit'
  | 'server'
  | 'timeout'
  | 'unknown';

/** Resultado estendido: mantém shape do safeAuthCall + requestId de correlação. */
export type SafeInvokeResult<T> = SafeAuthResult<T> & { requestId: string };

export interface InvokeOptions {
  op?: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxRetries?: number;
  signal?: AbortSignal;
  isDev?: boolean;
  /** Reaproveita um request_id existente (ex.: continuação de fluxo). */
  requestId?: string;
}

interface NormalizedError {
  message: string;
  status: number;
  name?: string;
}

/**
 * Normaliza qualquer erro do supabase.functions.invoke em `{message,status,name}`.
 */
export function normalizeInvokeError(err: unknown): NormalizedError {
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
  const status = ctx?.status ?? 0;
  let bodyMsg = '';

  if (ctx?.body) {
    try {
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
      bodyMsg = '';
    }
  }

  let outName = name;
  if (
    status === 0 &&
    (name === 'FunctionsRelayError' ||
      name === 'FunctionsFetchError' ||
      name === 'TypeError' ||
      baseMsg.toLowerCase().includes('failed to fetch') ||
      baseMsg.toLowerCase().includes('relay') ||
      baseMsg.toLowerCase().includes('fetch'))
  ) {
    outName = 'TypeError';
  }

  return { message: bodyMsg || baseMsg || 'edge error', status, name: outName };
}

/** Logger SSOT do wrapper. Único ponto de emissão da superfície invoke. */
const edgeLog = createClientLogger('edge.invoke');

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
    requestId: providedRequestId,
  } = options;

  // Request-id por chamada — reaproveita se o caller já fornecer (via option
  // ou via header explícito), senão gera. NUNCA sobrescreve intencionalmente.
  const callerHeaderId =
    headers?.[REQUEST_ID_HEADER] ?? headers?.[REQUEST_ID_HEADER.toLowerCase()] ?? undefined;
  const requestId = providedRequestId ?? callerHeaderId ?? newRequestId();
  const outboundHeaders = { ...(headers ?? {}), [REQUEST_ID_HEADER]: requestId };
  const startedAt = Date.now();

  edgeLog.info('edge_invoke_start', {
    fn: fnName,
    op,
    request_id: requestId,
    has_body: body !== undefined && body !== null,
    max_retries: maxRetries,
  });
  recordInvokeEvent({ ts: startedAt, kind: 'start', fn: fnName, requestId });

  const call = async (): Promise<{ data: T | null; error: NormalizedError | null }> => {
    const supa = await getSupabaseClient();
    // `body` é `unknown` na nossa API pública; o cliente aceita apenas tipos
    // serializáveis. Cast defensivo mantém o contrato do wrapper.
    const { data, error } = await supa.functions.invoke<T>(fnName, {
      body: body as Record<string, unknown> | undefined,
      headers: outboundHeaders,
    });
    if (error) {
      return { data: null, error: await normalizeInvokeError(error) };
    }
    return { data: (data ?? null) as T | null, error: null };
  };

  const inner = (await safeAuthCall<T>(call as never, {
    op,
    timeoutMs,
    maxRetries,
    signal,
    isDev,
  })) as SafeAuthResult<T>;

  const latencyMs = Date.now() - startedAt;

  if (inner.kind === 'ok') {
    edgeLog.info('edge_invoke_ok', {
      fn: fnName,
      request_id: requestId,
      latency_ms: latencyMs,
      attempts: inner.attempts,
    });
    recordInvokeEvent({
      ts: Date.now(),
      kind: 'ok',
      fn: fnName,
      requestId,
      latencyMs,
      attempts: inner.attempts,
    });
  } else {
    // Detecta breaker aberto (safeAuthCall devolve attempts=0 e raw.breaker='open').
    const raw = inner.raw as { breaker?: string } | null;
    if (raw?.breaker === 'open') {
      edgeLog.warn('edge_invoke_breaker_open', {
        fn: fnName,
        request_id: requestId,
        latency_ms: latencyMs,
      });
      recordInvokeEvent({
        ts: Date.now(),
        kind: 'breaker_open',
        fn: fnName,
        requestId,
        latencyMs,
      });
    } else {
      // WARN em vez de ERROR: safeAuthCall já emite ERROR estruturado internamente
      // em `<op>_exhausted`. Aqui só espelhamos como sinal do wrapper, sem duplicar
      // ruído no Sentry (memory: Structured Logging & Correlation).
      edgeLog.warn('edge_invoke_failed', {
        fn: fnName,
        request_id: requestId,
        latency_ms: latencyMs,
        error_kind: inner.errorKind,
        attempts: inner.attempts,
      });
      recordInvokeEvent({
        ts: Date.now(),
        kind: 'failed',
        fn: fnName,
        requestId,
        latencyMs,
        errorKind: inner.errorKind,
        attempts: inner.attempts,
      });
    }
  }

  return { ...inner, requestId } as SafeInvokeResult<T>;
}

export interface InvokeCompatError {
  message: string;
  name: string;
  status: number;
  request_id: string;
}

export async function invokeEdge<T = unknown>(
  fnName: string,
  options: InvokeOptions = {},
): Promise<{ data: T | null; error: InvokeCompatError | null; requestId: string }> {
  const r = await invokeEdgeSafe<T>(fnName, options);
  if (r.kind === 'ok') {
    return { data: (r.data ?? null) as T | null, error: null, requestId: r.requestId };
  }
  return {
    data: null,
    error: {
      message: r.userMessage,
      name: r.errorKind,
      status: 0,
      request_id: r.requestId,
    },
    requestId: r.requestId,
  };
}
