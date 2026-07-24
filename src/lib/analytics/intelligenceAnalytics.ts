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

function pushToE2EBuffer(evt: IntelligenceAnalyticsEvent): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as Record<string, unknown>;
  const buf = (w[E2E_BUFFER_KEY] as IntelligenceAnalyticsEvent[] | undefined) ?? [];
  buf.push(evt);
  if (buf.length > E2E_BUFFER_LIMIT) buf.splice(0, buf.length - E2E_BUFFER_LIMIT);
  w[E2E_BUFFER_KEY] = buf;
  try {
    window.dispatchEvent(new CustomEvent('lovable:analytics', { detail: evt }));
  } catch {
    // ambientes sem CustomEvent — buffer já foi atualizado.
  }
}

/**
 * Espelha o evento no pipeline `ai_usage_events` via edge function.
 * Fire-and-forget: nunca throwa e nunca bloqueia a UX; erros vão só para o
 * logger estruturado (Sentry via `log.error`). SSR-safe (short-circuit se
 * não houver `window`).
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
  void supabase.functions
    .invoke(MIRROR_FN, { body, headers: child.headers() })
    .then(({ error }) => {
      if (error) {
        child.warn('mirror_failed', { err: error });
        return;
      }
      child.info('mirror_ok', { axis: payload.axis });
    })
    .catch((err) => {
      child.warn('mirror_failed', { err });
    });
}

export function trackSubstituteApplied(payload: SubstituteAppliedPayload): void {
  const ts = new Date().toISOString();
  const evt: IntelligenceAnalyticsEvent = {
    name: 'intelligence.substitute_applied',
    ts,
    payload,
  };
  log.info('substitute_applied', { ...payload });
  pushToE2EBuffer(evt);
  mirrorToUsagePipeline(payload, ts);
}
