/**
 * intelligenceAnalytics — telemetria específica das ações de recuperação
 * em /inteligencia-comercial que representam conversão do diagnóstico
 * em ação concreta (ex.: aplicar substituto ranqueado).
 *
 * Segue o mesmo padrão de `zeroResultAnalytics.ts` (logger estruturado +
 * window event + buffer E2E), mas com nome de evento próprio para
 * facilitar métricas de conversão em dashboards.
 */
import { createClientLogger } from '@/lib/telemetry/structuredLogger';
import { supabase } from '@/integrations/supabase/client';
import type { FilterKey } from '@/hooks/intelligence/useZeroResultDiagnosis';

const log = createClientLogger('bi.intelligence');

/** Nome da edge function que espelha o evento em `ai_usage_events`. */
const MIRROR_FN = 'intelligence-substitute-applied';

/** Eixo do substituto aplicado — espelha `FilterKey` do diagnóstico. */
export type SubstituteAxis = FilterKey;

export interface SubstituteAppliedPayload {
  /** Eixo do substituto (categoria, fornecedor ou produto). */
  axis: SubstituteAxis;
  /** ID canônico do substituto no Gold (categoria/fornecedor/produto). */
  substituteId: string;
  /** Nome legível (analytics-friendly; não usar para joins). */
  substituteName?: string | null;
  /** Janela em dias no momento do clique. */
  days: number;
  /** Culpado do diagnóstico antes da aplicação, quando disponível. */
  culpritBefore?: FilterKey | 'window' | 'intersection' | null;
}

export interface IntelligenceAnalyticsEvent {
  name: 'intelligence.substitute_applied';
  ts: string;
  payload: SubstituteAppliedPayload;
}

const E2E_BUFFER_KEY = '__e2eAnalytics__';
const E2E_BUFFER_LIMIT = 200;
const FAILURE_BUFFER_KEY = '__e2eAnalyticsFailures__';
const FAILURE_BUFFER_LIMIT = 100;

/** Estágios em que uma falha pode ocorrer durante o track. */
export type SubstituteAppliedFailureStage =
  | 'buffer_push'
  | 'custom_event'
  | 'mirror_invoke'
  | 'mirror_response'
  | 'unexpected';

export interface SubstituteAppliedFailure {
  stage: SubstituteAppliedFailureStage;
  ts: string;
  message: string;
  payload: SubstituteAppliedPayload;
}

function serializeError(err: unknown): { message: string; name?: string; stack?: string } {
  if (err instanceof Error) {
    return { message: err.message, name: err.name, stack: err.stack };
  }
  if (typeof err === 'string') return { message: err };
  try {
    return { message: JSON.stringify(err) };
  } catch {
    return { message: 'unknown_error' };
  }
}

function pushFailureToBuffer(failure: SubstituteAppliedFailure): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as Record<string, unknown>;
  const buf = (w[FAILURE_BUFFER_KEY] as SubstituteAppliedFailure[] | undefined) ?? [];
  buf.push(failure);
  if (buf.length > FAILURE_BUFFER_LIMIT) buf.splice(0, buf.length - FAILURE_BUFFER_LIMIT);
  w[FAILURE_BUFFER_KEY] = buf;
}

/**
 * Registra uma falha durante `trackSubstituteApplied` de forma resiliente:
 * loga estruturado (Sentry via logger), atualiza o buffer E2E de falhas e
 * dispara `lovable:analytics_failure` (best-effort). Nunca throwa.
 */
function reportFailure(
  stage: SubstituteAppliedFailureStage,
  err: unknown,
  payload: SubstituteAppliedPayload,
): void {
  const info = serializeError(err);
  const failure: SubstituteAppliedFailure = {
    stage,
    ts: new Date().toISOString(),
    message: info.message,
    payload,
  };
  try {
    log.warn('substitute_applied_failed', {
      stage,
      err: info,
      axis: payload.axis,
      substituteId: payload.substituteId,
      days: payload.days,
      culpritBefore: payload.culpritBefore ?? null,
    });
  } catch {
    // logger nunca deve derrubar o track.
  }
  try {
    pushFailureToBuffer(failure);
  } catch {
    // buffer é opcional para E2E; segue o baile.
  }
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('lovable:analytics_failure', { detail: failure }));
    } catch {
      // ambientes sem CustomEvent — ignore.
    }
  }
}

function pushToE2EBuffer(evt: IntelligenceAnalyticsEvent, payload: SubstituteAppliedPayload): void {
  if (typeof window === 'undefined') return;
  try {
    const w = window as unknown as Record<string, unknown>;
    const buf = (w[E2E_BUFFER_KEY] as IntelligenceAnalyticsEvent[] | undefined) ?? [];
    buf.push(evt);
    if (buf.length > E2E_BUFFER_LIMIT) buf.splice(0, buf.length - E2E_BUFFER_LIMIT);
    w[E2E_BUFFER_KEY] = buf;
  } catch (err) {
    reportFailure('buffer_push', err, payload);
    return;
  }
  try {
    window.dispatchEvent(new CustomEvent('lovable:analytics', { detail: evt }));
  } catch (err) {
    reportFailure('custom_event', err, payload);
  }
}

/**
 * Espelha o evento no pipeline `ai_usage_events` via edge function.
 * Fire-and-forget: nunca throwa e nunca bloqueia a UX; erros são
 * registrados via {@link reportFailure} (logger + buffer + CustomEvent).
 * SSR-safe (short-circuit se não houver `window`).
 */
function mirrorToUsagePipeline(payload: SubstituteAppliedPayload, clientTs: string): void {
  if (typeof window === 'undefined') return;
  const child = log.child('mirror', { fn: MIRROR_FN });
  const body = {
    axis: payload.axis,
    substituteId: payload.substituteId,
    substituteName: payload.substituteName ?? null,
    days: payload.days,
    culpritBefore: payload.culpritBefore ?? null,
    clientTs,
  };
  try {
    void supabase.functions
      .invoke(MIRROR_FN, { body, headers: child.headers() })
      .then(({ error }) => {
        if (error) {
          reportFailure('mirror_response', error, payload);
          return;
        }
        child.info('mirror_ok', { axis: payload.axis });
      })
      .catch((err) => {
        reportFailure('mirror_invoke', err, payload);
      });
  } catch (err) {
    // supabase.functions.invoke em teoria não throwa síncrono, mas
    // defendemos contra proxies/mocks que podem quebrar esse contrato.
    reportFailure('mirror_invoke', err, payload);
  }
}

export function trackSubstituteApplied(payload: SubstituteAppliedPayload): void {
  const ts = new Date().toISOString();
  const evt: IntelligenceAnalyticsEvent = {
    name: 'intelligence.substitute_applied',
    ts,
    payload,
  };
  try {
    log.info('substitute_applied', { ...payload });
  } catch (err) {
    reportFailure('unexpected', err, payload);
  }
  pushToE2EBuffer(evt, payload);
  mirrorToUsagePipeline(payload, ts);
}
