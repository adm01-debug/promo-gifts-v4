/**
 * QuotesFunnelChart — visualização horizontal do funil de orçamentos
 * com taxas de conversão entre etapas e KPI de ciclo médio.
 */
import { TrendingDown, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { QuoteFunnelData } from '@/hooks/quotes';
import { cn } from '@/lib/utils';

interface QuotesFunnelChartProps {
  data: QuoteFunnelData;
}

export function QuotesFunnelChart({ data }: QuotesFunnelChartProps) {
  const { stages, avgCycleDays } = data;
  const max = Math.max(1, ...stages.map((s) => s.count));

  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Funil de vendas
            </p>
            <p className="text-[10px] text-muted-foreground">Conversão entre etapas</p>
          </div>
          {avgCycleDays !== null && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 rounded-md bg-info/10 px-2 py-1 text-info">
                  <Clock className="h-3 w-3" />
                  <span className="text-xs font-semibold">{avgCycleDays.toFixed(1)}d</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Ciclo médio: criação → aprovação</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="space-y-1.5">
          {stages.map((stage, idx) => {
            const pct = (stage.count / max) * 100;
            return (
              <div key={stage.id} className="space-y-0.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-foreground">{stage.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold tabular-nums text-foreground">{stage.count}</span>
                    {idx > 0 && stage.rateFromPrev !== null && (
                      <span
                        className={cn(
                          'flex items-center gap-0.5 tabular-nums',
                          stage.rateFromPrev >= 50
                            ? 'text-success'
                            : stage.rateFromPrev >= 20
                              ? 'text-warning'
                              : 'text-destructive',
                        )}
                      >
                        {stage.rateFromPrev < 50 && <TrendingDown className="h-2.5 w-2.5" />}
                        {stage.rateFromPrev.toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
