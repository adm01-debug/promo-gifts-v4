/**
 * SeverityFilterControl — Onda 14
 *
 * Seletor visual de severidade para o módulo /admin/conexoes. Renderiza um
 * grupo de pills (Todos · P0 · P1 · P2) com cores semânticas e contadores.
 * O estado é gerido por SeverityFilterContext (URL + localStorage).
 *
 * Tom de voz: híbrido — pill traz o código técnico (P0) + label humano
 * (Crítico) e tooltip com explicação curta.
 */
import { Filter, AlertOctagon, AlertTriangle, Info, LayoutGrid } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useSeverityFilter, type SeverityFilter } from './SeverityFilterContext';

interface PillCfg {
  value: SeverityFilter;
  label: string;
  short: string;
  icon: typeof Filter;
  cls: string;
  activeCls: string;
  description: string;
}

const PILLS: PillCfg[] = [
  {
    value: 'all',
    label: 'Todos',
    short: 'Todos',
    icon: LayoutGrid,
    cls: 'text-muted-foreground hover:bg-muted/60',
    activeCls: 'bg-foreground text-background border-foreground',
    description: 'Mostrar incidentes de todas as severidades',
  },
  {
    value: 'P0',
    label: 'Crítico',
    short: 'P0',
    icon: AlertOctagon,
    cls: 'text-destructive hover:bg-destructive/10 border-destructive/30',
    activeCls:
      'bg-destructive/15 text-destructive border-destructive/50 ring-1 ring-destructive/30',
    description: 'P0 (crítico): impacto imediato — exige intervenção agora',
  },
  {
    value: 'P1',
    label: 'Atenção',
    short: 'P1',
    icon: AlertTriangle,
    cls: 'text-warning hover:bg-warning/10 border-warning/30',
    activeCls: 'bg-warning/15 text-warning border-warning/50 ring-1 ring-warning/30',
    description: 'P1 (atenção): degradação visível — monitorar e planejar correção',
  },
  {
    value: 'P2',
    label: 'Info',
    short: 'P2',
    icon: Info,
    cls: 'text-muted-foreground hover:bg-muted/60 border-border',
    activeCls: 'bg-muted text-foreground border-border ring-1 ring-border',
    description: 'P2 (informacional): registro sem impacto operacional',
  },
];

interface Props {
  /** Contadores opcionais por severidade — mostrados como badge na pill. */
  counts?: { P0: number; P1: number; P2: number; total?: number };
  className?: string;
}

export function SeverityFilterControl({ counts, className }: Props) {
  const { filter, setFilter } = useSeverityFilter();

  return (
    <TooltipProvider>
      <div
        className={cn(
          'flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2',
          className,
        )}
        role="toolbar"
        aria-label="Filtro por severidade"
      >
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
          <Filter className="h-3 w-3" />
          Filtrar por severidade:
        </span>
        <div
          role="radiogroup"
          aria-label="Severidade"
          className="flex flex-wrap items-center gap-1.5"
        >
          {PILLS.map((pill) => {
            const Icon = pill.icon;
            const active = filter === pill.value;
            const count = pill.value === 'all' ? counts?.total : counts?.[pill.value];
            return (
              <Tooltip key={pill.value}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setFilter(pill.value)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                      active ? pill.activeCls : cn('bg-background', pill.cls),
                    )}
                  >
                    <Icon className="h-3 w-3" aria-hidden="true" />
                    <span>{pill.short}</span>
                    {pill.value !== 'all' && (
                      <span className="-mx-0.5 text-[10px] text-muted-foreground/80">
                        {pill.label}
                      </span>
                    )}
                    {typeof count === 'number' && count > 0 && (
                      <span
                        className={cn(
                          'inline-flex h-4 min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums',
                          active ? 'bg-background/30' : 'bg-muted text-foreground',
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{pill.description}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        {filter !== 'all' && (
          <button
            type="button"
            onClick={() => setFilter('all')}
            className="ml-auto text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Limpar filtro
          </button>
        )}
      </div>
    </TooltipProvider>
  );
}
