import { BarChart3, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface StatItem {
  id: string;
  label: string;
  value: number;
  icon: React.ReactNode;
}

interface StatsPopoverProps {
  stats: StatItem[];
  /** Whether filters/search are active — shows contextual indicator */
  isFiltered?: boolean;
}

export function StatsPopover({ stats, isFiltered = false }: StatsPopoverProps) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 bg-card/40 backdrop-blur-md"
                aria-label="Resumo de estatísticas do catálogo"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                <span className="hidden text-xs sm:inline">Resumo</span>
              </Button>
            </PopoverTrigger>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {isFiltered
            ? 'Resumo dos resultados filtrados'
            : 'Resumo geral do catálogo (totais, categorias, etc.)'}
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        align="start"
        className="w-56 p-3"
        sideOffset={8}
        role="status"
        aria-label="Estatísticas do catálogo"
      >
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Estatísticas</p>
            {isFiltered && (
              <Badge
                variant="outline"
                className="h-4 gap-1 border-primary/30 px-1.5 py-0 text-[10px] text-primary"
              >
                <Filter className="h-2.5 w-2.5" />
                Filtrado
              </Badge>
            )}
          </div>

          {stats.map((stat) => (
            <div
              key={stat.id}
              className="group flex items-center justify-between py-1.5"
              role="listitem"
              aria-label={`${stat.label}: ${stat.value.toLocaleString('pt-BR')}`}
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="text-primary transition-transform group-hover:scale-110">
                  {stat.icon}
                </span>
                {stat.label}
              </div>
              <span
                className={cn(
                  'text-sm font-bold tabular-nums transition-colors',
                  stat.value === 0 ? 'text-muted-foreground/50' : 'text-foreground',
                )}
              >
                {stat.value.toLocaleString('pt-BR')}
              </span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
