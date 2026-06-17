import { SlidersHorizontal, RefreshCw, ChevronsUpDown, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface FilterPanelHeaderProps {
  activeFiltersCount: number;
  onReset: () => void;
  collapseAllSections: () => void;
  filterSearch: string;
  setFilterSearch: (v: string) => void;
}

export function FilterPanelHeader({
  activeFiltersCount,
  onReset,
  collapseAllSections,
  filterSearch,
  setFilterSearch,
}: FilterPanelHeaderProps) {
  return (
    <div className="mb-1 pb-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-primary to-brand-primary-hover shadow-md shadow-brand-primary/20">
            <SlidersHorizontal className="h-4 w-4 text-brand-primary-foreground" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold tracking-tight text-foreground">
              Filtros
            </h3>
            {activeFiltersCount > 0 ? (
              <span className="text-[10px] font-medium text-brand-primary">
                {activeFiltersCount} filtro{activeFiltersCount > 1 ? 's' : ''} ativo
                {activeFiltersCount > 1 ? 's' : ''}
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground/50">Refine sua busca</span>
            )}
          </div>
        </div>
        {activeFiltersCount > 0 && (
          <span className="inline-flex h-7 min-w-7 animate-scale-in items-center justify-center rounded-full bg-brand-primary px-2 text-xs font-bold text-brand-primary-foreground shadow-sm shadow-brand-primary/30">
            {activeFiltersCount}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onReset();
                toast.success('Filtros resetados');
              }}
              className={cn(
                'h-7 gap-1.5 px-3 text-xs transition-all',
                activeFiltersCount > 0
                  ? 'border-brand-primary/40 text-brand-primary hover:bg-brand-primary/10 hover:text-brand-primary'
                  : 'cursor-not-allowed border-border/50 text-muted-foreground/50',
              )}
              disabled={activeFiltersCount === 0}
              aria-label="Resetar todos os filtros"
            >
              <RefreshCw className="h-3 w-3" />
              Reset
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="border-border bg-card">
            Limpar todos os filtros ativos
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={collapseAllSections}
              className="h-7 gap-1.5 border-border/50 px-3 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              aria-label="Fechar todas as seções de filtro"
            >
              <ChevronsUpDown className="h-3 w-3" />
              Fechar
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="border-border bg-card">
            Recolher todas as seções
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="relative mt-3">
        <Search className="absolute left-2.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-brand-primary" />
        <Input
          placeholder="Buscar filtro..."
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          className="h-8 border-border/40 bg-muted/30 pl-8 pr-8 text-xs placeholder:text-muted-foreground/40 focus:border-brand-primary/50"
          aria-label="Buscar seção de filtro por nome"
        />
        {filterSearch && (
          <button
            type="button"
            onClick={() => setFilterSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
