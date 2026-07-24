import { memo, useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Activity, TrendingUp, TrendingDown, Minus, Zap, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SPARKLINE_WINDOW_DAYS,
  useSparklineData,
  useSparklineDataByVariant,
} from '@/hooks/intelligence/useSparklineSales';

interface ProductSales90dButtonProps {
  productId: string;
  /** Quando informado, exibe vendas APENAS dessa variante (cor/SKU). */
  variantId?: string | null;
  /** Rótulo da variante ativa (ex.: "Azul"). */
  variantLabel?: string | null;
  className?: string;
}

const nf = new Intl.NumberFormat('pt-BR');

export const ProductSales90dButton = memo(
  ({ productId, variantId, variantLabel, className }: ProductSales90dButtonProps) => {
    // Padrão: mostrar TOTAL do produto (todas as variantes), mesmo quando há variante selecionada.
    // Usuário pode optar por ver apenas a variante via toggle dentro do popover.
    const [scope, setScope] = useState<'product' | 'variant'>('product');
    const productData = useSparklineData(productId);
    const variantData = useSparklineDataByVariant(variantId);
    const canScopeVariant = !!variantId && !!variantData;
    const isVariantScope = scope === 'variant' && canScopeVariant;
    const data = isVariantScope ? variantData : productData;

    const summary = useMemo(() => {
      const pts = data?.dailyQty ?? [];
      const mid = Math.floor(pts.length / 2);
      const firstHalf = pts.slice(0, mid);
      const secondHalf = pts.slice(mid);
      const firstHalfTotal = firstHalf.reduce((a, b) => a + b, 0);
      const secondHalfTotal = secondHalf.reduce((a, b) => a + b, 0);
      const firstAvg = firstHalfTotal / (firstHalf.length || 1);
      const secondAvg = secondHalfTotal / (secondHalf.length || 1);
      const trend = firstAvg > 0 ? (secondAvg / firstAvg - 1) * 100 : 0;
      const periodChange =
        firstHalfTotal > 0 ? ((secondHalfTotal - firstHalfTotal) / firstHalfTotal) * 100 : 0;
      const totalSales = data?.totalQty ?? 0;
      const dailyAvg = totalSales / (pts.length || 1);
      const peakDay = pts.length ? Math.max(...pts) : 0;
      const activeDays = pts.filter((v) => v > 0).length;
      return {
        totalSales,
        availableStock: data?.availableStock ?? 0,
        dailyAvg,
        peakDay,
        activeDays,
        firstHalfTotal,
        secondHalfTotal,
        periodChange,
        trend,
      };
    }, [data]);

    // Sempre renderiza o botão (mesmo com 0 vendas no período)

    const TrendIcon =
      summary.periodChange > 2 ? TrendingUp : summary.periodChange < -2 ? TrendingDown : Minus;
    const trendTone =
      summary.periodChange > 0
        ? 'text-success'
        : summary.periodChange < 0
          ? 'text-warning'
          : 'text-muted-foreground';

    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            data-testid="product-sales-90d-button"
            className={cn(
              'group/sales90d flex w-full items-center justify-between gap-2 rounded-md border border-border/40 bg-muted/30 px-2 py-1.5 text-left transition-colors hover:border-border hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              className,
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Vendas {SPARKLINE_WINDOW_DAYS}d
                {isVariantScope && variantLabel ? (
                  <span className="ml-1 normal-case tracking-normal text-foreground/70">
                    · {variantLabel}
                  </span>
                ) : null}
              </span>
            </span>
            <span className="text-xs font-bold tabular-nums text-foreground">
              {nf.format(summary.totalSales)} un
            </span>
          </button>
        </PopoverTrigger>

        <PopoverContent
          side="top"
          align="center"
          className="w-[260px] overflow-hidden p-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-border/40 bg-gradient-to-r from-muted/80 to-transparent px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Activity className="h-3.5 w-3.5" />
                {isVariantScope
                  ? `Variante${variantLabel ? ` · ${variantLabel}` : ''}`
                  : `Produto · ${SPARKLINE_WINDOW_DAYS} dias`}
              </span>
              <span className="text-sm font-bold tabular-nums text-foreground">
                {nf.format(summary.totalSales)} un
              </span>
            </div>

            {canScopeVariant ? (
              <div className="mt-2 flex items-center gap-1 rounded-md bg-muted/60 p-0.5">
                <button
                  type="button"
                  onClick={() => setScope('product')}
                  className={cn(
                    'flex-1 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors',
                    scope === 'product'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  Todas
                </button>
                <button
                  type="button"
                  onClick={() => setScope('variant')}
                  className={cn(
                    'flex-1 truncate rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors',
                    scope === 'variant'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  title={variantLabel ?? 'Variante'}
                >
                  {variantLabel ?? 'Variante'}
                </button>
                {scope === 'variant' ? (
                  <button
                    type="button"
                    onClick={() => setScope('product')}
                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                    title="Resetar para todas as variantes"
                    aria-label="Resetar para todas as variantes"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-2 px-3 py-2.5">
            <Metric
              label={`Saídas ${SPARKLINE_WINDOW_DAYS}d`}
              value={`${nf.format(summary.totalSales)} un`}
            />
            <Metric label="Disponível" value={`${nf.format(summary.availableStock)} un`} />
            <Metric label="Média/dia" value={`${nf.format(Math.round(summary.dailyAvg))} un`} />
            <Metric label="Pico" value={`${nf.format(summary.peakDay)} un`} highlight />
          </div>

          <div className="border-t border-border/40 bg-muted/30 px-3 py-2">
            <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <span className="opacity-70">1ª vs 2ª metade</span>
              <span className={cn('flex items-center gap-1 font-bold', trendTone)}>
                <TrendIcon className="h-3.5 w-3.5" />
                {summary.periodChange > 0 ? '+' : ''}
                {summary.periodChange.toFixed(0)}%
              </span>
            </div>
            <div className="mt-1.5 flex gap-1.5">
              <HalfBar
                value={summary.firstHalfTotal}
                max={Math.max(summary.firstHalfTotal, summary.secondHalfTotal)}
                muted
              />
              <HalfBar
                value={summary.secondHalfTotal}
                max={Math.max(summary.firstHalfTotal, summary.secondHalfTotal)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border/40 px-3 py-1.5">
            <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <Zap className="h-3 w-3 text-warning" />
              {summary.activeDays}/{SPARKLINE_WINDOW_DAYS} dias ativos
            </span>
          </div>
        </PopoverContent>
      </Popover>
    );
  },
);

function Metric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          'text-sm font-semibold tabular-nums',
          highlight ? 'text-warning' : 'text-foreground',
        )}
      >
        {value}
      </span>
    </div>
  );
}

function HalfBar({ value, max, muted }: { value: number; max: number; muted?: boolean }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex-1">
      <div className="h-1.5 overflow-hidden rounded-full bg-muted-foreground/15">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            muted ? 'bg-muted-foreground/40' : 'bg-success',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground/70">
        {nf.format(value)} un
      </span>
    </div>
  );
}
