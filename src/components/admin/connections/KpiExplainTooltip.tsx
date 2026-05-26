/**
 * KpiExplainTooltip — Onda 14
 *
 * Tooltip rico para o modo "Ver como calculamos". Estrutura padronizada:
 *  - Resumo (1 linha)
 *  - Fórmula (mono)
 *  - Janela de tempo
 *  - Fonte de dados (tabela/coluna)
 *  - Threshold/alvo (opcional)
 */
import { Calculator, Clock, Database, Target, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface KpiExplain {
  /** Resumo curto do que o KPI representa */
  summary: string;
  /** Fórmula em pseudocódigo / SQL-like */
  formula: string;
  /** Janela de tempo considerada */
  window: string;
  /** Fonte de dados (tabela.coluna ou múltiplas) */
  source: string;
  /** Threshold/alvo opcional */
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
          aria-label={`Ver como calculamos: ${explain.summary}`}
          className={cn(
            'inline-flex h-3.5 w-3.5 items-center justify-center rounded-full',
            'text-primary/80 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
            'transition-colors',
            className,
          )}
        >
          <Info className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        className="max-w-sm overflow-hidden border-primary/40 bg-primary p-0 text-primary-foreground"
      >
        <div className="border-b border-white/10 bg-black/10 px-3 py-2">
          <p className="text-[11px] font-semibold leading-snug">{explain.summary}</p>
        </div>
        <dl className="space-y-2 px-3 py-2 text-[10px]">
          <div className="flex gap-2">
            <Calculator className="mt-0.5 h-2.5 w-2.5 shrink-0 text-primary-foreground/70" />
            <div className="min-w-0">
              <dt className="text-[8px] font-semibold uppercase tracking-wide text-primary-foreground/60">
                Fórmula
              </dt>
              <dd className="mt-0.5 break-words rounded bg-black/20 px-1.5 py-0.5 font-mono text-[10px] leading-snug">
                {explain.formula}
              </dd>
            </div>
          </div>
          <div className="flex gap-2">
            <Clock className="mt-0.5 h-2.5 w-2.5 shrink-0 text-primary-foreground/70" />
            <div className="min-w-0">
              <dt className="text-[8px] font-semibold uppercase tracking-wide text-primary-foreground/60">
                Janela
              </dt>
              <dd className="leading-snug">{explain.window}</dd>
            </div>
          </div>
          <div className="flex gap-2">
            <Database className="mt-0.5 h-2.5 w-2.5 shrink-0 text-primary-foreground/70" />
            <div className="min-w-0">
              <dt className="text-[8px] font-semibold uppercase tracking-wide text-primary-foreground/60">
                Fonte
              </dt>
              <dd className="break-words font-mono text-[10px] leading-snug">{explain.source}</dd>
            </div>
          </div>
          {explain.threshold && (
            <div className="flex gap-2">
              <Target className="mt-0.5 h-2.5 w-2.5 shrink-0 text-primary-foreground/70" />
              <div className="min-w-0">
                <dt className="text-[8px] font-semibold uppercase tracking-wide text-primary-foreground/60">
                  Alvo
                </dt>
                <dd className="leading-snug">{explain.threshold}</dd>
              </div>
            </div>
          )}
        </dl>
      </TooltipContent>
    </Tooltip>
  );
}
