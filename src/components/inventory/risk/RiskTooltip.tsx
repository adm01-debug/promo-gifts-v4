import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface RiskChartDataPoint {
  fullDate?: string;
  stockClose?: number | null;
  depleted?: number | null;
  restocked?: number | null;
  restockDetected?: boolean;
}

export const RiskTooltip = forwardRef<
  HTMLDivElement,
  { active?: boolean; payload?: { payload: RiskChartDataPoint }[] }
>(function RiskTooltip({ active, payload }, ref) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div
      ref={ref}
      className="text-tooltip min-w-[160px] max-w-[240px] rounded-md border border-white/10 bg-black/90 p-3 text-white shadow-2xl backdrop-blur-md animate-in fade-in-0 zoom-in-95"
    >
      <div className="mb-2 border-b border-white/5 pb-1.5">
        <p className="text-tooltip-header">{data.fullDate}</p>
      </div>
      
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-white/50">Estoque Atual</span>
          <span className="font-bold tabular-nums">
            {data.stockClose != null ? data.stockClose.toLocaleString('pt-BR') : '—'}
          </span>
        </div>

        {(data.depleted || data.restocked) && (
          <div className="grid grid-cols-2 gap-2 border-t border-white/5 pt-1.5">
            {data.depleted !== null && data.depleted > 0 && (
              <div className="space-y-0.5">
                <span className="text-tooltip-header !text-destructive/80">Saídas</span>
                <p className="font-bold text-destructive tabular-nums">-{data.depleted}</p>
              </div>
            )}
            {data.restocked !== null && data.restocked > 0 && (
              <div className="space-y-0.5">
                <span className="text-tooltip-header !text-primary/80">Entradas</span>
                <p className="font-bold text-primary tabular-nums">+{data.restocked}</p>
              </div>
            )}
          </div>
        )}

        {data.restockDetected && (
          <div className="mt-1 flex items-center gap-1.5 rounded bg-primary/10 px-1 py-0.5 border border-primary/20">
            <div className="h-1 w-1 animate-pulse rounded-full bg-primary" />
            <span className="text-tooltip-header !text-primary !opacity-100">Reposição Detectada</span>
          </div>
        )}
      </div>
    </div>
  );
});
