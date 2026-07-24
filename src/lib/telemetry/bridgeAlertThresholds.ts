/**
 * Limiares configuráveis (e persistentes em localStorage) para disparar
 * alertas no painel /admin/telemetria quando a latência p95 ou o tamanho
 * de payload das bridges (external-db-bridge / crm-db-bridge) excederem
 * os valores definidos pelo administrador.
 *
 * Sem custo de backend: tudo client-side, baseado nas amostras já coletadas
 * por bridgeCallMetrics.
 */
import type { BridgeAggregateRow, BridgeName } from './bridgeCallMetrics';

export interface BridgeThresholds {
  /** Latência p95 (ms) — alerta se aggregate.p95Ms >= este valor. */
  p95WarnMs: number;
  /** Latência p95 (ms) — alerta crítico se aggregate.p95Ms >= este valor. */
  p95CritMs: number;
  /** Tamanho médio de resposta (bytes) — alerta se avgRespBytes >= este valor. */
  avgRespWarnBytes: number;
  /** Tamanho médio de resposta (bytes) — crítico se avgRespBytes >= este valor. */
  avgRespCritBytes: number;
  /** Mínimo de chamadas para considerar a métrica significativa. */
  minSamples: number;
  /** Notificar via toast quando um novo alerta surgir. */
  toastEnabled: boolean;
}

export const DEFAULT_THRESHOLDS: Record<BridgeName, BridgeThresholds> = {
  'external-db-bridge': {
    p95WarnMs: 3000,
    p95CritMs: 8000,
    avgRespWarnBytes: 250 * 1024, // 250 KB
    avgRespCritBytes: 1024 * 1024, // 1 MB
    minSamples: 3,
    toastEnabled: true,
  },
  'crm-db-bridge': {
    p95WarnMs: 2000,
    p95CritMs: 5000,
    avgRespWarnBytes: 100 * 1024, // 100 KB
    avgRespCritBytes: 500 * 1024, // 500 KB
    minSamples: 3,
    toastEnabled: true,
  },
};

const STORAGE_KEY = 'telemetry.bridgeAlertThresholds.v1';

let current: Record<BridgeName, BridgeThresholds> = loadFromStorage();
const listeners = new Set<() => void>();

function loadFromStorage(): Record<BridgeName, BridgeThresholds> {
  if (typeof window === 'undefined') return { ...DEFAULT_THRESHOLDS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_THRESHOLDS };
    const parsed = JSON.parse(raw) as Partial<Record<BridgeName, Partial<BridgeThresholds>>>;
    return {
      'external-db-bridge': {
        ...DEFAULT_THRESHOLDS['external-db-bridge'],
        ...parsed['external-db-bridge'],
      },
      'crm-db-bridge': { ...DEFAULT_THRESHOLDS['crm-db-bridge'], ...parsed['crm-db-bridge'] },
    };
  } catch {
    return { ...DEFAULT_THRESHOLDS };
  }
}

function persist() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* noop */
  }
}

function emit() {
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* noop */
    }
  }
}

export function getThresholds(): Record<BridgeName, BridgeThresholds> {
  return current;
}

export function setThresholds(bridge: BridgeName, patch: Partial<BridgeThresholds>): void {
  current = {
    ...current,
    [bridge]: { ...current[bridge], ...patch },
  };
  persist();
  emit();
}

export function resetThresholds(bridge?: BridgeName): void {
  if (bridge) {
    current = { ...current, [bridge]: { ...DEFAULT_THRESHOLDS[bridge] } };
  } else {
    current = { ...DEFAULT_THRESHOLDS };
  }
  persist();
  emit();
}

export function subscribeThresholds(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ---------- Avaliação ----------

export type AlertSeverity = 'crit' | 'warn';
export type AlertMetric = 'avgResp' | 'p95';

export interface BridgeAlert {
  key: string; // bridge::op::metric
  bridge: BridgeName;
  op: string;
  metric: AlertMetric;
  severity: AlertSeverity;
  value: number;
  threshold: number;
  count: number;
  message: string;
}

export function evaluateAlerts(
  rows: readonly BridgeAggregateRow[],
  thresholds: Record<BridgeName, BridgeThresholds> = current,
): BridgeAlert[] {
  const alerts: BridgeAlert[] = [];
  for (const row of rows) {
    const t = thresholds[row.bridge];
    if (!t || row.count < t.minSamples) continue;

    if (row.p95Ms >= t.p95CritMs) {
      alerts.push({
        key: `${row.bridge}::${row.op}::p95`,
        bridge: row.bridge,
        op: row.op,
        metric: 'p95',
        severity: 'crit',
        value: row.p95Ms,
        threshold: t.p95CritMs,
        count: row.count,
        message: `p95 crítico em ${row.op}: ${row.p95Ms}ms ≥ ${t.p95CritMs}ms`,
      });
    } else if (row.p95Ms >= t.p95WarnMs) {
      alerts.push({
        key: `${row.bridge}::${row.op}::p95`,
        bridge: row.bridge,
        op: row.op,
        metric: 'p95',
        severity: 'warn',
        value: row.p95Ms,
        threshold: t.p95WarnMs,
        count: row.count,
        message: `p95 elevado em ${row.op}: ${row.p95Ms}ms ≥ ${t.p95WarnMs}ms`,
      });
    }

    if (row.avgRespBytes >= t.avgRespCritBytes) {
      alerts.push({
        key: `${row.bridge}::${row.op}::avgResp`,
        bridge: row.bridge,
        op: row.op,
        metric: 'avgResp',
        severity: 'crit',
        value: row.avgRespBytes,
        threshold: t.avgRespCritBytes,
        count: row.count,
        message: `payload crítico em ${row.op}: ${row.avgRespBytes}B ≥ ${t.avgRespCritBytes}B`,
      });
    } else if (row.avgRespBytes >= t.avgRespWarnBytes) {
      alerts.push({
        key: `${row.bridge}::${row.op}::avgResp`,
        bridge: row.bridge,
        op: row.op,
        metric: 'avgResp',
        severity: 'warn',
        value: row.avgRespBytes,
        threshold: t.avgRespWarnBytes,
        count: row.count,
        message: `payload elevado em ${row.op}: ${row.avgRespBytes}B ≥ ${t.avgRespWarnBytes}B`,
      });
    }
  }
  // Críticos primeiro
  alerts.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'crit' ? -1 : 1;
    return b.value - a.value;
  });
  return alerts;
}
