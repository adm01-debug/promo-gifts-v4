/**
 * ClientVsIndustryComparison — Zona 5 do BI.
 * Sprint 2: 5ª métrica = Share-of-Wallet (estimativa heurística) com gap em R$.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Scale, TrendingUp, TrendingDown, Minus, Lightbulb, Info, Wallet } from 'lucide-react';
import { useClientVsIndustry, type MetricComparison } from '@/hooks/bi/useClientVsIndustry';
import { ComparisonSkeleton } from '@/components/bi/BISkeletons';
import { formatCurrencyCompact, formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Props {
  clientId: string;
  ramoAtividade: string | null;
}

function formatValue(m: MetricComparison): string {
  if (m.format === 'currency') return formatCurrencyCompact(m.clientValue);
  return m.clientValue.toFixed(m.clientValue < 10 ? 1 : 0);
}
function formatIndustry(m: MetricComparison): string {
  if (m.format === 'currency') return formatCurrencyCompact(m.industryAvg);
  return m.industryAvg.toFixed(m.industryAvg < 10 ? 1 : 0);
}

function classificationStyles(c: MetricComparison['classification']) {
  switch (c) {
    case 'above':
      return {
        text: 'text-success',
        bar: 'bg-success',
        bg: 'bg-success/10',
        Icon: TrendingUp,
        label: 'Acima da média',
      };
    case 'below':
      return {
        text: 'text-destructive',
        bar: 'bg-destructive',
        bg: 'bg-destructive/10',
        Icon: TrendingDown,
        label: 'Abaixo da média',
      };
    case 'on_par':
      return {
        text: 'text-warning',
        bar: 'bg-warning',
        bg: 'bg-warning/10',
        Icon: Minus,
        label: 'Na média',
      };
    case 'no_data':
    default:
      return {
        text: 'text-muted-foreground',
        bar: 'bg-muted',
        bg: 'bg-muted/40',
        Icon: Minus,
        label: 'Sem dados',
      };
  }
}

function MetricRow({ metric }: { metric: MetricComparison }) {
  const styles = classificationStyles(metric.classification);
  const total = Math.max(metric.clientValue, metric.industryAvg, 1);
  const clientPct = Math.min(100, (metric.clientValue / total) * 100);
  const industryPct = Math.min(100, (metric.industryAvg / total) * 100);
  const deltaSign = metric.deltaPercent > 0 ? '+' : '';

  return (
    <div className="space-y-2 rounded-lg border bg-card/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {metric.label}
        </span>
        <Badge
          variant="outline"
          className={cn('gap-1 border-0 text-[10px]', styles.bg, styles.text)}
        >
          <styles.Icon className="h-3 w-3" />
          {deltaSign}
          {Math.round(metric.deltaPercent)}%
        </Badge>
      </div>

      <div className="space-y-1.5">
        <div className="space-y-0.5">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-foreground">Cliente</span>
            <span className={cn('font-bold tabular-nums', styles.text)}>{formatValue(metric)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full transition-all', styles.bar)}
              style={{ width: `${clientPct}%` }}
            />
          </div>
        </div>
        <div className="space-y-0.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Média do setor</span>
            <span className="tabular-nums text-muted-foreground">{formatIndustry(metric)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-muted-foreground/40 transition-all"
              style={{ width: `${industryPct}%` }}
            />
          </div>
        </div>
      </div>

      <p className={cn('text-[10px] font-medium', styles.text)}>{styles.label}</p>
    </div>
  );
}

/** Card especial: Share-of-Wallet com gauge e gap em R$. */
function ShareOfWalletCard({
  clientLtv,
  industryAvgLtv,
}: {
  clientLtv: number;
  industryAvgLtv: number;
}) {
  const [open, setOpen] = useState(false);
  // Heurística: cliente / (cliente + 1.5 × média setor) — capped 5..95%
  const denom = clientLtv + industryAvgLtv * 1.5;
  const rawShare = denom > 0 ? clientLtv / denom : 0;
  const share = Math.max(0.05, Math.min(0.95, rawShare));
  const sharePct = Math.round(share * 100);
  // Gap: receita potencial não capturada = 1.5 × setor (top tier) − cliente atual
  const potentialCap = industryAvgLtv * 1.5;
  const gap = Math.max(0, potentialCap - clientLtv);

  const tone =
    sharePct >= 50
      ? {
          text: 'text-success',
          bar: 'bg-success',
          bg: 'bg-success/10',
          label: 'Carteira dominante',
        }
      : sharePct >= 25
        ? {
            text: 'text-warning',
            bar: 'bg-warning',
            bg: 'bg-warning/10',
            label: 'Espaço para crescer',
          }
        : {
            text: 'text-destructive',
            bar: 'bg-destructive',
            bg: 'bg-destructive/10',
            label: 'Baixa penetração',
          };

  return (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      className="space-y-2 rounded-lg border bg-card/50 p-3 text-left transition-all hover:border-primary/40 hover:shadow-sm"
      aria-expanded={open}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Wallet className="h-3 w-3" /> Share of wallet
        </span>
        <Badge variant="outline" className={cn('gap-1 border-0 text-[10px]', tone.bg, tone.text)}>
          {sharePct}%
        </Badge>
      </div>
      <div className={cn('font-display text-2xl font-bold tabular-nums', tone.text)}>
        {sharePct}%
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', tone.bar)}
          style={{ width: `${sharePct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">Gap não capturado</span>
        <span className="font-bold text-foreground">{formatCurrency(gap)}</span>
      </div>
      <p className={cn('text-[10px] font-medium', tone.text)}>{tone.label}</p>
      {open && (
        <p className="border-t pt-1 text-[10px] leading-relaxed text-muted-foreground">
          Estimativa baseada no LTV do cliente vs LTV potencial do ramo (1.5× a média). Gap
          representa quanto este cliente ainda pode crescer dentro do seu setor.
        </p>
      )}
    </button>
  );
}

export function ClientVsIndustryComparison({ clientId, ramoAtividade }: Props) {
  const { isLoading, hasEnoughSample, sampleSize, daysWindow, metrics, insight } =
    useClientVsIndustry(clientId, ramoAtividade);

  if (!ramoAtividade) return null;
  if (isLoading) return <ComparisonSkeleton />;

  if (!hasEnoughSample) {
    return (
      <Card className="border-[1.5px] border-dashed">
        <CardContent className="flex items-start gap-3 p-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
            <Info className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h3 className="font-display text-sm font-semibold">Comparativo Cliente × Setor</h3>
            <p className="text-xs text-muted-foreground">
              Amostra do ramo <span className="font-medium">{ramoAtividade}</span> ainda
              insuficiente para gerar benchmarking. Mínimo de 3 empresas com orçamentos nos últimos{' '}
              {daysWindow} dias.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const ltvMetric = metrics.find((m) => m.label === 'LTV');

  return (
    <Card className="border-[1.5px]">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-success to-success/70 shadow-md shadow-success/20">
              <Scale className="h-4 w-4 text-success-foreground" />
            </div>
            <div>
              <CardTitle className="font-display text-base">Cliente × Setor</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Benchmark contra {sampleSize} empresa{sampleSize !== 1 ? 's' : ''} de{' '}
                <span className="font-medium">{ramoAtividade}</span> · últimos {daysWindow} dias
              </p>
            </div>
          </div>
          <Badge variant="outline" className="border-0 bg-success/10 text-[10px] text-success">
            Dados reais
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((m) => (
            <MetricRow key={m.label} metric={m} />
          ))}
          {ltvMetric && (
            <ShareOfWalletCard
              clientLtv={ltvMetric.clientValue}
              industryAvgLtv={ltvMetric.industryAvg}
            />
          )}
        </div>

        {insight && (
          <div className="flex items-start gap-2.5 rounded-lg border border-primary/10 bg-primary/5 p-3">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-xs leading-relaxed text-foreground">{insight}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
