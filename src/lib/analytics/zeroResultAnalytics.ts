/**
 * zeroResultAnalytics — telemetria do callout de resultado zero em
 * /inteligencia-comercial. Registra quais ações o usuário toma no callout
 * (remover filtro, ampliar janela, aplicar substituto) E o resultado que
 * a UI passa a mostrar após a ação (novo culprit / se ainda deu zero).
 *
 * Segue o mesmo padrão do `cartAnalytics.ts`:
 *   1. structuredLogger (canal oficial)
 *   2. window.dispatchEvent('lovable:analytics')
 *   3. window.__e2eAnalytics__ (buffer para Playwright)
 */
import { createClientLogger } from '@/lib/telemetry/structuredLogger';
import type { FilterKey } from '@/hooks/intelligence/useZeroResultDiagnosis';

const log = createClientLogger('bi.zero_result');

export const ZERO_RESULT_ACTIONS = [
  'clear_filter',
  'widen_window',
  'apply_substitute',
  'undo',
] as const;
export type ZeroResultAction = (typeof ZERO_RESULT_ACTIONS)[number];

export type ZeroResultCulprit = FilterKey | 'window' | 'intersection' | null;

export interface ZeroResultActionClickedPayload {
  action: ZeroResultAction;
  /** Estado do diagnóstico ANTES da ação. */
  culpritBefore: ZeroResultCulprit;
  /** Filtro-alvo da ação, quando aplicável (`clear_filter`, `apply_substitute`). */
  filterKey?: FilterKey | null;
  /** Janela em dias no momento do clique. */
  days: number;
  /** Prévia numérica exibida ao usuário no botão clicado (quando disponível). */
  previewQuotes?: number | null;
  previewOrders?: number | null;
  /** Para `widen_window`: nova janela sugerida pelo probe. */
  widenedToDays?: number | null;
  /** Para `apply_substitute`: id/nome do substituto escolhido. */
  substituteId?: string | null;
  substituteName?: string | null;
}

export interface ZeroResultOutcomePayload {
  action: ZeroResultAction;
  culpritBefore: ZeroResultCulprit;
  culpritAfter: ZeroResultCulprit;
  /** Continuou zerado após a ação? */
  stillZero: boolean;
  daysBefore: number;
  daysAfter: number;
  /** Latência entre o clique e a nova resposta do painel (ms). */
  resolvedInMs: number;
}

export type ZeroResultAnalyticsEvent =
  | {
      name: 'bi.zero_result.action_clicked';
      ts: string;
      payload: ZeroResultActionClickedPayload;
    }
  | {
      name: 'bi.zero_result.outcome';
      ts: string;
      payload: ZeroResultOutcomePayload;
    };

const E2E_BUFFER_KEY = '__e2eAnalytics__';
const E2E_BUFFER_LIMIT = 200;

function pushToE2EBuffer(evt: ZeroResultAnalyticsEvent): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as Record<string, unknown>;
  const buf = (w[E2E_BUFFER_KEY] as ZeroResultAnalyticsEvent[] | undefined) ?? [];
  buf.push(evt);
  if (buf.length > E2E_BUFFER_LIMIT) buf.splice(0, buf.length - E2E_BUFFER_LIMIT);
  w[E2E_BUFFER_KEY] = buf;
  try {
    window.dispatchEvent(new CustomEvent('lovable:analytics', { detail: evt }));
  } catch {
    // Ambientes sem CustomEvent — buffer já foi atualizado.
  }
}

export function trackZeroResultActionClicked(
  payload: ZeroResultActionClickedPayload,
): void {
  const evt: ZeroResultAnalyticsEvent = {
    name: 'bi.zero_result.action_clicked',
    ts: new Date().toISOString(),
    payload,
  };
  log.info('zero_result_action_clicked', { ...payload });
  pushToE2EBuffer(evt);
}

export function trackZeroResultOutcome(payload: ZeroResultOutcomePayload): void {
  const evt: ZeroResultAnalyticsEvent = {
    name: 'bi.zero_result.outcome',
    ts: new Date().toISOString(),
    payload,
  };
  // `warn` quando permaneceu zero — sinal de que a sugestão não resolveu.
  if (payload.stillZero) {
    log.warn('zero_result_still_zero_after_action', { ...payload });
  } else {
    log.info('zero_result_resolved', { ...payload });
  }
  pushToE2EBuffer(evt);
}

/** Helper de teste — limpa o buffer entre cenários. */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function __resetZeroResultAnalyticsBufferForTests(): void {
  if (typeof window === 'undefined') return;
  (window as unknown as Record<string, unknown>)[E2E_BUFFER_KEY] = [];
}
