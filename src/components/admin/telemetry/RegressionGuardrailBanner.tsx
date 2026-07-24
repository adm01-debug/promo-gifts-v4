/**
 * RegressionGuardrailBanner
 * --------------------------------------------------------------
 * Top-of-page alert that surfaces the result of the automated KPI
 * regression check (RPC check_telemetry_regression).
 *
 * Visual states:
 *   - regression → destructive banner (vermelho), motivos + deltas
 *   - warning    → warning banner (amarelo)
 *   - ok         → faixa discreta success
 *   - insufficient_data → muted info
 *   - error      → muted info com mensagem
 *
 * Pure presentation. Dispara toast crítico (sonner) na primeira detecção
 * de regression para garantir que o admin não passe despercebido.
 */
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Info,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import {
  useRegressionGuardrail,
  type GuardrailStatus,
} from '@/pages/admin/telemetry/useRegressionGuardrail';

const STATUS_META: Record<
  GuardrailStatus,
  {
    tone: 'destructive' | 'muted' | 'success' | 'warning';
    icon: typeof AlertOctagon;
    label: string;
  }
> = {
  regression: { tone: 'destructive', icon: AlertOctagon, label: 'Regressão crítica detectada' },
  warning: { tone: 'warning', icon: AlertTriangle, label: 'Aviso de degradação' },
  ok: { tone: 'success', icon: CheckCircle2, label: 'KPIs dentro do esperado' },
  insufficient_data: { tone: 'muted', icon: Info, label: 'Aguardando amostras suficientes' },
  error: { tone: 'muted', icon: Info, label: 'Falha ao consultar guardrail' },
};

export function RegressionGuardrailBanner() {
  const { report, isLoading, refetch, lastCheckedAt } = useRegressionGuardrail();
  const lastNotifiedStatus = useRef<GuardrailStatus | null>(null);

  // Notificação push uma única vez por transição para 'regression'.
  useEffect(() => {
    if (report.status === 'regression' && lastNotifiedStatus.current !== 'regression') {
      toast.error('Regressão crítica de performance', {
        description: report.reasons[0] ?? 'KPIs degradaram além do limite seguro.',
        duration: 10_000,
      });
    }
    lastNotifiedStatus.current = report.status;
  }, [report.status, report.reasons]);

  const meta = STATUS_META[report.status];
  const Icon = meta.icon;

  return (
    <Card
      className={cn(
        'border-[1.5px] transition-colors',
        meta.tone === 'destructive' &&
          'border-destructive/50 bg-destructive/5 ring-1 ring-destructive/20',
        meta.tone === 'warning' && 'border-warning/50 bg-warning/5',
        meta.tone === 'success' && 'border-success/40 bg-success/5',
        meta.tone === 'muted' && 'border-border bg-muted/20',
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'shrink-0 rounded-lg p-2.5',
              meta.tone === 'destructive' && 'bg-destructive/15 text-destructive',
              meta.tone === 'warning' && 'bg-warning/15 text-warning',
              meta.tone === 'success' && 'bg-success/15 text-success',
              meta.tone === 'muted' && 'bg-muted text-muted-foreground',
            )}
          >
            <Icon className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-base font-semibold">{meta.label}</h3>
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] uppercase tracking-wide',
                  meta.tone === 'destructive' && 'border-destructive/40 text-destructive',
                  meta.tone === 'warning' && 'border-warning/40 text-warning',
                  meta.tone === 'success' && 'border-success/40 text-success',
                )}
              >
                <ShieldAlert className="mr-1 h-3 w-3" />
                Guardrail automático
              </Badge>
              {lastCheckedAt > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  Verificado {new Date(lastCheckedAt).toLocaleTimeString('pt-BR')}
                </span>
              )}
            </div>

            {report.reasons.length > 0 && (
              <ul className="mt-2 space-y-1">
                {report.reasons.map((reason, i) => (
                  <li
                    key={i}
                    className={cn(
                      'flex items-start gap-2 text-sm',
                      meta.tone === 'destructive' && 'text-destructive/90',
                      meta.tone === 'warning' && 'text-warning-foreground',
                    )}
                  >
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            )}

            {report.current && report.baseline && (
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <MetricDelta
                  label="P95 latência"
                  current={`${report.current.p95_ms}ms`}
                  baseline={`${report.baseline.p95_ms}ms`}
                  deltaPct={report.deltas?.p95_delta_pct}
                  inverted
                />
                <MetricDelta
                  label="Taxa de erro"
                  current={`${report.current.error_rate_pct}%`}
                  baseline={`${report.baseline.error_rate_pct}%`}
                  deltaPct={report.deltas?.error_rate_delta_pp}
                  unit="pp"
                  inverted
                />
                <MetricDelta
                  label="Queries >8s"
                  current={String(report.current.very_slow)}
                  baseline={String(report.baseline.very_slow)}
                  deltaPct={
                    report.deltas?.very_slow_ratio
                      ? Math.round((report.deltas.very_slow_ratio - 1) * 100)
                      : undefined
                  }
                  inverted
                />
              </div>
            )}
          </div>

          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface MetricDeltaProps {
  label: string;
  current: string;
  baseline: string;
  deltaPct?: number;
  unit?: string;
  /** Quando true, valores positivos são ruins (latência, erros). */
  inverted?: boolean;
}

function MetricDelta({
  label,
  current,
  baseline,
  deltaPct,
  unit = '%',
  inverted,
}: MetricDeltaProps) {
  const hasDelta = deltaPct !== undefined && deltaPct !== null && !Number.isNaN(deltaPct);
  const delta = hasDelta ? deltaPct : 0;
  const isBad = hasDelta && (inverted ? delta > 0 : delta < 0);
  const isGood = hasDelta && (inverted ? delta < 0 : delta > 0);

  return (
    <div className="rounded-md border border-border/40 bg-background/50 p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-mono text-sm font-semibold tabular-nums">{current}</p>
      <p className="text-[10px] text-muted-foreground">
        baseline: <span className="font-mono">{baseline}</span>
      </p>
      {hasDelta && (
        <p
          className={cn(
            'mt-0.5 font-mono text-[10px] tabular-nums',
            isBad && 'text-destructive',
            isGood && 'text-success',
            !isBad && !isGood && 'text-muted-foreground',
          )}
        >
          {delta > 0 ? '+' : ''}
          {delta}
          {unit}
        </p>
      )}
    </div>
  );
}
