/**
 * Mini-cards comparing velocity/stock across suppliers.
 */
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, Package } from "lucide-react";
import type { StockVelocity } from "@/hooks/intelligence/useStockHistory";

interface SupplierComparisonCardsProps {
  velocities: StockVelocity[];
  supplierNames: Map<string, string>;
}

const SUPPLIER_COLORS = [
  'border-l-primary',
  'border-l-destructive',
  'border-l-emerald-500',
  'border-l-amber-500',
  'border-l-violet-500',
  'border-l-cyan-500',
];

export function SupplierComparisonCards({ velocities, supplierNames }: SupplierComparisonCardsProps) {
  if (velocities.length <= 1) return null;

  // Sort by velocity desc
  const sorted = [...velocities].sort(
    (a, b) => b.avg_daily_depletion_7d - a.avg_daily_depletion_7d
  );

  const bestVelocity = sorted[0]?.avg_daily_depletion_7d ?? 0;

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        Comparativo por Fornecedor
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {sorted.map((v, idx) => {
          const name = supplierNames.get(v.supplier_id) ?? `Fornecedor ${v.supplier_id.slice(0, 6)}`;
          const trend = v.velocity_trend;
          const isBest = idx === 0 && sorted.length > 1;
          const _sharePercent = bestVelocity > 0
            ? Math.round((v.avg_daily_depletion_7d / bestVelocity) * 100)
            : 0;

          return (
            <div
              key={v.variant_supplier_source_id || v.supplier_id}
              className={cn(
                "flex flex-col gap-1 p-2 rounded-md bg-muted/40 border-l-2",
                SUPPLIER_COLORS[idx % SUPPLIER_COLORS.length]
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-medium truncate max-w-[120px]" title={name}>
                  {name}
                </span>
                {isBest && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 bg-primary/10 text-primary border-primary/30">
                    Maior saída
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                <div>
                  <p className="text-muted-foreground">Saída/dia</p>
                  <p className="font-bold text-foreground">{v.avg_daily_depletion_7d.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Estoque</p>
                  <p className="font-bold text-foreground">{v.current_stock.toLocaleString('pt-BR')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tendência</p>
                  <p className={cn(
                    "font-bold flex items-center gap-0.5",
                    trend > 1 ? 'text-primary' : trend < 0.8 ? 'text-destructive' : 'text-muted-foreground'
                  )}>
                    {trend > 1 ? <TrendingUp className="h-2.5 w-2.5" /> :
                     trend < 0.8 ? <TrendingDown className="h-2.5 w-2.5" /> :
                     <Minus className="h-2.5 w-2.5" />}
                    {((trend - 1) * 100).toFixed(0)}%
                  </p>
                </div>
              </div>

              {v.days_to_stockout !== null && v.days_to_stockout < 30 && (
                <p className={cn(
                  "text-[9px] flex items-center gap-1",
                  v.days_to_stockout < 7 ? 'text-destructive' : 'text-warning'
                )}>
                  <Package className="h-2.5 w-2.5" />
                  {v.days_to_stockout < 7 ? '⚠️' : '⏳'} Esgota em ~{v.days_to_stockout}d
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
