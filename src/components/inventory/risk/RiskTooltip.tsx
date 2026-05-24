import { forwardRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { safeNumber } from '@/lib/stock-chart-utils';

interface RiskChartDataPoint {
  fullDate?: string;
  stockClose?: number | null;
  depleted?: number | null;
  restocked?: number | null;
  restockDetected?: boolean;
}

// #11 fix: shows fallback when zero-activity day
// forwardRef required because Recharts passes refs to custom tooltip components
export const RiskTooltip = forwardRef<
  HTMLDivElement,
  { active?: boolean; payload?: { payload: RiskChartDataPoint }[] }
>(function RiskTooltip({ active, payload }, ref) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  const depleted = safeNumber(data.depleted);
  const restocked = safeNumber(data.restocked);
  const hasActivity = (depleted !== null && depleted > 0) || (restocked !== null && restocked > 0);

  return (
    <div
      ref={ref}
      className="min-w-[150px] rounded-lg border border-border bg-popover p-2.5 shadow-lg"
    >
      <p className="text-[10px] font-medium text-foreground">{data.fullDate}</p>
      <div className="mt-1.5 space-y-1">
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">Estoque:</span>
          <span className="font-semibold">
            {/* eslint-disable-next-line eqeqeq */}
            {data.stockClose != null ? data.stockClose.toLocaleString('pt-BR') : '—'}
          </span>
        </div>
        {!hasActivity && (
          <p className="text-[9px] italic text-muted-foreground">Sem movimentação</p>
        )}
        {depleted !== null && depleted > 0 && (
          <div className="flex justify-between text-[10px]">
            <span className="text-destructive">Saída:</span>
            <span className="font-semibold text-destructive">-{depleted}</span>
          </div>
        )}
        {restocked !== null && restocked > 0 && (
          <div className="flex justify-between text-[10px]">
            <span className="text-primary">Reposição:</span>
            <span className="font-semibold text-primary">+{restocked}</span>
          </div>
        )}
        {data.restockDetected && (
          <Badge
            variant="outline"
            className="border-primary/30 bg-primary/10 px-1 py-0 text-[9px] text-primary"
          >
            🔄 Reabastecimento
          </Badge>
        )}
      </div>
    </div>
  );
});
