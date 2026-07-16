/**
 * NegotiationMarkupCard — Estratégia de Negociação (uso interno)
 *
 * Permite ao vendedor inflar o subtotal apresentado ao cliente para criar
 * margem psicológica de desconto, mantendo o desconto REAL dentro da alçada.
 *
 * REGRAS:
 *  - 0–50% de markup
 *  - subtotal_apresentado = subtotal_real * (1 + markup/100)
 *  - desconto_real = desconto efetivo vs subtotal_real (validado pela alçada)
 *  - NUNCA aparece no PDF / quote pública / e-mail do cliente
 */
import { useState, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { EyeOff, BarChart3, Info, AlertTriangle, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';

interface Props {
  /** Markup atual em % (0–50) */
  value: number;
  onChange: (v: number) => void;
  /** Subtotal real (sem markup) — base para os cálculos */
  realSubtotal: number;
  /** % de desconto APARENTE que o cliente verá */
  apparentDiscountPercent: number;
  /** Desconto REAL calculado (já considera markup) */
  realDiscountPercent: number;
  /** Limite de desconto do vendedor; null = sem limite definido */
  maxDiscountPercent: number | null;
  className?: string;
  /**
   * Oculta o grid interno REAL/CLIENTE VÊ para que os cards possam ser
   * renderizados externamente via `<NegotiationPriceComparison />`.
   */
  hidePriceComparison?: boolean;
}

const MAX_MARKUP = 50;

interface PriceComparisonProps {
  realSubtotal: number;
  apparentDiscountPercent: number;
  realDiscountPercent: number;
  presentedSubtotal: number;
  isOverLimit: boolean;
  className?: string;
}

/**
 * Grid REAL (interno) + CLIENTE VÊ — extraído para permitir renderização
 * ao lado do card de Margem no `QuoteBuilderSummaryColumn` (mesma linha).
 */
export function NegotiationPriceComparison({
  realSubtotal,
  apparentDiscountPercent,
  realDiscountPercent,
  presentedSubtotal,
  isOverLimit,
  className,
}: PriceComparisonProps) {
  return (
    <div
      data-testid="negotiation-price-grid"
      className={cn('flex flex-col gap-1.5', className)}
    >
      <div
        data-testid="price-card-real"
        className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-2.5 py-1.5"
      >
        <p className="flex shrink-0 items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          <ShieldCheck className="h-2.5 w-2.5" /> Real (interno)
        </p>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="text-muted-foreground">Subtotal:</span>
            <span className="font-medium tabular-nums">{formatCurrency(realSubtotal)}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="text-muted-foreground">Desconto:</span>
            <span
              className={cn(
                'font-bold tabular-nums',
                isOverLimit ? 'text-warning' : 'text-success',
              )}
            >
              {realDiscountPercent.toFixed(1)}%
            </span>
          </span>
        </div>
      </div>

      <div
        data-testid="price-card-client"
        className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5"
      >
        <p className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-primary">
          Cliente vê
        </p>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="text-muted-foreground">Subtotal:</span>
            <span className="font-medium tabular-nums">{formatCurrency(presentedSubtotal)}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="text-muted-foreground">Desconto:</span>
            <span className="font-bold tabular-nums text-primary">
              {apparentDiscountPercent.toFixed(1)}%
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

export function NegotiationMarkupCard({
  value,
  onChange,
  realSubtotal,
  apparentDiscountPercent,
  realDiscountPercent,
  maxDiscountPercent,
  className,
  hidePriceComparison = false,
}: Props) {
  const [enabled, setEnabled] = useState(value > 0);

  // Sync switch state when an existing quote is loaded or a template resets value to 0.
  useEffect(() => {
    setEnabled(value > 0);
  }, [value]);

  const presentedSubtotal = realSubtotal * (1 + value / 100);
  
  const isOverLimit = maxDiscountPercent !== null && realDiscountPercent > maxDiscountPercent;
  const realFitsLimit = maxDiscountPercent !== null && realDiscountPercent <= maxDiscountPercent;

  const handleToggle = (next: boolean) => {
    setEnabled(next);
    if (!next) onChange(0);
    else if (value === 0) onChange(10);
  };

  return (
    <TooltipProvider>
      <div
        data-testid="negotiation-markup-card"
        className={cn(
          // Escala de spacing padronizada (mobile → desktop) para todo o card
          'space-y-2 rounded-xl border border-border/50 bg-gradient-to-br from-card to-muted/20 px-3 py-2.5 sm:space-y-1.5 sm:px-2.5 sm:py-2',
          className,
        )}
      >
        {/* Header — tudo em uma linha */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="shrink-0 rounded-lg bg-primary/10 p-1.5">
              <ChartNoAxesCombined className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            </div>
            <h4 className="truncate text-sm font-semibold leading-tight">Margem de Negociação</h4>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="Sobre margem de negociação" className="shrink-0">
                  <Info className="h-3 w-3 text-muted-foreground/60" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Infla o subtotal apresentado ao cliente para criar a sensação de um desconto
                maior, mantendo o desconto real dentro da sua alçada. Não aparece no PDF, e-mail
                ou link público.
              </TooltipContent>
            </Tooltip>
            <Badge
              variant="outline"
              className="h-4 shrink-0 gap-1 border-warning/30 bg-warning/10 text-[9px] text-warning"
            >
              <EyeOff className="h-2.5 w-2.5" aria-hidden="true" /> Uso interno
            </Badge>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={handleToggle}
            aria-label="Ativar margem de negociação"
          />
        </div>

        {enabled && (
          <>
            {/* Slider */}
            <div className="space-y-1.5 pt-4 sm:space-y-1 sm:pt-3">
              <div className="flex items-baseline justify-between">
                <label
                  htmlFor="negotiation-markup-slider"
                  className="text-[11px] text-muted-foreground"
                >
                  Acréscimo no preço apresentado
                </label>
                <span
                  className="text-sm font-bold tabular-nums text-primary"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  +{value.toFixed(0)}%
                </span>
              </div>
              <Slider
                id="negotiation-markup-slider"
                value={[value]}
                min={0}
                max={MAX_MARKUP}
                step={1}
                onValueChange={(v) => onChange(v[0] ?? 0)}
                aria-label="Margem de negociação em porcentagem"
                
              />
              <div
                className="flex justify-between text-[9px] text-muted-foreground/60"
                aria-hidden="true"
              >
                <span>0%</span>
                <span>{MAX_MARKUP}%</span>
              </div>
            </div>

            {/* Comparison preview (interno) — pode ser suprimido quando renderizado ao lado via <NegotiationPriceComparison /> */}
            {!hidePriceComparison && (
              <NegotiationPriceComparison
                realSubtotal={realSubtotal}
                apparentDiscountPercent={apparentDiscountPercent}
                realDiscountPercent={realDiscountPercent}
                presentedSubtotal={presentedSubtotal}
                isOverLimit={isOverLimit}
                className="border-t border-border/40 pt-2"
              />
            )}

            {/* Status badge */}
            {maxDiscountPercent !== null &&
              (isOverLimit ? (
                <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-1.5">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                  <p className="text-[10px] leading-snug text-warning">
                    Mesmo com markup, o desconto real ({realDiscountPercent.toFixed(1)}%) excede sua
                    alçada de {maxDiscountPercent}%. Será necessária aprovação do administrador.
                  </p>
                </div>
              ) : realFitsLimit && apparentDiscountPercent > maxDiscountPercent ? (
                <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 px-2.5 py-1.5">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                  <p className="text-[10px] leading-snug text-success">
                    Cliente percebe <strong>{apparentDiscountPercent.toFixed(1)}%</strong> de
                    desconto, mas o real é apenas <strong>{realDiscountPercent.toFixed(1)}%</strong>{' '}
                    — dentro da sua alçada de {maxDiscountPercent}%.
                  </p>
                </div>
              ) : null)}
          </>
        )}

      </div>
    </TooltipProvider>
  );
}
