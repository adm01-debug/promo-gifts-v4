/**
 * ReplenishmentToolbar — Header, search, filters, and active-filter chips
 * for the Replenishment grid.
 */
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RefreshCw,
  Search,
  X,
  CheckSquare,
  Loader2,
  Building2,
  FolderTree,
  ArrowUpDown,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutPopover } from '@/components/products/LayoutPopover';
import { cn } from '@/lib/utils';
import type { ColumnCount } from '@/components/products/ColumnSelector';

type ViewMode = 'grid' | 'list' | 'table';
type SortMode = 'name' | 'price-asc' | 'price-desc' | 'newest' | 'stock';

interface SupplierOption {
  id: string;
  name: string;
  count: number;
}
interface CategoryOption {
  id: string;
  name: string;
  count: number;
}

interface ReplenishmentToolbarProps {
  // Counts
  totalCount: number;
  filteredCount: number;
  isLoading: boolean;
  loadingProgress: number;
  // Search
  searchQuery: string;
  onSearchChange: (q: string) => void;
  // Filters
  selectedSupplier: string;
  onSupplierChange: (v: string) => void;
  suppliers: SupplierOption[];
  selectedCategory: string;
  onCategoryChange: (v: string) => void;
  categories: CategoryOption[];
  sortMode: SortMode;
  onSortChange: (v: SortMode) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  // View
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  gridColumns: ColumnCount;
  setGridColumns: (c: ColumnCount) => void;
  // Selection
  selectionMode: boolean;
  onToggleSelectionMode: () => void;
}

export function ReplenishmentToolbar({
  totalCount,
  filteredCount,
  isLoading,
  loadingProgress,
  searchQuery,
  onSearchChange,
  selectedSupplier,
  onSupplierChange,
  suppliers,
  selectedCategory,
  onCategoryChange,
  categories,
  sortMode,
  onSortChange,
  hasActiveFilters,
  onClearFilters,
  viewMode,
  setViewMode,
  gridColumns,
  setGridColumns,
  selectionMode,
  onToggleSelectionMode,
}: ReplenishmentToolbarProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <RefreshCw className="h-4 w-4 shrink-0 text-info" aria-hidden="true" />
          <h2 className="whitespace-nowrap text-base font-semibold sm:text-lg">Reposição</h2>
          <Badge variant="secondary" className="shrink-0 px-1.5 text-[10px] tabular-nums">
            {isLoading && totalCount === 0 ? (
              <span className="flex items-center gap-1">
                <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden="true" />
                carregando…
              </span>
            ) : (
              <>
                {filteredCount}
                {hasActiveFilters && <span className="text-muted-foreground">/{totalCount}</span>}
              </>
            )}
          </Badge>

          <AnimatePresence>
            {isLoading && loadingProgress > 0 && loadingProgress < 100 && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 48 }}
                exit={{ opacity: 0, width: 0 }}
                className="ml-1 inline-flex items-center gap-1"
              >
                <span
                  className="inline-block h-1 w-12 overflow-hidden rounded-full bg-muted/50 align-middle"
                  aria-hidden="true"
                >
                  <motion.span
                    className="block h-full rounded-full bg-primary/60"
                    initial={{ width: 0 }}
                    animate={{ width: `${loadingProgress}%` }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                  />
                </span>
                <span className="text-[10px] tabular-nums text-muted-foreground/60">
                  {Math.round(loadingProgress)}%
                </span>
              </motion.span>
            )}
          </AnimatePresence>

          {/* Desktop Search */}
          <div className="hidden w-80 sm:block lg:w-[25rem]">
            <SearchInput
              value={searchQuery}
              onChange={onSearchChange}
              placeholder="Buscar reposições…  /"
            />
          </div>
        </div>

        <Button
          variant={selectionMode ? 'default' : 'outline'}
          size="sm"
          className={cn(
            'h-8 shrink-0 gap-1.5 text-xs transition-all',
            selectionMode &&
              'bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.3)]',
          )}
          onClick={onToggleSelectionMode}
          aria-pressed={selectionMode}
        >
          <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">{selectionMode ? 'Cancelar' : 'Selecionar'}</span>
        </Button>
        <LayoutPopover
          viewMode={viewMode}
          setViewMode={setViewMode}
          gridColumns={gridColumns}
          setGridColumns={setGridColumns}
        />
      </div>

      {/* Mobile Search */}
      <div className="flex w-full items-center gap-2 sm:hidden">
        <SearchInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Buscar reposições…"
        />
      </div>

      {/* Filters */}
      <div
        className="flex flex-wrap items-center gap-1.5"
        role="toolbar"
        aria-label="Filtros de reposição"
      >
        <Select value={selectedSupplier} onValueChange={onSupplierChange}>
          <SelectTrigger
            className="h-7 w-[160px] gap-1 text-[11px]"
            aria-label="Filtrar por fornecedor"
          >
            <Building2 className="h-3 w-3 shrink-0" aria-hidden="true" />
            <SelectValue placeholder="Fornecedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos fornecedores</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} ({s.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedCategory} onValueChange={onCategoryChange}>
          <SelectTrigger
            className="h-7 w-[160px] gap-1 text-[11px]"
            aria-label="Filtrar por categoria"
          >
            <FolderTree className="h-3 w-3 shrink-0" aria-hidden="true" />
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} ({c.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortMode} onValueChange={(v) => onSortChange(v as SortMode)}>
          <SelectTrigger className="h-7 w-[180px] gap-1 text-[11px]" aria-label="Ordenar produtos">
            <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Nome (A-Z)</SelectItem>
            <SelectItem value="price-asc">Preço (Menor → Maior)</SelectItem>
            <SelectItem value="price-desc">Preço (Maior → Menor)</SelectItem>
            <SelectItem value="newest">Mais Recentes</SelectItem>
            <SelectItem value="stock">Maior Estoque</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={onClearFilters}
            aria-label="Limpar todos os filtros"
          >
            <X className="mr-0.5 h-3 w-3" aria-hidden="true" />
            Limpar
          </Button>
        )}
      </div>

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1" role="list" aria-label="Filtros ativos">
          {searchQuery.trim() && (
            <Badge
              role="listitem"
              variant="secondary"
              className="h-5 cursor-pointer gap-0.5 text-[10px] hover:bg-destructive/10"
              onClick={() => onSearchChange('')}
              aria-label={`Remover filtro: ${searchQuery}`}
            >
              <Search className="h-2.5 w-2.5" aria-hidden="true" />"{searchQuery}"
              <X className="h-2.5 w-2.5" aria-hidden="true" />
            </Badge>
          )}
          {selectedSupplier !== 'all' && (
            <Badge
              role="listitem"
              variant="secondary"
              className="h-5 cursor-pointer gap-0.5 text-[10px] hover:bg-destructive/10"
              onClick={() => onSupplierChange('all')}
              aria-label="Remover filtro de fornecedor"
            >
              <Building2 className="h-2.5 w-2.5" aria-hidden="true" />
              {suppliers.find((s) => s.id === selectedSupplier)?.name}
              <X className="h-2.5 w-2.5" aria-hidden="true" />
            </Badge>
          )}
          {selectedCategory !== 'all' && (
            <Badge
              role="listitem"
              variant="secondary"
              className="h-5 cursor-pointer gap-0.5 text-[10px] hover:bg-destructive/10"
              onClick={() => onCategoryChange('all')}
              aria-label="Remover filtro de categoria"
            >
              <FolderTree className="h-2.5 w-2.5" aria-hidden="true" />
              {categories.find((c) => c.id === selectedCategory)?.name}
              <X className="h-2.5 w-2.5" aria-hidden="true" />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

/** Small reusable search input */
function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative flex-1">
      <Search
        className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 border-border/50 bg-muted/40 pl-8 text-xs focus:bg-background"
        aria-label="Buscar reposições"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Limpar busca"
          type="button"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
