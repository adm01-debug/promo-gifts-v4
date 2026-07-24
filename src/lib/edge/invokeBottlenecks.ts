/**
 * invokeBottlenecks — Onda 23
 * ----------------------------------------------------------------
 * Camada de análise sobre `aggregateInvokeEvents`:
 *   1. Classifica cada `fn` em uma **categoria** (auth, crm, magazine,
 *      magic-up, webhook, comparison, dropbox, visual-search, connection,
 *      secrets, other).
 *   2. Calcula um **score de gargalo** por endpoint combinando p95 de
 *      latência, taxa de erro e volume — permite ranquear rapidamente
 *      "quem está segurando o sistema" sem depender de RPC externa.
 *   3. Agrega por categoria (rollup) para o painel `AppHealthDashboard`.
 *
 * Puro / síncrono / sem I/O — 100% testável.
 */

import type { InvokeFnSummary, InvokeGlobalSummary } from './invokeTelemetrySink';

export type EndpointCategory =
  | 'auth'
  | 'comparison'
  | 'connection'
  | 'crm'
  | 'dropbox'
  | 'magazine'
  | 'magic-up'
  | 'mcp'
  | 'other'
  | 'quote'
  | 'secrets'
  | 'visual-search'
  | 'webhook';

interface CategoryRule {
  category: EndpointCategory;
  patterns: readonly (RegExp | string)[];
}

const RULES: readonly CategoryRule[] = [
  { category: 'auth', patterns: [/^log-login/, /^auth-/, /password/, /mfa/i] },
  { category: 'crm', patterns: [/^crm-/, /bitrix/, /salespro/] },
  { category: 'magazine', patterns: [/^magazine/, /revista/] },
  { category: 'magic-up', patterns: [/magic-?up/, /^advertising-/] },
  { category: 'webhook', patterns: [/^webhook-/, /webhook-dispatcher/, /webhook-inbound/] },
  { category: 'comparison', patterns: [/^comparison/, /^comparisons-/] },
  { category: 'dropbox', patterns: [/^dropbox/] },
  { category: 'visual-search', patterns: [/^visual-search/] },
  { category: 'connection', patterns: [/^connection-/, /^connections-/] },
  { category: 'secrets', patterns: [/^secrets-/, /^secret-/] },
  { category: 'mcp', patterns: [/^mcp-/, /full-op-/] },
  { category: 'quote', patterns: [/^quote-/, /^quotes-/, /orcamento/] },
];

export function categorizeFn(fn: string): EndpointCategory {
  const lower = fn.toLowerCase();
  for (const rule of RULES) {
    for (const p of rule.patterns) {
      if (typeof p === 'string') {
        if (lower.includes(p)) return rule.category;
      } else if (p.test(lower)) {
        return rule.category;
      }
    }
  }
  return 'other';
}

export interface EndpointBottleneck extends InvokeFnSummary {
  category: EndpointCategory;
  /** Score 0..∞ — quanto maior, pior. Combina p95, errorRatio e volume. */
  score: number;
  /** Justificativa curta e legível ("p95 1200ms + 34% erros"). */
  reason: string;
}

export interface CategoryRollup {
  category: EndpointCategory;
  fns: number;
  total: number;
  ok: number;
  failed: number;
  breakerOpen: number;
  errorRatio: number;
  /** p95 aproximado: máximo dos p95 individuais (worst-case por categoria). */
  worstP95Ms: number | null;
  score: number;
}

/**
 * Score de gargalo. Modelo simples e defensável:
 *   score = latencyPenalty + errorPenalty + volumeBoost
 *
 *   latencyPenalty = max(0, p95 - 300) / 100  → 1 ponto a cada 100ms acima de 300ms
 *   errorPenalty   = errorRatio * 100          → 1 ponto por 1% de erro
 *   volumeBoost    = log10(1 + total)          → amplifica endpoints com tráfego real
 *
 * Endpoints sem latência medida (só breaker_open) recebem penalidade fixa
 * proporcional a breakerOpen — sinal claro de instabilidade.
 */
export function computeBottleneckScore(s: InvokeFnSummary): { score: number; reason: string } {
  const p95 = s.p95Ms ?? 0;
  const latencyPenalty = p95 > 300 ? (p95 - 300) / 100 : 0;
  const errorPenalty = s.errorRatio * 100;
  const volumeBoost = Math.log10(1 + Math.max(0, s.total));
  const breakerPenalty = s.breakerOpen > 0 ? 5 + s.breakerOpen : 0;

  const score =
    Math.round((latencyPenalty + errorPenalty + breakerPenalty) * (1 + volumeBoost) * 10) / 10;

  const parts: string[] = [];
  if (p95 > 300) parts.push(`p95 ${p95}ms`);
  if (s.errorRatio > 0) parts.push(`${Math.round(s.errorRatio * 100)}% erros`);
  if (s.breakerOpen > 0) parts.push(`${s.breakerOpen}× breaker aberto`);
  if (parts.length === 0) parts.push('estável');

  return { score, reason: parts.join(' + ') };
}

export function rankBottlenecks(
  summary: InvokeGlobalSummary,
  opts: { limit?: number; minTotal?: number } = {},
): EndpointBottleneck[] {
  const limit = opts.limit ?? 10;
  const minTotal = opts.minTotal ?? 1;

  const rows: EndpointBottleneck[] = summary.fns
    .filter((s) => s.total >= minTotal || s.breakerOpen > 0)
    .map((s) => {
      const { score, reason } = computeBottleneckScore(s);
      return { ...s, category: categorizeFn(s.fn), score, reason };
    });

  rows.sort((a, b) => b.score - a.score || b.failed - a.failed);
  return rows.slice(0, limit);
}

export function rollupByCategory(summary: InvokeGlobalSummary): CategoryRollup[] {
  const map = new Map<EndpointCategory, CategoryRollup>();

  for (const s of summary.fns) {
    const cat = categorizeFn(s.fn);
    const cur =
      map.get(cat) ??
      ({
        category: cat,
        fns: 0,
        total: 0,
        ok: 0,
        failed: 0,
        breakerOpen: 0,
        errorRatio: 0,
        worstP95Ms: null,
        score: 0,
      } satisfies CategoryRollup);
    cur.fns += 1;
    cur.total += s.total;
    cur.ok += s.ok;
    cur.failed += s.failed;
    cur.breakerOpen += s.breakerOpen;
    if (typeof s.p95Ms === 'number') {
      cur.worstP95Ms = cur.worstP95Ms === null ? s.p95Ms : Math.max(cur.worstP95Ms, s.p95Ms);
    }
    map.set(cat, cur);
  }

  const rows = Array.from(map.values()).map((r) => {
    const settled = r.ok + r.failed;
    const errorRatio = settled > 0 ? r.failed / settled : 0;
    const synthetic: InvokeFnSummary = {
      fn: r.category,
      total: r.total,
      ok: r.ok,
      failed: r.failed,
      breakerOpen: r.breakerOpen,
      errorRatio,
      p50Ms: null,
      p95Ms: r.worstP95Ms,
      p99Ms: null,
      lastSeenAt: null,
    };
    const { score } = computeBottleneckScore(synthetic);
    return { ...r, errorRatio, score };
  });

  rows.sort((a, b) => b.score - a.score || b.failed - a.failed);
  return rows;
}
