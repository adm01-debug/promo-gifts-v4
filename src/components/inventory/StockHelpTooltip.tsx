/**
 * StockHelpTooltip — Reusable help tooltip for the /estoque toolbar.
 * Wraps any trigger element with a rich tooltip explaining the field,
 * with example usage and (optional) error/empty-state hint.
 */
import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ReactNode } from 'react';

interface StockHelpTooltipProps {
  title: string;
  description: ReactNode;
  example?: ReactNode;
  emptyHint?: ReactNode;
  children?: ReactNode;
  side?: 'bottom' | 'left' | 'right' | 'top';
}

export function StockHelpTooltip({
  title,
  description,
  example,
  emptyHint,
  children,
  side = 'bottom',
}: StockHelpTooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex" aria-label={`Ajuda: ${title}`}>
            {children ?? (
              <span className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full text-muted-foreground hover:text-foreground">
                <HelpCircle className="h-3.5 w-3.5" />
              </span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs space-y-1.5">
          <p className="text-xs font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
          {example && (
            <p className="text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">Exemplo:</span> {example}
            </p>
          )}
          {emptyHint && (
            <p className="text-[11px] text-warning">
              <span className="font-medium">Sem resultados?</span> {emptyHint}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
