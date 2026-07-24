/**
 * RuptureSparkline — Mini gráfico de barras de depleção 7d inline.
 * Onda 2 / Melhoria 10. Usa SVG puro (sem dependência extra).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type AnyRpc = (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: Error | null }>;

interface SparkRow {
  day: string;
  units_depleted: number;
  stock_close: number;
}

interface Props {
  variantId: string;
  days?: number;
  width?: number;
  height?: number;
}

export function RuptureSparkline({ variantId, days = 7, width = 56, height = 24 }: Props) {
  const { data = [] } = useQuery({
    queryKey: ['sparkline', variantId, days],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<SparkRow[]> => {
      const { data: rpcData, error } = await (supabase.rpc as unknown as AnyRpc)(
        'fn_variant_sparkline',
        { p_variant_id: variantId, p_days: days },
      );
      if (error) return [];
      return (rpcData as SparkRow[]) ?? [];
    },
  });

  if (data.length === 0) return <span className="text-xs text-muted-foreground">—</span>;

  const maxVal = Math.max(...data.map((d) => d.units_depleted), 1);
  const barW = Math.floor(width / data.length) - 1;
  const totalDepleted = data.reduce((s, d) => s + d.units_depleted, 0);

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <svg
            width={width}
            height={height}
            aria-label={`Depleção ${days}d: ${totalDepleted} un`}
            className="cursor-help"
          >
            {data.map((d, i) => {
              const h = Math.ceil((d.units_depleted / maxVal) * (height - 2));
              const x = i * (barW + 1);
              return (
                <rect
                  key={d.day}
                  x={x}
                  y={height - h}
                  width={barW}
                  height={h}
                  className={d.units_depleted > 0 ? 'fill-primary/70' : 'fill-muted-foreground/20'}
                  rx="1"
                />
              );
            })}
          </svg>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <div className="font-semibold">
            {totalDepleted.toLocaleString('pt-BR')} un em {days}d
          </div>
          {data
            .filter((d) => d.units_depleted > 0)
            .slice(-3)
            .map((d) => (
              <div key={d.day}>
                {d.day}: {d.units_depleted.toLocaleString('pt-BR')} un
              </div>
            ))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
