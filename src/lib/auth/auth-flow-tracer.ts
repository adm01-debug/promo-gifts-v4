/**
 * Auth flow tracer — agrupa todos os eventos de um único round-trip OAuth
 * sob um `flowId` único, persiste um snapshot enxuto em `sessionStorage` para
 * inspeção pós-falha em `/login` e só emite console quando o debug de auth está
 * habilitado.
 *
 * Como usar em diagnóstico:
 *   1. Habilite `VITE_AUTH_DEBUG=true` ou rode em DEV.
 *   2. Abra o DevTools → Console e filtre por `[AUTH-FLOW]`.
 *   3. Se foi redirecionado pra `/login`, abra o console e rode:
 *        copy(JSON.parse(sessionStorage.getItem('__sso_last_flow')))
 *      e me mande o JSON.
 */

import { authDebug, authDebugError, summarizeSession } from './auth-debug';
import type { Session } from '@supabase/supabase-js';
import { maskSensitiveText } from '@/lib/sensitive-masking';

import { logger } from '@/lib/logger';
const STORAGE_KEY = '__sso_last_flow';
const FLOW_PREFIX = '[AUTH-FLOW]';
const AUTH_FLOW_DEBUG_ENABLED = import.meta.env.DEV || import.meta.env.VITE_AUTH_DEBUG === 'true';

export type FlowPhase =
  | 'mount'
  | 'url-parsed'
  | 'provider-error-query'
  | 'provider-error-hash'
  | 'pkce-exchange-start'
  | 'pkce-exchange-ok'
  | 'pkce-exchange-failed'
  | 'session-check-initial'
  | 'session-found-immediately'
  | 'auth-listener-subscribed'
  | 'auth-state-change'
  | 'timeout-recheck'
  | 'redirect-home'
  | 'redirect-login'
  | 'unexpected-error';

export type FlowOutcome = 'success' | 'failure' | 'pending';

interface FlowStep {
  /** ms desde o mount. */
  t: number;
  phase: FlowPhase;
  detail?: unknown;
}

interface FlowSnapshot {
  flowId: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  outcome: FlowOutcome;
  url: { pathname: string; hasQuery: boolean; hasHash: boolean };
  flow: 'pkce' | 'implicit' | 'unknown';
  providerError: string | null;
  finalSessionUser: string | null;
  finalProvider: string | null;
  finalIssuer: string | null;
  redirectTarget: string | null;
  failureReason: string | null;
  steps: FlowStep[];
}

function randomId(): string {
  // 8 hex chars sem dependência externa
  const bytes = new Uint8Array(4);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 4; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export class AuthFlowTracer {
  readonly flowId: string;
  private readonly t0: number;
  private readonly snapshot: FlowSnapshot;

  constructor() {
    this.flowId = randomId();
    this.t0 = performance.now();
    const url = typeof window !== 'undefined' ? new URL(window.location.href) : null;
    this.snapshot = {
      flowId: this.flowId,
      startedAt: new Date().toISOString(),
      endedAt: null,
      durationMs: null,
      outcome: 'pending',
      url: {
        pathname: url?.pathname ?? '',
        hasQuery: (url?.search?.length ?? 0) > 0,
        hasHash: (url?.hash?.length ?? 0) > 0,
      },
      flow: 'unknown',
      providerError: null,
      finalSessionUser: null,
      finalProvider: null,
      finalIssuer: null,
      redirectTarget: null,
      failureReason: null,
      steps: [],
    };
    if (AUTH_FLOW_DEBUG_ENABLED) {
      logger.warn(
        `${FLOW_PREFIX} flow=${this.flowId} START path=${this.snapshot.url.pathname} ` +
          `query=${this.snapshot.url.hasQuery} hash=${this.snapshot.url.hasHash}`,
      );
    }
  }

  /** Marca uma fase do fluxo. Sempre acompanhada de log auth-debug detalhado. */
  step(phase: FlowPhase, detail?: unknown): void {
    const t = Math.round(performance.now() - this.t0);
    this.snapshot.steps.push({ t, phase, detail: this.safeDetail(detail) });
    authDebug(`sso-callback:${this.flowId}`, `${phase} (+${t}ms)`, detail);
  }

  /** Marca uma fase de erro (usa authDebugError no console). */
  stepError(phase: FlowPhase, error: unknown): void {
    const t = Math.round(performance.now() - this.t0);
    const normalized =
      error instanceof Error
        ? { name: error.name, message: error.message }
        : { value: String(error) };
    this.snapshot.steps.push({ t, phase, detail: normalized });
    authDebugError(`sso-callback:${this.flowId}`, `${phase} (+${t}ms)`, error);
  }

  setFlow(flow: FlowSnapshot['flow']): void {
    this.snapshot.flow = flow;
  }

  setProviderError(err: string | null): void {
    this.snapshot.providerError = err;
  }

  captureSession(session: Session | null): void {
    if (!session) return;
    const summary = summarizeSession(session);
    this.snapshot.finalSessionUser =
      summary && typeof summary === 'object' && 'user' in summary
        ? ((summary as { user?: { email?: string } }).user?.email ?? null)
        : null;
    this.snapshot.finalProvider = session.user?.app_metadata?.provider ?? null;
    this.snapshot.finalIssuer =
      summary && typeof summary === 'object' && 'claims' in summary
        ? ((summary as { claims?: { iss?: string } }).claims?.iss ?? null)
        : null;
  }

  /** Finaliza o fluxo, persiste snapshot e imprime timeline agrupada no console. */
  finish(outcome: FlowOutcome, target: string | null, failureReason?: string): void {
    const t = Math.round(performance.now() - this.t0);
    this.snapshot.endedAt = new Date().toISOString();
    this.snapshot.durationMs = t;
    this.snapshot.outcome = outcome;
    this.snapshot.redirectTarget = target;
    this.snapshot.failureReason = failureReason ?? null;

    this.persist();

    const icon = outcome === 'success' ? '✅' : outcome === 'failure' ? '❌' : '⏳';
    const title =
      `${FLOW_PREFIX} ${icon} flow=${this.flowId} ${outcome.toUpperCase()} ` +
      `flow=${this.snapshot.flow} duration=${t}ms target=${target ?? '-'}${
        failureReason ? ` reason="${failureReason}"` : ''
      }`;

    if (AUTH_FLOW_DEBUG_ENABLED) {
      const safeSnapshot = this.safeSnapshot();
      logger.warn(title, {
        ...safeSnapshot,
        steps: safeSnapshot.steps.map((s) => ({ t: s.t, phase: s.phase })),
      });
    }
  }

  /** Última snapshot disponível (estática) — útil em `/login` pós-falha. */
  static readLast(): FlowSnapshot | null {
    if (typeof sessionStorage === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as FlowSnapshot) : null;
    } catch {
      return null;
    }
  }

  private persist(): void {
    if (typeof sessionStorage === 'undefined') return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.snapshot));
    } catch {
      // quota cheia ou storage bloqueado — ignora
    }
  }

  /** Remove campos potencialmente sensíveis antes de salvar no detail. */
  private safeDetail(detail: unknown): unknown {
    if (detail === null || detail === undefined) return detail;
    if (typeof detail !== 'object')
      return typeof detail === 'string' ? maskSensitiveText(detail) : detail;
    try {
      // serialize → parse para garantir que é JSON-safe
      const masked = maskSensitiveText(JSON.stringify(detail));
      return masked ? JSON.parse(masked) : null;
    } catch {
      return { unserializable: true };
    }
  }

  private safeSnapshot(): FlowSnapshot {
    return {
      ...this.snapshot,
      finalSessionUser: this.snapshot.finalSessionUser ? '<masked-email>' : null,
      steps: this.snapshot.steps.map((step) => ({
        ...step,
        detail: this.safeDetail(step.detail),
      })),
    };
  }
}

export type { FlowSnapshot };
