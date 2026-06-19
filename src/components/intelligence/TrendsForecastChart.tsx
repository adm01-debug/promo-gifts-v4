/**
 * TrendsForecastChart — gráfico de atividade com projeção 7d e detecção de anomalias.
 * Substitui o ActivityChart simples quando `enableForecast` está ligado.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { BarChart3, AlertCircle } from 'lucide-react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from 'recharts';
import { useMemo } from 'react';
import { projectForecast, detectAnomalies, type ForecastPoint } from '@/lib/forecast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: '12px',
};

interface TrendsForecastChartProps {
  dailyTrends:
    | Array<{ date: string; views: number; searches: number; dateLabel?: string }>
    | undefined;
  isLoading: boolean;
  showForecast: boolean;
  onToggleForecast: (v: boolean) => void;
  showCompare: boolean;
  onToggleCompare: (v: boolean) => void;
  previousTrends?: Array<{ date: string; views: number; searches: number }>;
}

export function TrendsForecastChart({
  dailyTrends,
  isLoading,
  showForecast,
  onToggleForecast,
  showCompare,
  onToggleCompare,
  previousTrends,
}: TrendsForecastChartProps) {
  const chartData = useMemo(() => {
    if (!dailyTrends?.length) return [];
    const viewsSeries = dailyTrends.map((d) => ({ date: d.date, value: d.views }));

    const projected = showForecast
      ? projectForecast(viewsSeries, 7)
      : viewsSeries.map((s): ForecastPoint => ({ ...s, isForecast: false }));

    const anomalies = detectAnomalies(dailyTrends.map((d) => d.views));

    const prevByIndex = new Map<number, number>();
    if (showCompare && previousTrends?.length) {
      previousTrends.forEach((p, i) => prevByIndex.set(i, p.views));
    }

    return projected.map((p, i) => {
      const real = i < dailyTrends.length ? dailyTrends[i] : null;
      return {
        date: p.date,
        dateLabel: format(new Date(p.date), 'dd/MM', { locale: ptBR }),
        views: p.isForecast ? null : (real?.views ?? null),
        searches: p.isForecast ? null : (real?.searches ?? null),
        forecast: p.isForecast ? p.value : null,
        forecastUpper: p.isForecast ? p.upper : null,
        forecastLower: p.isForecast ? p.lower : null,
        previousViews: !p.isForecast ? (prevByIndex.get(i) ?? null) : null,
        isAnomaly: !p.isForecast && i < anomalies.length ? anomalies[i] : false,
        anomalyValue: !p.isForecast && i < anomalies.length && anomalies[i] ? real?.views : null,
      };
    });
  }, [dailyTrends, showForecast, showCompare, previousTrends]);

  const anomalyCount = chartData.filter((d) => d.isAnomaly).length;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Atividade ao Longo do Tempo
            {anomalyCount > 0 && (
              <Badge
                variant="outline"
                className="ml-2 border-warning/30 bg-warning/10 text-[10px] text-warning"
              >
                <AlertCircle className="mr-1 h-3 w-3" />
                {anomalyCount} {anomalyCount === 1 ? 'pico' : 'picos'} detectado
                {anomalyCount === 1 ? '' : 's'}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Visualizações e buscas {showForecast && '+ projeção 7d'}{' '}
            {showCompare && '+ comparação vs período anterior'}
          </CardDescription>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <Switch id="cmp" checked={showCompare} onCheckedChange={onToggleCompare} />
            <Label htmlFor="cmp" className="cursor-pointer">
              vs anterior
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="fc" checked={showForecast} onCheckedChange={onToggleForecast} />
            <Label htmlFor="fc" className="cursor-pointer">
              previsão 7d
            </Label>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[320px] w-full" />
        ) : chartData.length === 0 ? (
          <div className="flex h-[320px] items-center justify-center text-muted-foreground">
            <div className="text-center">
              <BarChart3 className="mx-auto mb-2 h-12 w-12 opacity-50" />
              <p>Nenhum dado disponível</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData}>
              <defs>
                <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="dateLabel" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip contentStyle={tooltipStyle} />
              {showCompare && (
                <Line
                  type="monotone"
                  dataKey="previousViews"
                  name="Período anterior"
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  dot={false}
                />
              )}
              <Area
                type="monotone"
                dataKey="views"
                name="Visualizações"
                stroke="hsl(var(--primary))"
                fill="url(#colorViews)"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="searches"
                name="Buscas"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                dot={false}
              />
              {showForecast && (
                <>
                  <Area
                    type="monotone"
                    dataKey="forecastUpper"
                    name="Confiança (sup)"
                    stroke="transparent"
                    fill="url(#colorForecast)"
                  />
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    name="Previsão"
                    stroke="hsl(var(--chart-3))"
                    strokeDasharray="6 4"
                    strokeWidth={2}
                    dot={{ r: 3, fill: 'hsl(var(--chart-3))' }}
                  />
                </>
              )}
              {chartData.map((d, i) =>
                d.isAnomaly ? (
                  <ReferenceDot
                    key={`a-${i}`}
                    x={d.dateLabel}
                    y={d.anomalyValue ?? 0}
                    r={6}
                    fill="hsl(var(--warning))"
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                  />
                ) : null,
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
