import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Detecta regressão de latência em listings de `products` com limit alto (> 50).
 *
 * Estratégia:
 *  - Janela atual (current):   últimas 1h
 *  - Janela baseline:          das últimas 24h até 1h atrás (23h de histórico)
 *  - Alerta quando o p95/média atual sobe acima de thresholds vs baseline
 *    OU quando a média atual cruza um SLA absoluto.
 *
 * SLAs (alinhados com supabase/functions/external-db-bridge/performance.test.ts):
 *  - Mediana alvo:  3500ms
 *  - Teto absoluto: 8000ms
 *
 * Auto-refresh a cada 60s.
 */

const SLA_MEDIAN_MS = 3500;
const SLA_HARD_CEILING_MS = 8000;
const REGRESSION_RATIO = 1.5; // 50% mais lento que o baseline = regressão
const MIN_SAMPLES_CURRENT = 5; // mínimo para considerar a janela atual significativa
const MIN_SAMPLES_BASELINE = 10; // mínimo para que o baseline seja confiável

export type LatencyAlertSeverity = 'ok' | 'warning' | 'critical';

export interface LatencyAlertReason {
  code: 'sla-breach' | 'regression' | 'spike-very-slow' | 'insufficient-data';
  message: string;
}

export interface ProductsListingLatencyAlert {
  severity: LatencyAlertSeverity;
  reasons: LatencyAlertReason[];
  current: {
    samples: number;
    avgMs: number;
    p95Ms: number;
    verySlowCount: number;
  };
  baseline: {
    samples: number;
    avgMs: number;
    p95Ms: number;
  };
  /** Variação percentual da média atual vs baseline. Ex: 0.32 = +32%. */
  avgDeltaPct: number;
}

interface TelemetryRow {
  duration_ms: number;
  severity: string;
}

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const idx = Math.min(sortedValues.length - 1, Math.floor((sortedValues.length - 1) * p));
  return sortedValues[idx];
}

function summarize(rows: TelemetryRow[]) {
  if (rows.length === 0) return { samples: 0, avgMs: 0, p95Ms: 0, verySlowCount: 0 };
  const durations = rows.map((r) => r.duration_ms).sort((a, b) => a - b);
  const sum = durations.reduce((acc, v) => acc + v, 0);
  return {
    samples: rows.length,
    avgMs: Math.round(sum / rows.length),
    p95Ms: percentile(durations, 0.95),
    verySlowCount: rows.filter((r) => r.severity === 'very_slow').length,
  };
}

async function fetchWindow(fromIso: string, toIso: string): Promise<TelemetryRow[]> {
  // SSOT: query_telemetry só persiste queries com severity != 'ok' (>3s ou erros).
  // Por isso o baseline naturalmente representa a cauda lenta — o que é exatamente
  // o sinal que queremos monitorar para detectar regressão.
  const { data, error } = await supabase
    .from('query_telemetry')
    .select('duration_ms, severity')
    .eq('operation', 'select')
    .eq('table_name', 'products')
    .gt('query_limit', 50)
    .neq('severity', 'error') // erros têm um card próprio; aqui medimos latência
    .gte('created_at', fromIso)
    .lt('created_at', toIso)
    .limit(2000);

  if (error) throw error;
  return data ?? [];
}

export function useProductsListingLatencyAlert() {
  const query = useQuery({
    queryKey: ['products-listing-latency-alert'],
    queryFn: async (): Promise<ProductsListingLatencyAlert> => {
      const now = Date.now();
      const oneHourAgo = new Date(now - 3_600_000).toISOString();
      const twentyFourHoursAgo = new Date(now - 86_400_000).toISOString();
      const nowIso = new Date(now).toISOString();

      const [currentRows, baselineRows] = await Promise.all([
        fetchWindow(oneHourAgo, nowIso),
        fetchWindow(twentyFourHoursAgo, oneHourAgo),
      ]);

      const current = summarize(currentRows);
      const baseline = summarize(baselineRows);

      const avgDeltaPct =
        baseline.avgMs > 0 ? (current.avgMs - baseline.avgMs) / baseline.avgMs : 0;

      const reasons: LatencyAlertReason[] = [];
      let severity: LatencyAlertSeverity = 'ok';

      if (current.samples < MIN_SAMPLES_CURRENT) {
        // Sem dados suficientes para conclusão — exibimos como "ok" (sem alerta)
        // mas sinalizamos a razão para transparência.
        return {
          severity: 'ok',
          reasons: [
            {
              code: 'insufficient-data',
              message: `Apenas ${current.samples} amostra(s) lenta(s) na última hora — sem sinal estatístico para alerta.`,
            },
          ],
          current,
          baseline,
          avgDeltaPct,
        };
      }

      // 1) SLA absoluto — média acima do teto é sempre crítico.
      if (current.avgMs >= SLA_HARD_CEILING_MS) {
        severity = 'critical';
        reasons.push({
          code: 'sla-breach',
          message: `Latência média ${current.avgMs}ms ≥ teto absoluto de ${SLA_HARD_CEILING_MS}ms.`,
        });
      } else if (current.avgMs >= SLA_MEDIAN_MS) {
        // Nesta ramificação `else if`, `severity` ainda é 'ok' (o teto absoluto
        // não foi atingido), portanto o alerta de SLA é sempre 'warning'.
        severity = 'warning';
        reasons.push({
          code: 'sla-breach',
          message: `Latência média ${current.avgMs}ms ≥ SLA alvo de ${SLA_MEDIAN_MS}ms.`,
        });
      }

      // 2) Regressão vs baseline — só faz sentido se o baseline tem dados suficientes.
      if (baseline.samples >= MIN_SAMPLES_BASELINE && baseline.avgMs > 0) {
        if (current.avgMs >= baseline.avgMs * REGRESSION_RATIO) {
          severity = 'critical';
          reasons.push({
            code: 'regression',
            message: `Média atual ${current.avgMs}ms é ${Math.round(avgDeltaPct * 100)}% maior que a baseline de ${baseline.avgMs}ms (24h).`,
          });
        }
      }

      // 3) Spike de queries muito lentas (>8s) — qualquer ocorrência merece atenção.
      if (current.verySlowCount >= 3) {
        severity = 'critical';
        reasons.push({
          code: 'spike-very-slow',
          message: `${current.verySlowCount} queries muito lentas (>8s) na última hora.`,
        });
      } else if (current.verySlowCount >= 1 && severity === 'ok') {
        severity = 'warning';
        reasons.push({
          code: 'spike-very-slow',
          message: `${current.verySlowCount} query(s) muito lenta(s) (>8s) na última hora.`,
        });
      }

      return { severity, reasons, current, baseline, avgDeltaPct };
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  return {
    alert: query.data,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    error: query.error,
  };
}

export const LATENCY_ALERT_THRESHOLDS = {
  SLA_MEDIAN_MS,
  SLA_HARD_CEILING_MS,
  REGRESSION_RATIO,
  MIN_SAMPLES_CURRENT,
  MIN_SAMPLES_BASELINE,
};
