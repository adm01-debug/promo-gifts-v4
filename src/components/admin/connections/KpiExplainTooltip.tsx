/**
 * KpiExplainTooltip — Evolução Estratégica
 * Padronizado com hierarquia visual e micro-interações premium.
 */
import { Calculator, Clock, Database, Target, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface KpiExplain {
  summary: string;
  formula: string;
  window: string;
  source: string;
  threshold?: string;
}

export function KpiExplainTooltip({
  explain,
  className,
}: {
  explain: KpiExplain;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Explicação: ${explain.summary}`}
          className={cn(
            'inline-flex h-4 w-4 items-center justify-center rounded-full transition-all duration-300',
            'bg-primary/5 text-primary/60 hover:bg-primary/20 hover:text-primary hover:scale-110',
            className,
          )}
        >
          <Info className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="p-0">
        <div className="border-b border-white/5 bg-white/[0.03] px-3 py-2">
          <p className="font-semibold leading-tight text-tooltip">{explain.summary}</p>
        </div>
        <div className="space-y-2.5 p-3">
          <section className="space-y-1">
            <header className="flex items-center gap-1 text-tooltip-header">
              <Calculator className="h-3.5 w-3.5" />
              <span>Fórmula Logística</span>
            </header>
            <div className="rounded bg-white/[0.05] p-1.5 font-mono text-tooltip leading-relaxed text-white/90">
              {explain.formula}
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3">
            <section className="space-y-1">
              <header className="flex items-center gap-1 text-tooltip-header">
                <Clock className="h-3.5 w-3.5" />
                <span>Janela</span>
              </header>
              <p className="text-tooltip text-white/80">{explain.window}</p>
            </section>
            <section className="space-y-1">
              <header className="flex items-center gap-1 text-tooltip-header">
                <Database className="h-3.5 w-3.5" />
                <span>Fonte</span>
              </header>
              <p className="truncate text-tooltip text-white/80" title={explain.source}>
                {explain.source}
              </p>
            </section>
          </div>

          {explain.threshold && (
            <section className="rounded bg-primary/10 p-1.5 border border-primary/20">
              <header className="flex items-center gap-1 text-tooltip-header !text-primary !opacity-100">
                <Target className="h-3.5 w-3.5" />
                <span>Meta de Performance</span>
              </header>
              <p className="mt-0.5 text-tooltip font-medium text-primary-foreground">{explain.threshold}</p>
            </section>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
