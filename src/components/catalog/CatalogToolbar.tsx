import React, { Suspense, memo } from 'react';
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
import type { ViewMode, SortOption } from '@/hooks/products/useCatalogState';
import { Skeleton } from '@/components/ui/skeleton';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { cn } from '@/lib/utils';
import { m as motion, AnimatePresence } from 'framer-motion';

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
}

function CatalogToolbarInner({
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
}: CatalogToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-shrink-0 items-center gap-2">
        <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="px-2.5 sm:px-3"
                    aria-label="Abrir filtros do catálogo"
                  >
                    <Filter className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Filtros</span>
                    {activeFiltersCount > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 min-w-5 text-xs sm:ml-2">
                        {activeFiltersCount}
                      </Badge>
                    )}
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
            {filterSheetOpen && (
              <Suspense fallback={<FilterPanelSkeleton />}>
                <LazyFilterPanel
                  filters={filters}
                  onFilterChange={setFilters}
                  onReset={resetFilters}
                  activeFiltersCount={activeFiltersCount}
                />
              </Suspense>
            )}
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-1.5">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <Tooltip>
              <TooltipTrigger asChild>
                <SelectTrigger
                  className="h-9 w-10 text-xs font-medium sm:h-10 sm:w-44 sm:text-sm"
                  aria-label="Ordenar por"
                  data-testid="catalog-sort-trigger"
                >
                  <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground sm:mr-2" />
                  <span className="hidden sm:inline">
                    <SelectValue placeholder="Ordenar" />
                  </span>
                </SelectTrigger>
              </TooltipTrigger>
              <TooltipContent>Ordenar produtos (relevância, preço, novidades…)</TooltipContent>
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
        <div className="hidden sm:block">
          <StatsPopover stats={statBadges} isFiltered={activeFiltersCount > 0} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Selecionar / Cancelar toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={selectionMode ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'relative h-8 gap-1.5 transition-all',
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

              {/* Animated counter badge */}
              <AnimatePresence>
                {selectionMode && selectedCount > 0 && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    className="absolute -right-2 -top-2"
                  >
                    <Badge className="flex h-5 min-w-5 items-center justify-center bg-destructive px-1.5 py-0 text-[10px] font-bold tabular-nums text-destructive-foreground shadow-lg">
                      {selectedCount}
                    </Badge>
                  </motion.div>
                )}
              </AnimatePresence>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {selectionMode
              ? `Sair do modo seleção${selectedCount > 0 ? ` (${selectedCount} selecionado${selectedCount > 1 ? 's' : ''})` : ''}`
              : 'Selecionar vários produtos para orçamento, coleção ou comparação'}
          </TooltipContent>
        </Tooltip>

        <div className="hidden sm:block">
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
}

export const CatalogToolbar = memo(CatalogToolbarInner);
CatalogToolbar.displayName = 'CatalogToolbar';
