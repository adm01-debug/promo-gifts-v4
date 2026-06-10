import React, { Suspense, useDeferredValue, memo } from 'react';
import { SORT_OPTIONS } from '@/constants/filters';
import { Filter, ArrowUpDown, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { FilterState } from '@/components/filters/FilterPanel';
import { StatsPopover } from '@/components/products/StatsPopover';
import { LayoutPopover } from '@/components/products/LayoutPopover';
import type { ColumnCount } from '@/components/products/ColumnSelector';
import type { SortOption, ViewMode } from '@/hooks/products/useCatalogState';
import { Skeleton } from '@/components/ui/skeleton';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { cn } from '@/lib/utils';

const LazyFilterPanel = lazyWithRetry(() =>
  import('@/components/filters/FilterPanel').then((m) => ({ default: m.FilterPanel })),
);

function FilterPanelSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-6 w-3/4" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

interface CatalogToolbarProps {
  filters: FilterState;
  setFilters: (f: FilterState) => void;
  activeFiltersCount: number;
  filterSheetOpen: boolean;
  setFilterSheetOpen: (open: boolean) => void;
  resetFilters: () => void;
  sortBy: SortOption;
  setSortBy: (s: SortOption) => void;
  statBadges: { id: string; label: string; value: number; icon: React.ReactNode }[];
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  gridColumns: ColumnCount;
  setGridColumns: (c: ColumnCount) => void;
  selectionMode: boolean;
  onToggleSelectionMode: () => void;
  selectedCount?: number;
  isTransitioning?: boolean;
  showLayoutControlsOnly?: boolean;
}


// SORT_OPTIONS[0].value é o valor default ('name'). Derivar em vez de hardcodar
// garante que qualquer futura mudança no SSOT seja refletida automaticamente.
const DEFAULT_SORT_VALUE = SORT_OPTIONS[0].value;

export const CatalogToolbar = memo(function CatalogToolbar({
  filters,
  setFilters,
  activeFiltersCount,
  filterSheetOpen,
  setFilterSheetOpen,
  resetFilters,
  sortBy,
  setSortBy,
  statBadges,
  viewMode,
  setViewMode,
  gridColumns,
  setGridColumns,
  selectionMode,
  onToggleSelectionMode,
  selectedCount = 0,
  isTransitioning = false,
  showLayoutControlsOnly = false,
}: CatalogToolbarProps) {

  const deferredIsTransitioning = useDeferredValue(isTransitioning);

  return (
    <div className="flex flex-wrap items-center justify-start gap-1.5 sm:gap-3">
      <div className="flex flex-shrink-0 items-center gap-1.5">
        {!showLayoutControlsOnly && (
          <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2.5 sm:px-3 sm:h-9"
                      aria-label="Abrir filtros do catálogo"
                    >
                      <Filter className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Filtros</span>
                      <div className="relative w-0 sm:w-auto">
                        {activeFiltersCount > 0 && (
                          <div className="duration-200 animate-in fade-in zoom-in-0 sm:ml-2">
                            <Badge
                              variant="secondary"
                              className="flex h-5 min-w-5 items-center justify-center text-xs"
                            >
                              {activeFiltersCount}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </Button>
                  </SheetTrigger>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {activeFiltersCount > 0
                  ? `Refinar busca · ${activeFiltersCount} filtro${activeFiltersCount > 1 ? 's' : ''} ativo${activeFiltersCount > 1 ? 's' : ''}`
                  : 'Refinar por categoria, cor, preço e mais'}
              </TooltipContent>
            </Tooltip>
            <SheetContent side="left" className="w-80 overflow-y-auto">
              <Suspense fallback={<FilterPanelSkeleton />}>
                <LazyFilterPanel
                  filters={filters}
                  onFilterChange={setFilters}
                  onReset={resetFilters}
                  activeFiltersCount={activeFiltersCount}
                />
              </Suspense>
            </SheetContent>
          </Sheet>
        )}

        {!showLayoutControlsOnly && (
          <div className="flex items-center gap-1">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="relative inline-flex">
                    <SelectTrigger
                      className={cn(
                        'relative h-8 w-10 text-xs font-medium transition-all sm:h-9 sm:w-52 sm:text-sm',
                        sortBy !== DEFAULT_SORT_VALUE &&
                          'border-primary bg-primary/5 ring-1 ring-primary/20',
                      )}
                      aria-label="Ordenar por"
                      data-testid="catalog-sort-trigger"
                    >
                      <ArrowUpDown
                        className={cn(
                          'h-3.5 w-3.5 shrink-0 sm:mr-2',
                          sortBy !== DEFAULT_SORT_VALUE ? 'text-primary' : 'text-muted-foreground',
                        )}
                      />
                      <span className="hidden sm:inline">
                        <SelectValue placeholder="Ordenar" />
                      </span>
                      {sortBy !== DEFAULT_SORT_VALUE && (
                        <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary sm:hidden" />
                      )}
                    </SelectTrigger>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {sortBy !== DEFAULT_SORT_VALUE
                    ? `Ordenado por: ${
                        SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? 'Relevância de cor'
                      }`
                    : 'Ordenar produtos (nome, preço, novidades…)'}
                </TooltipContent>
              </Tooltip>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="text-xs sm:text-sm"
                    data-testid={`catalog-sort-item-${option.value}`}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {!showLayoutControlsOnly && (
          <div className="hidden sm:block">
            <StatsPopover stats={statBadges} isFiltered={activeFiltersCount > 0} />
          </div>
        )}
      </div>


      <div className="flex items-center gap-1.5">
        {/* Selecionar / Cancelar toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={selectionMode ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'relative h-8 gap-1.5 transition-all sm:h-9',
                selectionMode
                  ? 'bg-primary text-primary-foreground shadow-md hover:bg-primary/90'
                  : 'hover:border-primary/50',
              )}
              onClick={onToggleSelectionMode}
              aria-label={
                selectionMode ? 'Cancelar seleção de produtos' : 'Selecionar vários produtos'
              }
            >
              <CheckSquare className="h-3.5 w-3.5" />
              <span className="hidden text-xs sm:inline">
                {selectionMode ? 'Cancelar' : 'Selecionar'}
              </span>

              {selectionMode && selectedCount > 0 && (
                <div className="absolute -right-2 -top-2 duration-200 animate-in fade-in zoom-in-0">
                  <Badge className="flex h-5 min-w-5 items-center justify-center bg-destructive px-1.5 py-0 text-[10px] font-bold tabular-nums text-destructive-foreground shadow-lg">
                    {selectedCount}
                  </Badge>
                </div>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {selectionMode
              ? `Sair do modo seleção${selectedCount > 0 ? ` (${selectedCount} selecionado${selectedCount > 1 ? 's' : ''})` : ''}`
              : 'Selecionar vários produtos para orçamento, coleção ou comparação'}
          </TooltipContent>
        </Tooltip>

        <div className="hidden items-center gap-2 sm:flex">
          {deferredIsTransitioning && (
            <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-muted/30 px-2 py-1 duration-200 animate-in fade-in slide-in-from-right-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              <span className="text-[10px] font-medium uppercase tracking-tighter text-muted-foreground">
                Otimizando...
              </span>
            </div>
          )}

          <LayoutPopover
            viewMode={viewMode}
            setViewMode={setViewMode}
            gridColumns={gridColumns}
            setGridColumns={setGridColumns}
          />
        </div>
      </div>
    </div>
  );
});
