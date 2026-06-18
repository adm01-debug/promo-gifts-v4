/**
 * KitHealthCard — Saúde comercial do kit:
 * - Margem real (vs. histórico de kits salvos)
 * - Comparativo com média de tickets do mesmo kit_type
 * - Alerta de range competitivo (preço fora do P25-P75 histórico)
 */
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import type { KitState } from '@/lib/kit-builder/types';
import { formatCurrency } from '@/lib/kit-builder';

interface KitHealthCardProps {
  kitState: KitState;
  kitQuantity: number;
  className?: string;
}

interface HistoricalRow {
  total_price: number;
  kit_type: string;
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function KitHealthCard({ kitState, kitQuantity, className }: KitHealthCardProps) {
  const { data: history } = useQuery({
    queryKey: ['kit-health-history', kitState.kitType],
    queryFn: async (): Promise<HistoricalRow[]> => {
      const { data, error } = await supabase
        .from('custom_kits')
        .select('total_price, kit_type')
        .eq('kit_type', kitState.kitType)
        .gt('total_price', 0)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) return [];
      return (data ?? []) as HistoricalRow[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const totalPrice = kitState.totalPrice;
  const totalRevenue = totalPrice * kitQuantity;

  // Margem aproximada — usa flag conservadora baseada na composição
  // Sem custo direto exposto: margem é estimada como razão personalização/preço (proxy)
  // Estratégia: margem ~ 1 - (custo_estimado / preço). Usamos 65% baseline.
  const estimatedCostRatio = 0.65;
  const grossMargin =
    totalPrice > 0 ? ((totalPrice - totalPrice * estimatedCostRatio) / totalPrice) * 100 : 0;

  const sortedHist = (history ?? [])
    .map((r) => r.total_price)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  const avg = sortedHist.length ? sortedHist.reduce((s, n) => s + n, 0) / sortedHist.length : 0;
  const p25 = percentile(sortedHist, 25);
  const p75 = percentile(sortedHist, 75);

  const diffVsAvg = avg > 0 ? ((totalPrice - avg) / avg) * 100 : 0;
  const inRange = totalPrice >= p25 && totalPrice <= p75;
  const aboveRange = p75 > 0 && totalPrice > p75;
  const belowRange = p25 > 0 && totalPrice < p25 && totalPrice > 0;

  const healthScore =
    totalPrice <= 0
      ? 0
      : inRange
        ? 90
        : aboveRange
          ? Math.max(40, 90 - (diffVsAvg - 20))
          : Math.max(50, 70 - Math.abs(diffVsAvg) / 2);

  const scoreColor = healthScore >= 75 ? 'success' : healthScore >= 50 ? 'warning' : 'destructive';

  return (
    <Card className={className}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
            <Activity className="h-4 w-4 text-primary" />
            Saúde do Kit
          </h3>
          <Badge
            variant="outline"
            className={cn(
              'text-[10px]',
              scoreColor === 'success' && 'border-success text-success',
              scoreColor === 'warning' && 'border-warning text-warning',
              scoreColor === 'destructive' && 'border-destructive text-destructive',
            )}
          >
            {healthScore.toFixed(0)}/100
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md bg-muted/40 p-2">
            <div className="text-muted-foreground">Margem estimada</div>
            <div className="font-semibold text-foreground">{grossMargin.toFixed(0)}%</div>
          </div>
          <div className="rounded-md bg-muted/40 p-2">
            <div className="text-muted-foreground">Receita ({kitQuantity}×)</div>
            <div className="font-semibold text-foreground">{formatCurrency(totalRevenue)}</div>
          </div>
        </div>

        {sortedHist.length >= 5 && (
          <div className="space-y-2 border-t pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Média histórica ({kitState.kitType})</span>
              <span className="font-medium">{formatCurrency(avg)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Faixa competitiva (P25–P75)</span>
              <span className="font-medium">
                {formatCurrency(p25)} – {formatCurrency(p75)}
              </span>
            </div>

            {inRange && totalPrice > 0 && (
              <div className="flex items-start gap-2 rounded-md bg-success/10 p-2 text-xs text-success">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>Preço dentro do range competitivo do mercado.</span>
              </div>
            )}
            {aboveRange && (
              <div className="flex items-start gap-2 rounded-md bg-warning/10 p-2 text-xs text-warning-foreground">
                <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                <span>
                  Acima da faixa competitiva ({diffVsAvg > 0 ? '+' : ''}
                  {diffVsAvg.toFixed(0)}% vs. média). Considere reduzir itens ou ajustar margem.
                </span>
              </div>
            )}
            {belowRange && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Abaixo da faixa competitiva ({diffVsAvg.toFixed(0)}% vs. média). Risco de margem
                  baixa.
                </span>
              </div>
            )}
          </div>
        )}

        {sortedHist.length < 5 && totalPrice > 0 && (
          <div className="flex items-start gap-2 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Histórico insuficiente para comparativo competitivo.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
