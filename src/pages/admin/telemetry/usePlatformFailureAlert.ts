/**
 * usePlatformFailureAlert
 * --------------------------------------------------------------
 * Dispara um alerta visual + log central quando a taxa de falhas
 * 503 ou cold-start do `external-db-bridge` ultrapassa o limite.
 *
 * - Threshold por tipo (default: 5% para 503, 10% para cold-start) configurável
 *   via localStorage para o admin ajustar sem deploy.
 * - Mínimo de chamadas na janela (`minSamples`) evita disparos com 1/2 = 50%.
 * - Toast e `logger.error` são throttled por (windowMinutes × 60s) para não
 *   spammar enquanto o incidente persiste.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import {
  usePlatformFailureMetrics,
  type PlatformFailureMetrics,
} from '@/pages/admin/telemetry/usePlatformFailureMetrics';

const STORAGE_KEY = 'admin.telemetry.failureAlertConfig';

export interface FailureAlertConfig {
  /** Limite (%) acima do qual taxa de 503 dispara alerta. */
  threshold503Pct: number;
  /** Limite (%) acima do qual taxa de cold-start dispara alerta. */
  thresholdColdStartPct: number;
  /** Volume mínimo na janela para considerar a taxa significativa. */
  minSamples: number;
  /** Habilitar/desabilitar globalmente. */
  enabled: boolean;
}

export const DEFAULT_ALERT_CONFIG: FailureAlertConfig = {
  threshold503Pct: 5,
  thresholdColdStartPct: 10,
  minSamples: 20,
  enabled: true,
};

export function loadAlertConfig(): FailureAlertConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ALERT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<FailureAlertConfig>;
    return { ...DEFAULT_ALERT_CONFIG, ...parsed };
  } catch {
    return DEFAULT_ALERT_CONFIG;
  }
}

export function saveAlertConfig(cfg: FailureAlertConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    /* storage indisponível — usa defaults na próxima leitura */
  }
}

export type AlertLevel = 'breach_503' | 'breach_both' | 'breach_cold_start' | 'ok';

export interface AlertState {
  level: AlertLevel;
  metrics: PlatformFailureMetrics | undefined;
  config: FailureAlertConfig;
  reason: string;
  setConfig: (cfg: FailureAlertConfig) => void;
}

function classify(metrics: PlatformFailureMetrics, cfg: FailureAlertConfig): AlertLevel {
  if (!cfg.enabled) return 'ok';
  if (metrics.totalCalls < cfg.minSamples) return 'ok';
  const breach503 = metrics.rate503Pct >= cfg.threshold503Pct;
  const breachCold = metrics.rateColdStartPct >= cfg.thresholdColdStartPct;
  if (breach503 && breachCold) return 'breach_both';
  if (breach503) return 'breach_503';
  if (breachCold) return 'breach_cold_start';
  return 'ok';
}

export function usePlatformFailureAlert(windowMinutes = 60): AlertState {
  const { data: metrics } = usePlatformFailureMetrics(windowMinutes);
  const [config, setConfigState] = useState<FailureAlertConfig>(() => loadAlertConfig());
  const lastNotifiedAt = useRef<number>(0);
  const lastLevel = useRef<AlertLevel>('ok');

  const setConfig = (cfg: FailureAlertConfig) => {
    setConfigState(cfg);
    saveAlertConfig(cfg);
  };

  const level: AlertLevel = useMemo(
    () => (metrics ? classify(metrics, config) : 'ok'),
    [metrics, config],
  );

  const reason = useMemo(() => {
    if (!metrics || level === 'ok') return '';
    const parts: string[] = [];
    if (level !== 'breach_cold_start') {
      parts.push(`503=${metrics.rate503Pct.toFixed(2)}% (limite ${config.threshold503Pct}%)`);
    }
    if (level !== 'breach_503') {
      parts.push(
        `cold-start=${metrics.rateColdStartPct.toFixed(2)}% (limite ${config.thresholdColdStartPct}%)`,
      );
    }
    return parts.join(' · ');
  }, [metrics, level, config]);

  // Side-effect: notifica + loga centralmente quando entra/persiste em estado de alerta.
  useEffect(() => {
    if (!metrics || level === 'ok') {
      if (lastLevel.current !== 'ok') {
        // Recuperação — emite uma única confirmação.
        logger.info('[FailureAlert] recuperado — taxas voltaram abaixo do limite', {
          windowMinutes,
          rate503Pct: metrics?.rate503Pct,
          rateColdStartPct: metrics?.rateColdStartPct,
        });
        toast.success('Falhas de plataforma normalizadas');
        lastLevel.current = 'ok';
      }
      return;
    }

    const now = Date.now();
    const throttleMs = windowMinutes * 60_000;
    const transitioned = lastLevel.current !== level;
    if (!transitioned && now - lastNotifiedAt.current < throttleMs) return;

    lastNotifiedAt.current = now;
    lastLevel.current = level;

    // Log central (sempre — `logger.error` roda em prod também).
    logger.error('[FailureAlert] limite de falhas excedido', {
      level,
      windowMinutes,
      reason,
      total503: metrics.total503,
      totalColdStarts: metrics.totalColdStarts,
      totalCalls: metrics.totalCalls,
      rate503Pct: metrics.rate503Pct,
      rateColdStartPct: metrics.rateColdStartPct,
      delta503: metrics.delta503,
      thresholds: {
        rate503Pct: config.threshold503Pct,
        rateColdStartPct: config.thresholdColdStartPct,
        minSamples: config.minSamples,
      },
    });

    toast.error('Limite de falhas excedido no external-db-bridge', {
      description: reason,
      duration: 8000,
    });
  }, [level, metrics, reason, windowMinutes, config]);

  return { level, metrics, config, reason, setConfig };
}
