/**
 * ExplainModeToggle — Onda 14
 *
 * Switch compacto para ativar/desativar o modo "Ver como calculamos".
 * Mostra atalho "?" e estado atual. Pode ser embutido em toolbars.
 */
import { Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useExplainMode } from './ExplainModeContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function ExplainModeToggle({ className }: { className?: string }) {
  const { enabled, toggle } = useExplainMode();

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={toggle}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              enabled
                ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15'
                : 'border-border/60 bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              className,
            )}
          >
            <Calculator className="h-3 w-3" />
            <span className="font-medium">Ver como calculamos</span>
            <kbd
              className={cn(
                'ml-0.5 hidden h-4 min-w-[14px] items-center justify-center rounded px-1 font-mono text-[9px] font-semibold sm:inline-flex',
                enabled ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground',
              )}
              aria-hidden="true"
            >
              ?
            </kbd>
            <span
              className={cn(
                'ml-1 inline-block h-1.5 w-1.5 rounded-full',
                enabled ? 'bg-primary' : 'bg-muted-foreground/40',
              )}
              aria-hidden="true"
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs">
            {enabled
              ? 'Tooltips de fórmula visíveis nos KPIs.'
              : 'Mostra fórmula, janela e fonte por trás de cada KPI.'}
            <span className="mt-0.5 block text-[10px] text-muted-foreground">
              Atalho: pressione <kbd className="font-mono">?</kbd>
            </span>
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
