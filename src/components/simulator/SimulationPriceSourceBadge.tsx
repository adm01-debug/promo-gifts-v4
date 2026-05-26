/**
 * SimulationPriceSourceBadge
 *
 * Indicador persistente da origem do cálculo de uma `SimulationOption`.
 * - `rpc`: pílula sutil esmeralda com hora do cálculo oficial.
 * - `legacy-fallback`: bloco âmbar destacado avisando que o valor é uma
 *   estimativa porque o cálculo oficial não respondeu.
 *
 * Reusa o vocabulário visual do `PriceFreshnessBadge variant="pdp"`
 * (amber/emerald + ícone) para manter coerência com "preço pode estar
 * defasado".
 */
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { SimulationOption } from '@/types/simulation';

export interface SimulationPriceSourceBadgeProps {
  priceSource: SimulationOption['priceSource'];
  fallbackReason?: string;
  calculatedAt?: string;
  className?: string;
  /** Quando true, mostra a pílula `rpc` mesmo em layouts compactos. */
  alwaysShowOfficial?: boolean;
}

function formatTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

export function SimulationPriceSourceBadge({
  priceSource,
  fallbackReason,
  calculatedAt,
  className,
  alwaysShowOfficial = false,
}: SimulationPriceSourceBadgeProps) {
  if (priceSource === 'rpc') {
    if (!alwaysShowOfficial && !calculatedAt) return null;
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              role="status"
              aria-label={`Cálculo oficial atualizado às ${formatTime(calculatedAt)}`}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-2.5 py-1 font-display text-xs font-medium',
                'border-emerald-200 bg-emerald-50 text-emerald-700',
                'dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300',
                className,
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              Cálculo oficial · atualizado às {formatTime(calculatedAt)}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Preço calculado pelo servidor de gravação (fonte oficial).
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (priceSource === 'legacy-fallback') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              role="status"
              aria-label="Estimativa: cálculo oficial indisponível"
              className={cn(
                'flex items-start gap-2.5 rounded-xl border-[1.5px] px-3 py-2.5 text-left',
                'border-amber-300 bg-amber-100 text-amber-900',
                'dark:border-amber-500/60 dark:bg-amber-500/15 dark:text-amber-200',
                className,
              )}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div className="flex flex-col gap-0.5 text-xs leading-snug">
                <span className="font-display font-semibold">
                  Estimativa — cálculo oficial indisponível
                </span>
                <span>
                  Calculado às {formatTime(calculatedAt)} de {formatDate(calculatedAt)}
                </span>
                <span className="opacity-80">
                  {fallbackReason ? `${fallbackReason}. ` : ''}
                  Confirme o valor antes de fechar o orçamento.
                </span>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            O servidor de gravação não respondeu para esta combinação. O valor exibido é uma
            estimativa heurística baseada no catálogo. Reveja antes de enviar ao cliente.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // 'unavailable' ou undefined: nada a renderizar (a UI já trata via badge "indisponível")
  return null;
}
