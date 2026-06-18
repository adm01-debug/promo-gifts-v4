/**
 * EnrichedOrdersTimeline — substitui "Últimos pedidos" simples.
 * Vertical timeline com dots conectados, sparkline de evolução de ticket,
 * status semântico (aprovado/pendente/recusado quando disponível) e tendência inline.
 */
import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ShoppingBag, TrendingUp, TrendingDown, Minus, AlertTriangle, Layers } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LineChart, Line, ResponsiveContainer, Tooltip as RTooltip } from 'recharts';
import { cn } from '@/lib/utils';
import { useClientBI } from '@/hooks/bi/useClientBI';
import { resolveBICategory } from '@/lib/bi/categoryResolver';

interface Props {
  clientId: string;
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

export function EnrichedOrdersTimeline({ clientId }: Props) {
  const bi = useClientBI(clientId);

  const sparkData = useMemo(() => {
    return [...bi.recentOrders]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((o) => ({ name: o.id, value: o.total }));
  }, [bi.recentOrders]);

  const trend = useMemo(() => {
    if (sparkData.length < 2) return 'stable' as const;
    const first = sparkData[0].value;
    const last = sparkData[sparkData.length - 1].value;
    const delta = ((last - first) / first) * 100;
    if (delta > 15) return 'up' as const;
    if (delta < -15) return 'down' as const;
    return 'stable' as const;
  }, [sparkData]);

  if (bi.isLoading) {
    return (
      <Card className="border-[1.5px]">
        <CardContent className="space-y-3 p-5">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (bi.recentOrders.length === 0) {
    return null;
  }

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendStyles =
    trend === 'up'
      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
      : trend === 'down'
        ? 'text-red-600 dark:text-red-400 bg-red-500/10'
        : 'text-muted-foreground bg-muted';

  return (
    <Card className="border-[1.5px]">
      <CardContent className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <ShoppingBag className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-display text-sm font-semibold">Linha do tempo de pedidos</h3>
              <p className="text-xs text-muted-foreground">
                Últimos {bi.recentOrders.length} fechamentos · evolução de ticket
              </p>
            </div>
          </div>
          <Badge variant="outline" className={cn('gap-1 border-0 text-[10px]', trendStyles)}>
            <TrendIcon className="h-3 w-3" />
            {trend === 'up' ? 'Em ascensão' : trend === 'down' ? 'Em queda' : 'Estável'}
          </Badge>
        </div>

        {/* Sparkline */}
        {sparkData.length >= 2 && (
          <div className="-mx-2 mb-4 h-16">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                  activeDot={{ r: 5 }}
                />
                <RTooltip
                  contentStyle={{
                    background: '#1a1a1a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px',
                    fontSize: '6px',
                    fontWeight: 600,
                    padding: '4px 6px',
                    backdropFilter: 'blur(8px)',
                    color: '#fff',
                  }}
                  itemStyle={{ padding: 0 }}
                  labelStyle={{ display: 'none' }}
                  formatter={(v: number) => [fmtBRL(v), 'Total']}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Timeline vertical */}
        <div className="relative pl-6">
          <div className="absolute bottom-2 left-2 top-2 w-px bg-gradient-to-b from-primary/40 via-border to-transparent" />
          {bi.recentOrders.map((o, i) => {
            const prev = bi.recentOrders[i + 1];
            const deltaPct = prev?.total ? ((o.total - prev.total) / prev.total) * 100 : null;
            const deltaTone =
              deltaPct === null
                ? 'text-muted-foreground'
                : deltaPct > 5
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : deltaPct < -5
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-muted-foreground';

            return (
              <div
                key={o.id}
                className={cn('relative pb-4', i === bi.recentOrders.length - 1 && 'pb-0')}
              >
                <div
                  className={cn(
                    'absolute -left-[18px] top-1.5 h-3 w-3 rounded-full ring-4 ring-background',
                    i === 0 ? 'bg-primary' : 'bg-muted-foreground/40',
                  )}
                />
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{o.id}</span>
                      {(() => {
                        const cat = resolveBICategory(o.productPreview ?? '');
                        if (cat.slug === 'outros' && !o.productPreview) return null;
                        return (
                          <Badge
                            variant="outline"
                            className="h-4 gap-0.5 border-violet-500/30 bg-violet-500/10 text-[9px] text-violet-700 dark:text-violet-300"
                            title={`Categoria dominante: ${cat.label}`}
                          >
                            <Layers className="h-2.5 w-2.5" />
                            {cat.label}
                          </Badge>
                        );
                      })()}
                      {i === 0 && (
                        <Badge
                          variant="outline"
                          className="h-4 border-primary/30 text-[9px] text-primary"
                        >
                          Mais recente
                        </Badge>
                      )}
                      {o.isAnomaly && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="outline"
                                className="h-4 cursor-help gap-0.5 border-0 bg-warning/15 text-[9px] text-warning"
                              >
                                <AlertTriangle className="h-2.5 w-2.5" />
                                Atípico
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              Pedido {o.deviation > 0 ? 'acima' : 'abaixo'} do padrão histórico (
                              {o.deviation > 0 ? '+' : ''}
                              {o.deviation}σ).{' '}
                              {Math.abs(o.deviation) > 3
                                ? 'Desvio extremo — vale investigar contexto.'
                                : 'Vale entender o que motivou.'}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{o.productPreview}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold tabular-nums">{fmtBRL(o.total)}</div>
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-xs text-muted-foreground">{fmtDate(o.date)}</span>
                      {deltaPct !== null && Math.abs(deltaPct) > 5 && (
                        <span className={cn('text-[10px] font-medium tabular-nums', deltaTone)}>
                          {deltaPct > 0 ? '+' : ''}
                          {Math.round(deltaPct)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
