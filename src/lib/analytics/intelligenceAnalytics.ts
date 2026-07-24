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
import type { FilterKey } from '@/hooks/intelligence/useZeroResultDiagnosis';

const log = createClientLogger('bi.intelligence');

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

export function trackSubstituteApplied(payload: SubstituteAppliedPayload): void {
  const evt: IntelligenceAnalyticsEvent = {
    name: 'intelligence.substitute_applied',
    ts: new Date().toISOString(),
    payload,
  };
  log.info('substitute_applied', { ...payload });
  pushToE2EBuffer(evt);
}
