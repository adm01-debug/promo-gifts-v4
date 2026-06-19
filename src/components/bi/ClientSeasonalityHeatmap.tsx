/**
 * ClientSeasonalityHeatmap — Zona 6 do BI.
 * Sprint 3: linha de forecast (regressão linear simples sobre 12 meses)
 * + card "Próxima janela ideal de campanha" com CTA.
 */
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar, Sparkles, TrendingUp, Info, Target } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ReferenceLine,
} from 'recharts';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import { HeatmapSkeleton } from '@/components/bi/BISkeletons';
import {
  useClientSeasonality,
  SEASONALITY_MONTH_LABELS,
  SEASONALITY_MONTH_LABELS_FULL,
} from '@/hooks/bi/useClientSeasonality';
import { linearRegression } from '@/lib/forecast';

interface Props {
  clientId: string;
  ramoAtividade: string | null;
}

function intensityToBg(intensity: number): string {
  if (intensity <= 0) return 'bg-muted/40';
  if (intensity < 0.15) return 'bg-violet-50 dark:bg-violet-950/40';
  if (intensity < 0.3) return 'bg-violet-100 dark:bg-violet-900/50';
  if (intensity < 0.45) return 'bg-violet-200 dark:bg-violet-800/60';
  if (intensity < 0.6) return 'bg-violet-300 dark:bg-violet-700/70';
  if (intensity < 0.75) return 'bg-violet-400 dark:bg-violet-600/80';
  if (intensity < 0.9) return 'bg-violet-500 dark:bg-violet-500';
  return 'bg-violet-600 dark:bg-violet-400';
}
function intensityToText(intensity: number): string {
  return intensity >= 0.6 ? 'text-white' : 'text-foreground';
}

export function ClientSeasonalityHeatmap({ clientId, ramoAtividade }: Props) {
  const seasonality = useClientSeasonality(clientId, ramoAtividade);
  const currentMonth = new Date().getMonth() + 1;

  // Forecast: regressão linear sobre 12 meses do cliente, projetar 6 meses
  const forecastSeries = useMemo(() => {
    if (!seasonality.client || seasonality.client.length < 6) return [];
    const values = seasonality.client.map((c) => c.quotesCount);
    const { slope, intercept } = linearRegression(values);
    const today = new Date();
    const series: Array<{
      key: string;
      label: string;
      historical: number | null;
      forecast: number | null;
      isCurrent: boolean;
    }> = [];

    // 12 meses históricos (Jan→Dez do ciclo)
    seasonality.client.forEach((c) => {
      series.push({
        key: `h-${c.month}`,
        label: c.monthLabel,
        historical: c.quotesCount,
        forecast: null,
        isCurrent: c.month === currentMonth,
      });
    });

    // 6 meses futuros projetados
    for (let i = 1; i <= 6; i++) {
      const next = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const idx = values.length + i - 1;
      const pred = Math.max(0, slope * idx + intercept);
      series.push({
        key: `f-${i}`,
        label: SEASONALITY_MONTH_LABELS[next.getMonth()],
        historical: null,
        forecast: Math.round(pred * 10) / 10,
        isCurrent: false,
      });
    }
    return series;
  }, [seasonality.client, currentMonth]);

  if (seasonality.isLoading) return <HeatmapSkeleton />;

  const nextPeakName = seasonality.nextPeakMonth
    ? SEASONALITY_MONTH_LABELS_FULL[seasonality.nextPeakMonth - 1]
    : null;

  return (
    <Card className="border-[1.5px]">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/40">
              <Calendar className="h-4 w-4 text-violet-600 dark:text-violet-300" />
            </div>
            <div>
              <CardTitle className="font-display text-base">Sazonalidade Cliente × Setor</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Quando o cliente compra ao longo do ano · janela de {seasonality.windowMonths} meses
              </p>
            </div>
          </div>
          <Badge
            variant={seasonality.isMock ? 'secondary' : 'outline'}
            className={cn('text-[10px]', !seasonality.isMock && 'border-success/50 text-success')}
          >
            {seasonality.isMock
              ? 'Dados simulados'
              : `Dados reais · ${seasonality.monthsCovered} mês${seasonality.monthsCovered === 1 ? '' : 'es'}`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <TooltipProvider>
          {/* Heatmap */}
          <div className="overflow-x-auto">
            <div className="min-w-[640px] space-y-2">
              <div className="grid grid-cols-[80px_repeat(12,1fr)] items-center gap-1">
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground" />
                {seasonality.client.map((c) => (
                  <div
                    key={`h-${c.month}`}
                    className={cn(
                      'py-1 text-center text-[10px] font-medium uppercase tracking-wide',
                      c.month === currentMonth
                        ? 'font-bold text-violet-600 dark:text-violet-300'
                        : 'text-muted-foreground',
                    )}
                  >
                    {c.monthLabel}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-[80px_repeat(12,1fr)] items-center gap-1">
                <div className="pr-2 text-xs font-semibold text-foreground">Cliente</div>
                {seasonality.client.map((c) => (
                  <Tooltip key={`c-${c.month}`}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          'flex h-12 cursor-help items-center justify-center rounded-md text-xs font-bold transition-all hover:scale-110',
                          intensityToBg(c.intensity),
                          intensityToText(c.intensity),
                          c.month === currentMonth &&
                            'ring-2 ring-violet-600 ring-offset-1 ring-offset-background dark:ring-violet-400',
                        )}
                      >
                        {c.quotesCount > 0 ? c.quotesCount : '—'}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <div className="font-semibold">
                        {SEASONALITY_MONTH_LABELS_FULL[c.month - 1]}
                      </div>
                      {c.quotesCount > 0 ? (
                        <>
                          <div>
                            {c.quotesCount} pedido{c.quotesCount === 1 ? '' : 's'} ·{' '}
                            {formatCurrency(c.totalRevenue)}
                          </div>
                          <div className="text-muted-foreground">
                            Ticket médio {formatCurrency(c.avgTicket)} · {c.sharePercent.toFixed(0)}
                            % do ano
                          </div>
                        </>
                      ) : (
                        <div className="text-muted-foreground">Sem registros</div>
                      )}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>

              <div className="grid grid-cols-[80px_repeat(12,1fr)] items-center gap-1">
                <div className="pr-2 text-xs font-semibold text-muted-foreground">Setor</div>
                {seasonality.industry.map((c) => (
                  <Tooltip key={`i-${c.month}`}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          'flex h-12 cursor-help items-center justify-center rounded-md text-xs font-bold opacity-90 transition-all hover:scale-110',
                          intensityToBg(c.intensity),
                          intensityToText(c.intensity),
                          c.month === currentMonth &&
                            'ring-2 ring-violet-400 ring-offset-1 ring-offset-background dark:ring-violet-500',
                        )}
                      >
                        {c.avgQuotesPerCompany > 0 ? c.avgQuotesPerCompany.toFixed(1) : '—'}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <div className="font-semibold">
                        {SEASONALITY_MONTH_LABELS_FULL[c.month - 1]} · Setor
                      </div>
                      {c.avgQuotesPerCompany > 0 ? (
                        <>
                          <div>{c.avgQuotesPerCompany.toFixed(1)} pedidos/empresa</div>
                          <div className="text-muted-foreground">
                            Receita média {formatCurrency(c.avgRevenuePerCompany)} ·{' '}
                            {c.sharePercent.toFixed(0)}% do ano
                          </div>
                        </>
                      ) : (
                        <div className="text-muted-foreground">Sem dados</div>
                      )}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-2 text-[10px] text-muted-foreground">
                <span>Menos</span>
                <div className="flex gap-0.5">
                  {[0.05, 0.2, 0.4, 0.55, 0.7, 0.85, 1].map((i) => (
                    <div key={i} className={cn('h-3 w-4 rounded-sm', intensityToBg(i))} />
                  ))}
                </div>
                <span>Mais</span>
                <span className="ml-3 inline-flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded-sm ring-2 ring-violet-600 ring-offset-1 ring-offset-background" />
                  Hoje
                </span>
              </div>
            </div>
          </div>
        </TooltipProvider>

        {/* Forecast preditivo */}
        {forecastSeries.length > 0 && (
          <div className="rounded-lg border bg-card p-3">
            <div className="mb-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-violet-600 dark:text-violet-300" />
              <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
                Projeção próximos 6 meses
              </span>
              <span className="text-[10px] text-muted-foreground">· regressão linear</span>
            </div>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={forecastSeries} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    className="text-muted-foreground"
                    allowDecimals={false}
                  />
                  <RTooltip
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <ReferenceLine
                    x={forecastSeries[11]?.label}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="2 2"
                    label={{ value: 'agora', fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="historical"
                    stroke="hsl(262 83% 58%)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Histórico"
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    stroke="hsl(262 83% 58%)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 3, strokeDasharray: '' }}
                    name="Projeção"
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Cards inferiores: Próximo pico + Próxima janela ideal */}
        <div className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-2">
          <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-800/50 dark:bg-violet-950/30">
            <div className="mb-1.5 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-violet-600 dark:text-violet-300" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                Próximo pico
              </span>
            </div>
            {seasonality.nextPeakMonth ? (
              <div>
                <div className="text-lg font-bold text-foreground">
                  {SEASONALITY_MONTH_LABELS_FULL[seasonality.nextPeakMonth - 1]}
                </div>
                <div className="text-xs text-muted-foreground">
                  {seasonality.daysToNextPeak === 0
                    ? 'Estamos no pico agora!'
                    : `em ${seasonality.daysToNextPeak} dia${seasonality.daysToNextPeak === 1 ? '' : 's'}`}
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                Sem padrão sazonal claro identificado.
              </div>
            )}
          </div>

          {/* Próxima janela ideal de campanha — CTA */}
          <div className="flex flex-col rounded-lg border border-success/40 bg-success/5 p-3">
            <div className="mb-1.5 flex items-center gap-2">
              <Target className="h-4 w-4 text-success" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-success">
                Próxima janela ideal
              </span>
            </div>
            {nextPeakName && seasonality.daysToNextPeak !== null ? (
              <>
                <div className="text-lg font-bold text-foreground">Campanha em {nextPeakName}</div>
                <div className="mb-2 text-xs text-muted-foreground">
                  {seasonality.daysToNextPeak <= 30
                    ? 'Aborde agora — a janela está abrindo.'
                    : `Planeje em ~${Math.max(1, seasonality.daysToNextPeak - 21)} dias para chegar a tempo.`}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-auto gap-1.5 self-start border-success/40 hover:bg-success/10"
                  onClick={() => {
                    // Cria evento .ics simples para download
                    const peakDate = new Date();
                    peakDate.setMonth((seasonality.nextPeakMonth ?? 1) - 1, 1);
                    if (peakDate < new Date()) peakDate.setFullYear(peakDate.getFullYear() + 1);
                    const followUp = new Date(peakDate);
                    followUp.setDate(followUp.getDate() - 21);
                    const dt = (d: Date) =>
                      `${d.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
                    const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:bi-${Date.now()}@promogifts\nDTSTAMP:${dt(new Date())}\nDTSTART:${dt(followUp)}\nDTEND:${dt(new Date(followUp.getTime() + 30 * 60000))}\nSUMMARY:Follow-up campanha sazonal\nDESCRIPTION:Janela ideal: ${nextPeakName}\nEND:VEVENT\nEND:VCALENDAR`;
                    const blob = new Blob([ics], { type: 'text/calendar' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `follow-up-${nextPeakName.toLowerCase()}.ics`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Agendar follow-up
                </Button>
              </>
            ) : (
              <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Info className="h-3 w-3" />
                Sem janela clara — colete mais histórico.
              </p>
            )}
          </div>
        </div>

        {/* Insight textual */}
        {seasonality.insight && (
          <div className="flex items-start gap-2 rounded-lg border bg-card p-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" />
            <p className="text-xs leading-relaxed text-foreground">{seasonality.insight}</p>
          </div>
        )}

        {/* Top 3 picos lado a lado */}
        {(seasonality.topClientMonths.length > 0 || seasonality.topIndustryMonths.length > 0) && (
          <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
            <div>
              <div className="mb-1 font-semibold text-foreground">Top 3 meses do cliente</div>
              <div className="flex flex-wrap gap-1.5">
                {seasonality.topClientMonths.length === 0 && (
                  <span className="text-muted-foreground">—</span>
                )}
                {seasonality.topClientMonths.map((c) => (
                  <Badge key={c.month} variant="secondary" className="text-[10px]">
                    {SEASONALITY_MONTH_LABELS_FULL[c.month - 1]} · {c.quotesCount}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 font-semibold text-muted-foreground">Top 3 meses do setor</div>
              <div className="flex flex-wrap gap-1.5">
                {seasonality.topIndustryMonths.length === 0 && (
                  <span className="text-muted-foreground">—</span>
                )}
                {seasonality.topIndustryMonths.map((c) => (
                  <Badge key={c.month} variant="outline" className="text-[10px]">
                    {SEASONALITY_MONTH_LABELS_FULL[c.month - 1]} ·{' '}
                    {c.avgQuotesPerCompany.toFixed(1)}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
