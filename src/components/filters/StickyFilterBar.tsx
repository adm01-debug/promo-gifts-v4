import { SlidersHorizontal, ArrowUpDown, X, ChevronUp, LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SORT_OPTIONS } from '@/constants/filters';

interface StickyFilterBarProps {
  isVisible: boolean;
  activeFiltersCount: number;
  totalProducts: number;
  sortBy: string;
  onSortChange: (value: string) => void;
  onOpenFilters: () => void;
  onClearFilters: () => void;
  onScrollToTop: () => void;
  viewMode: 'grid' | 'list' | 'table';
  onViewModeChange: (mode: 'grid' | 'list' | 'table') => void;
}

export function StickyFilterBar({
  isVisible,
  activeFiltersCount,
  totalProducts,
  sortBy,
  onSortChange,
  onOpenFilters,
  onClearFilters,
  onScrollToTop,
  viewMode,
  onViewModeChange,
}: StickyFilterBarProps) {
  return (
    <div
      className={cn(
        'fixed left-0 right-0 top-[4.5rem] z-50 border-b border-border bg-background/95 shadow-lg backdrop-blur-md transition-[transform,opacity] duration-200',
        isVisible ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-full opacity-0',
      )}
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left side - Filters */}
          <div className="flex items-center gap-3">
            {/* Botão Filtros */}
            <Button variant="outline" size="sm" onClick={onOpenFilters} className="gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Filtros</span>
              {activeFiltersCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 flex h-5 w-5 items-center justify-center p-0 text-xs"
                >
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>

            {/* Limpar filtros (se houver) */}
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearFilters}
                className="gap-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
                <span className="hidden sm:inline">Limpar</span>
              </Button>
            )}

            {/* Contador de produtos */}
            <span className="hidden text-sm text-muted-foreground md:block">
              <strong className="text-foreground">{totalProducts}</strong> produtos
            </span>
          </div>

          {/* Right side - Sort & View */}
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="hidden rounded-lg border border-border p-0.5 sm:flex">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                aria-label="LayoutGrid"
                className="h-7 w-7"
                onClick={() => onViewModeChange('grid')}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                aria-label="Lista"
                className="h-7 w-7"
                onClick={() => onViewModeChange('list')}
              >
                <List className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Sort */}
            <Select value={sortBy} onValueChange={onSortChange}>
              <SelectTrigger className="h-8 w-[180px] text-sm">
                <ArrowUpDown className="mr-1.5 h-3.5 w-3.5" />
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Voltar ao topo */}
            <Button
              variant="secondary"
              size="icon"
              aria-label="Expandir"
              className="h-8 w-8"
              onClick={onScrollToTop}
              title="Voltar ao topo"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Barra de filtros compacta para ficar fixa DENTRO do grid de produtos
interface InlineFilterBarProps {
  activeFiltersCount: number;
  totalProducts: number;
  sortBy: string;
  onSortChange: (value: string) => void;
  onOpenFilters: () => void;
  onClearFilters: () => void;
  viewMode: 'grid' | 'list' | 'table';
  onViewModeChange: (mode: 'grid' | 'list' | 'table') => void;
  columnSelector?: React.ReactNode;
}

export function InlineFilterBar({
  activeFiltersCount,
  totalProducts,
  sortBy,
  onSortChange,
  onOpenFilters,
  onClearFilters,
  viewMode,
  onViewModeChange,
  columnSelector,
}: InlineFilterBarProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      {/* Left side - Filters */}
      <div className="flex items-center gap-2">
        {/* Botão Filtros */}
        <Button variant="outline" size="sm" onClick={onOpenFilters} className="h-8 gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span className="hidden text-xs sm:inline">Filtros</span>
          {activeFiltersCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-1 flex h-4 w-4 items-center justify-center p-0 text-[10px]"
            >
              {activeFiltersCount}
            </Badge>
          )}
        </Button>

        {/* Limpar filtros (se houver) */}
        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-8 gap-1 px-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            <span className="hidden text-xs sm:inline">Limpar</span>
          </Button>
        )}

        {/* Contador de produtos */}
        <span className="text-xs text-muted-foreground">
          <strong className="text-foreground">{totalProducts}</strong> produtos
        </span>
      </div>

      {/* Right side - Sort & View */}
      <div className="flex items-center gap-2">
        {/* Column selector */}
        {viewMode === 'grid' && columnSelector}
        {/* View mode toggle */}
        <div className="hidden rounded-md border border-border p-0.5 sm:flex">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            aria-label="LayoutGrid"
            className="h-6 w-6"
            onClick={() => onViewModeChange('grid')}
          >
            <LayoutGrid className="h-3 w-3" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            aria-label="Lista"
            className="h-6 w-6"
            onClick={() => onViewModeChange('list')}
          >
            <List className="h-3 w-3" />
          </Button>
        </div>

        {/* Sort */}
        <Select value={sortBy} onValueChange={onSortChange}>
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <ArrowUpDown className="mr-1 h-3 w-3" />
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
