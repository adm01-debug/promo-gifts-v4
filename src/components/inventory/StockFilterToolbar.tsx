/**
 * StockFilterToolbar — Advanced filter bar for Stock Dashboard
 * Uses same FilterSection architecture as Super Filtro
 */
import { useState, useEffect, useMemo } from "react";
import {
  Search,
  X,
  Building2,
  Palette,
  PackageCheck,
  Package,
  ShoppingCart,
  AlertTriangle,
  SlidersHorizontal,
  Sparkles,
  LayoutGrid,
  Filter,
  Truck,
  RotateCcw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger, PopoverClose,
} from "@/components/ui/popover";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { InlineColorGroupFilter } from "@/components/filters/InlineColorGroupFilter";
import { ExternalCategoryFilter } from "@/components/filters/ExternalCategoryFilter";
import { DebouncedPriceInput } from "@/components/filters/DebouncedPriceInput";
import { FilterSection } from "@/components/filters/filter-panel/FilterSection";
import type { StockFilters, StockStatus } from "@/types/stock";
import { motion, AnimatePresence } from "framer-motion";

interface FilterOption {
  name: string;
  count: number;
}

interface StockFilterToolbarProps {
  filters: StockFilters;
  onUpdateFilter: <K extends keyof StockFilters>(key: K, value: StockFilters[K]) => void;
  onResetFilters: () => void;
  categories: FilterOption[];
  suppliers: FilterOption[];
  colors: string[];
  colorGroups: FilterOption[];
  totalProducts: number;
  filteredCount: number;
}

const _STATUS_OPTIONS: { value: StockStatus | 'all'; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'all', label: 'Todos', icon: <PackageCheck className="h-3.5 w-3.5" />, color: 'text-foreground' },
  { value: 'in_stock', label: 'Em Estoque', icon: <PackageCheck className="h-3.5 w-3.5" />, color: 'text-success' },
  { value: 'low_stock', label: 'Baixo', icon: <AlertTriangle className="h-3.5 w-3.5" />, color: 'text-warning' },
  { value: 'critical', label: 'Crítico', icon: <AlertTriangle className="h-3.5 w-3.5" />, color: 'text-destructive' },
  { value: 'out_of_stock', label: 'Esgotado', icon: <X className="h-3.5 w-3.5" />, color: 'text-destructive' },
  { value: 'incoming', label: 'Chegando', icon: <ShoppingCart className="h-3.5 w-3.5" />, color: 'text-primary' },
];

export function StockFilterToolbar({
  filters, onUpdateFilter, onResetFilters,
  categories, suppliers, colors, colorGroups,
  totalProducts, filteredCount,
}: StockFilterToolbarProps) {
  const [localSearch, setLocalSearch] = useState(filters.search);
  const [quantityInput, setQuantityInput] = useState(filters.minQuantityNeeded?.toString() || '');
  const [openSections, setOpenSections] = useState<string[]>([]);

  // Accordion behavior: only one section open at a time
  const toggleSection = (id: string) => {
    setOpenSections(prev => prev.includes(id) ? [] : [id]);
  };

  // Section active counts
  const sectionCounts = useMemo(() => ({
    cores: (filters.colorGroup ? 1 : 0) + (filters.colorName ? 1 : 0),
    categorias: filters.categoryId ? 1 : 0,
    estoque: (filters.minQuantityNeeded && filters.minQuantityNeeded > 0) ? 1 : 0,
    fornecedores: filters.supplierId ? 1 : 0,
    ordenacao: filters.sortBy !== 'stock_quantity' ? 1 : 0,
  }), [filters]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => onUpdateFilter('search', localSearch), 300);
    return () => clearTimeout(t);
  }, [localSearch]);

  // Debounce quantity
  useEffect(() => {
    const t = setTimeout(() => {
      const num = parseInt(quantityInput) || 0;
      onUpdateFilter('minQuantityNeeded', num > 0 ? num : undefined);
    }, 500);
    return () => clearTimeout(t);
  }, [quantityInput]);

  const activeFiltersCount = [
    filters.status !== 'all',
    !!filters.categoryId,
    !!filters.supplierId,
    !!filters.colorName || !!filters.colorGroup,
    !!filters.minQuantityNeeded && filters.minQuantityNeeded > 0,
    filters.showOnlyWithAlerts,
    !!filters.search,
  ].filter(Boolean).length;

  const handleReset = () => {
    setLocalSearch('');
    setQuantityInput('');
    onResetFilters();
  };

  return (
    <div className="space-y-3">
      {/* Row 1: Search + Quick Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* 1. Advanced Filters Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="default" className={cn("gap-2 relative", activeFiltersCount > 0 && "border-primary/50 bg-primary/5")}>
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Filtros</span>
              {activeFiltersCount > 0 && (
                <Badge className="bg-primary text-primary-foreground h-5 min-w-5 text-[10px] px-1.5 animate-in zoom-in-50">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="max-h-[70vh] overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent">
              {/* Header with Reset + Fechar */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/40">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filtros Avançados
                  {activeFiltersCount > 0 && (
                    <span className="text-xs text-muted-foreground font-normal">
                      ({filteredCount} de {totalProducts})
                    </span>
                  )}
                </h4>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    disabled={activeFiltersCount === 0}
                    className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground px-2"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </Button>
                  <PopoverClose asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2.5">
                      Fechar
                    </Button>
                  </PopoverClose>
                </div>
              </div>

              {/* FilterSection: Cores */}
              <FilterSection
                id="cores"
                title="Cores"
                icon={<Palette className="h-4 w-4" />}
                openSections={openSections}
                onToggle={toggleSection}
                activeCount={sectionCounts.cores}
                activeSummary={filters.colorGroup || filters.colorName}
              >
                <InlineColorGroupFilter
                  selection={{ groups: filters.colorGroup ? [filters.colorGroup] : [], variations: [], nuances: [] }}
                  onChange={(sel) => {
                    const selected = sel.groups.length > 0 ? sel.groups[sel.groups.length - 1] : undefined;
                    onUpdateFilter('colorGroup', selected);
                    onUpdateFilter('colorName', undefined);
                  }}
                  showNuances={false}
                  showVariations={false}
                  swatchSize="sm"
                />
              </FilterSection>

              {/* FilterSection: Categorias */}
              <FilterSection
                id="categorias"
                title="Categorias"
                icon={<LayoutGrid className="h-4 w-4" />}
                openSections={openSections}
                onToggle={toggleSection}
                activeCount={sectionCounts.categorias}
                activeSummary={filters.categoryId}
              >
                <ExternalCategoryFilter
                  selectedCategories={filters.categoryId ? [filters.categoryId] : []}
                  onCategoriesChange={(cats) => onUpdateFilter('categoryId', cats.length > 0 ? cats[cats.length - 1] : undefined)}
                  compact
                />
              </FilterSection>

              {/* FilterSection: Estoque */}
              <FilterSection
                id="estoque"
                title="Estoque"
                icon={<Package className="h-4 w-4" />}
                openSections={openSections}
                onToggle={toggleSection}
                activeCount={sectionCounts.estoque}
                activeSummary={filters.minQuantityNeeded ? `≥${filters.minQuantityNeeded}` : undefined}
              >
                <div className="px-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground text-xs whitespace-nowrap">Mínimo por cor</span>
                    <DebouncedPriceInput
                      value={filters.minQuantityNeeded || ''}
                      onChange={(v) => onUpdateFilter('minQuantityNeeded', v > 0 ? v : undefined)}
                      fallback={0}
                      placeholder="Ex: 500"
                      min={0}
                      className={filters.minQuantityNeeded && filters.minQuantityNeeded > 0 ? 'border-orange/60' : ''}
                    />
                    <span className="text-muted-foreground text-xs">un.</span>
                  </div>
                </div>
              </FilterSection>

              {/* FilterSection: Fornecedores */}
              <FilterSection
                id="fornecedores"
                title="Fornecedores"
                icon={<Truck className="h-4 w-4" />}
                openSections={openSections}
                onToggle={toggleSection}
                activeCount={sectionCounts.fornecedores}
                activeSummary={filters.supplierId}
              >
                <Select
                  value={filters.supplierId || '__all__'}
                  onValueChange={(v) => onUpdateFilter('supplierId', v === '__all__' ? undefined : v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Todos os fornecedores" />
                  </SelectTrigger>
                  <SelectContent className="max-h-48 overflow-y-auto">
                    <SelectItem value="__all__" className="text-xs">Todos ({totalProducts})</SelectItem>
                    {suppliers.map(s => (
                      <SelectItem key={s.name} value={s.name} className="text-xs">
                        {s.name} ({s.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterSection>

              {/* Alerts toggle */}
              <div className="flex items-center justify-between px-3 py-2.5 border-t border-border/40">
                <Label className="text-xs flex items-center gap-1.5 cursor-pointer">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                  Somente com alertas
                </Label>
                <Switch
                  checked={filters.showOnlyWithAlerts}
                  onCheckedChange={(v) => onUpdateFilter('showOnlyWithAlerts', v)}
                />
              </div>

              {/* FilterSection: Ordenação */}
              <FilterSection
                id="ordenacao"
                title="Ordenar por"
                icon={<Filter className="h-4 w-4" />}
                openSections={openSections}
                onToggle={toggleSection}
              >
                <Select
                  value={filters.sortBy}
                  onValueChange={(v) => onUpdateFilter('sortBy', v as StockFilters['sortBy'])}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stock_quantity">Menor Estoque</SelectItem>
                    <SelectItem value="name">Nome (A-Z)</SelectItem>
                    <SelectItem value="available_stock">Disponibilidade</SelectItem>
                    <SelectItem value="days_remaining">Dias Restantes</SelectItem>
                  </SelectContent>
                </Select>
              </FilterSection>
            </div>
          </PopoverContent>
        </Popover>

        {/* 2. Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar no Estoque (Nome, SKU ou Cor)... "
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-9 pr-8"
          />
          {localSearch && (
            <button onClick={() => setLocalSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* 3. Smart Quantity Filter (Tiragem) */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative w-full sm:w-48">
                <ShoppingCart className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="Preciso de X un..."
                  value={quantityInput}
                  onChange={(e) => setQuantityInput(e.target.value)}
                  className="pl-9"
                  min={0}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[250px]">
              <p className="text-xs">
                <strong>Filtro de tiragem:</strong> mostra apenas produtos com estoque disponível ≥ a quantidade informada. 
                Ideal para verificar se há estoque suficiente para um pedido.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {activeFiltersCount > 0 && (
          <Button variant="ghost" onClick={handleReset} size="icon" className="shrink-0">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Status chips removed — StatCards above handle status filtering */}

      {/* Active Filters Badges */}
      <AnimatePresence>
        {activeFiltersCount > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-wrap gap-1.5 overflow-hidden"
          >
            {filters.categoryId && (
              <Badge variant="secondary" className="gap-1 text-xs pr-1">
                <LayoutGrid className="h-3 w-3" />
                Categoria
                <button onClick={() => onUpdateFilter('categoryId', undefined)} className="ml-0.5 hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.supplierId && (
              <Badge variant="secondary" className="gap-1 text-xs pr-1">
                <Building2 className="h-3 w-3" />
                {filters.supplierId}
                <button onClick={() => onUpdateFilter('supplierId', undefined)} className="ml-0.5 hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {(filters.colorName || filters.colorGroup) && (
              <Badge variant="secondary" className="gap-1 text-xs pr-1">
                <Palette className="h-3 w-3" />
                {filters.colorName || filters.colorGroup}
                <button onClick={() => { onUpdateFilter('colorName', undefined); onUpdateFilter('colorGroup', undefined); }} className="ml-0.5 hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.minQuantityNeeded && filters.minQuantityNeeded > 0 && (
              <Badge variant="secondary" className="gap-1 text-xs pr-1">
                <ShoppingCart className="h-3 w-3" />
                ≥ {filters.minQuantityNeeded} un
                <button onClick={() => { setQuantityInput(''); onUpdateFilter('minQuantityNeeded', undefined); }} className="ml-0.5 hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.showOnlyWithAlerts && (
              <Badge variant="secondary" className="gap-1 text-xs pr-1">
                <AlertTriangle className="h-3 w-3" />
                Com alertas
                <button onClick={() => onUpdateFilter('showOnlyWithAlerts', false)} className="ml-0.5 hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}

            <span className="text-xs text-muted-foreground flex items-center ml-1">
              <Sparkles className="h-3 w-3 mr-1" />
              {filteredCount} de {totalProducts} produtos
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
