import { TrendingDown, TrendingUp } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface Props {
  /** Diferença % entre preço atual e price_at_save (negativo = queda). */
  priceDiffPct: number | null;
  priceAtSave: number | null;
  currentPrice: number | null | undefined;
  savedAt?: string;
  /** Threshold em % a partir do qual o badge aparece (default 2). */
  threshold?: number;
  size?: 'md' | 'sm';
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export function PriceDropBadge({
  priceDiffPct,
  priceAtSave,
  currentPrice,
  savedAt,
  threshold = 2,
  size = 'sm',
}: Props) {
  if (priceDiffPct === null || priceAtSave === null) return null;
  if (Math.abs(priceDiffPct) < threshold) return null;

  const isDrop = priceDiffPct < 0;
  const Icon = isDrop ? TrendingDown : TrendingUp;
  const label = `${isDrop ? '−' : '+'}${Math.abs(priceDiffPct).toFixed(0)}%`;

  const savedAtLabel = savedAt
    ? new Date(savedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    : null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-semibold tabular-nums shadow-sm backdrop-blur-sm',
              size === 'sm' ? 'text-[10px]' : 'text-xs',
              isDrop
                ? 'border-success/30 bg-success/15 text-success'
                : 'border-border bg-muted/80 text-muted-foreground',
            )}
            aria-label={isDrop ? `Preço caiu ${label}` : `Preço subiu ${label}`}
          >
            <Icon className={cn(size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
            <span>{label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <div className="space-y-0.5">
            <div>
              Salvo a <strong>{fmt(priceAtSave)}</strong>
              {savedAtLabel && <> em {savedAtLabel}</>}
            </div>
            {currentPrice ? (
              <div>
                Hoje: <strong>{fmt(currentPrice)}</strong>
              </div>
            ) : null}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
