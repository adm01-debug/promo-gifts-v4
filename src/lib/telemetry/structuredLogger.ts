/**
 * Structured Logger SSOT — Client
 * ----------------------------------------------------------------
 * Logger estruturado JSON com correlação (request_id) que:
 *  - imprime no console em DEV de forma legível;
 *  - emite JSON em PROD (interceptável por collectors);
 *  - integra com Sentry: WARN vira `captureMessage`, ERROR vira `captureException`;
 *  - propaga `request_id` como tag no Sentry.
 *
 * Uso típico em rotas críticas (auth, checkout, orçamentos, MCP):
 *   const log = createClientLogger('auth.signIn');
 *   log.info('signin_start', { method: 'password' });
 *   try { ... } catch (err) { log.error('signin_failed', { err }); }
 */

import { captureException } from '@/lib/sentry';
import { newRequestId, REQUEST_ID_HEADER } from '@/lib/telemetry/requestId';

export type LogLevel = 'debug' | 'error' | 'info' | 'warn';

export interface ClientLogger {
  scope: string;
  requestId: string;
  debug: (event: string, fields?: Record<string, unknown>) => void;
  info: (event: string, fields?: Record<string, unknown>) => void;
  warn: (event: string, fields?: Record<string, unknown>) => void;
  error: (event: string, fields?: Record<string, unknown>) => void;
  child: (subScope: string, extra?: Record<string, unknown>) => ClientLogger;
  /** Header pronto para incluir em fetch/invoke e correlacionar com edge logs. */
  headers: () => Record<string, string>;
}

interface LoggerOptions {
  requestId?: string;
  base?: Record<string, unknown>;
}

function serializeErr(value: unknown): Record<string, unknown> {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (value && typeof value === 'object') return value as Record<string, unknown>;
  return { value: String(value) };
}

function emit(
  level: LogLevel,
  scope: string,
  requestId: string,
  event: string,
  base: Record<string, unknown>,
  fields: Record<string, unknown> | undefined,
): void {
  const payload: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    scope,
    request_id: requestId,
    event,
    ...base,
  };
  if (fields) {
    for (const [k, v] of Object.entries(fields)) {
      payload[k] = k === 'err' || k === 'error' ? serializeErr(v) : v;
    }
  }

  const isDev = import.meta.env.DEV;
  const tag = `[${scope}:${event}]`;

  // DEV: console nativo por nível — info/debug não poluem o painel de warnings.
  // PROD: apenas warn/error — o build de produção stripa console.log/info/debug
  // (vite.config esbuild.pure), então info/debug em PROD precisam sair via warn
  // ou o JSON nunca chega aos collectors.
  /* eslint-disable no-console */
  if (isDev) {
    if (level === 'error') console.error(tag, payload);
    else if (level === 'warn') console.warn(tag, payload);
    else if (level === 'info') console.info(tag, payload);
    else console.debug(tag, payload);
  } else {
    const json = JSON.stringify(payload);
    if (level === 'error') console.error(json);
    else if (level === 'warn') console.warn(json);
    else if (level === 'info') console.log(json);
    else console.debug(json);
  }
  /* eslint-enable no-console */

  // Sentry forwarding
  if (level === 'error') {
    const err = (fields?.err ?? fields?.error) as unknown;
    const errorObj = err instanceof Error ? err : new Error(`${scope}.${event}`);
    captureException(errorObj, { tags: { scope, event, request_id: requestId }, extra: payload });
  }
}

export function createClientLogger(scope: string, opts: LoggerOptions = {}): ClientLogger {
  const requestId = opts.requestId ?? newRequestId();
  const base = opts.base ?? {};

  const build = (s: string, b: Record<string, unknown>): ClientLogger => ({
    scope: s,
    requestId,
    debug: (event, fields) => emit('debug', s, requestId, event, b, fields),
    info: (event, fields) => emit('info', s, requestId, event, b, fields),
    warn: (event, fields) => emit('warn', s, requestId, event, b, fields),
    error: (event, fields) => emit('error', s, requestId, event, b, fields),
    child: (sub, extra) => build(`${s}.${sub}`, { ...b, ...(extra ?? {}) }),
    headers: () => ({ [REQUEST_ID_HEADER]: requestId }),
  });

  return build(scope, base);
}
