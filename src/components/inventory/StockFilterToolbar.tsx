/**
 * StockFilterToolbar — Advanced filter bar for Stock Dashboard
 * Uses same FilterSection architecture as Super Filtro
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Building2,
  Palette,
  ShoppingCart,
  AlertTriangle,
  SlidersHorizontal,
  Sparkles,
  LayoutGrid,
  Filter,
  Truck,
  RotateCcw,
  Loader2,
  TrendingDown,
} from 'lucide-react';
import { useRuptureHorizon } from '@/hooks/stock/useRuptureHorizon';
import { RUPTURE_HORIZON_OPTIONS } from '@/lib/inventory/rupture-risk';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger, PopoverClose } from '@/components/ui/popover';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { InlineColorGroupFilter } from '@/components/filters/InlineColorGroupFilter';
import { ExternalCategoryFilter } from '@/components/filters/ExternalCategoryFilter';
import { FilterSection } from '@/components/filters/filter-panel/FilterSection';
import { StockHelpTooltip } from '@/components/inventory/StockHelpTooltip';
import type { StockFilters } from '@/types/stock';
import { m as motion, AnimatePresence } from 'framer-motion';
import {
  useFutureStockPreference,
  useFutureStockShortcut,
  FUTURE_STOCK_WINDOWS,
  type FutureStockWindow,
} from '@/hooks/useFutureStockPreference';

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
  /**
   * Estado do filtro dimensional "Risco de Ruptura" — controlado pelo
   * StockDashboard. Quando true, a tabela mostra só SKUs em risco e o
   * botão exibe o badge "Nd" + estilo ativo (espelho do Estoque Futuro).
   */
  isRuptureRiskActive?: boolean;
  /** Quantidade de SKUs em risco (filtrada por horizonte) — gate do Switch + badge. */
  ruptureRiskCount?: number;
  /** Callback de toggle on/off do filtro de Risco de Ruptura. */
  onToggleRuptureRisk?: (active: boolean) => void;
}

export function StockFilterToolbar({
  filters,
  onUpdateFilter,
  onResetFilters,
  categories: _categories,
  suppliers,
  colors: _colors,
  colorGroups: _colorGroups,
  totalProducts,
  filteredCount,
  isRuptureRiskActive = false,
  ruptureRiskCount = 0,
  onToggleRuptureRisk,
}: StockFilterToolbarProps) {
  const [localSearch, setLocalSearch] = useState(filters.search);
  const [quantityInput, setQuantityInput] = useState(filters.minQuantityNeeded?.toString() ?? '');
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [ruptureHorizon, setRuptureHorizon] = useRuptureHorizon();

  // Persistência da preferência "Estoque Futuro" (toggle + janela) em localStorage.
  useFutureStockPreference(
    {
      includeFutureStock: !!filters.includeFutureStock,
      futureStockWindowDays: (filters.futureStockWindowDays ?? 15) as FutureStockWindow,
    },
    (pref) => {
      onUpdateFilter('includeFutureStock', pref.includeFutureStock);
      onUpdateFilter('futureStockWindowDays', pref.futureStockWindowDays);
    },
  );

  // ============================================================
  // SSOT — Sincronização "Estoque Futuro" ↔ régua de quantidade
  // ============================================================
  // Em /estoque a seção "Estoque" do popover foi REMOVIDA (redundante com
  // o toggle do toolbar). Para evitar regressão de UX entre /estoque e o
  // Super Filtro (/filtros), o toggle do toolbar passa a controlar duas
  // flags ao mesmo tempo:
  //
  //   • filters.includeFutureStock         → liga/desliga "Estoque Futuro"
  //   • filters.minQtyIncludesFutureStock  → faz a régua "Preciso de X un"
  //                                          considerar também o estoque
  //                                          futuro (em vez de só o atual).
  //
  // Sem esse espelhamento, o usuário ligava "Estoque Futuro" mas a régua
  // continuava estrita (filtrando só pelo on-hand) — provocando o hint
  // "régua estrita" testado em stock-filters-no-text.spec.ts.
  //
  // ⚠️ O Super Filtro (/filtros) mantém a seção "Estoque" no sidebar
  //    (FilterPanel.tsx → renderer 'estoque') porque lá o toggle global
  //    de Estoque Futuro não existe — o controle é feito dentro da seção.
  //    NÃO remover a seção 'estoque' do Super Filtro: ver
  //    src/components/filters/filter-panel/types.ts (SECTION_GROUPS) e o
  //    spec super-filtro-estoque-section.spec.ts.
  const setIncludeFutureStock = (v: boolean) => {
    onUpdateFilter('includeFutureStock', v);
    onUpdateFilter('minQtyIncludesFutureStock', v);
  };

  // Atalho: Shift+F alterna inclusão do Estoque Futuro.
  useFutureStockShortcut(() => {
    setIncludeFutureStock(!filters.includeFutureStock);
  });

  // Accordion behavior: only one section open at a time
  const toggleSection = (id: string) => {
    setOpenSections((prev) => (prev.includes(id) ? [] : [id]));
  };

  // Section active counts
  const sectionCounts = useMemo(
    () => ({
      cores: (filters.colorGroup ? 1 : 0) + (filters.colorName ? 1 : 0),
      categorias: filters.categoryId ? 1 : 0,
      // estoque: removido — minQuantityNeeded agora vive só no input do toolbar
      fornecedores: filters.supplierId ? 1 : 0,
      ordenacao: filters.sortBy !== 'stock_quantity' ? 1 : 0,
    }),
    [filters],
  );

  // Search é commit-on-Enter / botão Busca (não há mais debounce).
  // Mantém sincronia quando filtros são resetados externamente.
  useEffect(() => {
    setLocalSearch(filters.search ?? '');
  }, [filters.search]);

  // Loading transitório enquanto a busca é aplicada (UX feedback).
  const [isSearching, setIsSearching] = useState(false);
  const commitSearch = useCallback(() => {
    setIsSearching(true);
    onUpdateFilter('search', localSearch);
  }, [localSearch, onUpdateFilter]);

  // Encerra o loading assim que o filtro externo reflete o valor digitado
  // (ou após 600ms como fallback de segurança).
  useEffect(() => {
    if (!isSearching) return;
    if ((filters.search ?? '') === localSearch) {
      setIsSearching(false);
      return;
    }
    const t = setTimeout(() => setIsSearching(false), 600);
    return () => clearTimeout(t);
  }, [isSearching, filters.search, localSearch]);

  // Debounce quantity
  useEffect(() => {
    const t = setTimeout(() => {
      const num = parseInt(quantityInput, 10) || 0;
      onUpdateFilter('minQuantityNeeded', num > 0 ? num : undefined);
    }, 500);
    return () => clearTimeout(t);
  }, [quantityInput, onUpdateFilter]);

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
    // Evita ficar com aria-busy="true" / spinner travado se o usuário
    // resetar logo após clicar em "Busca" (race entre commit e reset).
    setIsSearching(false);
    onResetFilters();
  };

  return (
    <div className="space-y-3">
      {/* Row 1: Search + Quick Filters */}
      <div className="flex flex-col gap-2 sm:flex-row">
        {/* 1. Advanced Filters Popover */}
        <Popover>
          <StockHelpTooltip
            title="Filtros"
            description="Refine por categoria, fornecedor, cor ou status."
            example="Canecas + Azul = só canecas azuis."
            emptyHint="Sem resultado? Remova um filtro por vez."
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="default"
                className={cn(
                  'relative gap-2',
                  activeFiltersCount > 0 && 'border-primary/50 bg-primary/5',
                )}
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="hidden sm:inline">Filtros</span>
                {activeFiltersCount > 0 && (
                  <Badge className="h-5 min-w-5 bg-primary px-1.5 text-[10px] text-primary-foreground animate-in zoom-in-50">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
          </StockHelpTooltip>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent max-h-[70vh] overflow-y-auto overscroll-contain">
              {/* Header with Reset + Fechar */}
              <div className="flex items-center justify-between border-b border-border/40 px-3 py-2.5">
                <h4 className="flex items-center gap-2 text-sm font-semibold">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filtros Avançados
                  {activeFiltersCount > 0 && (
                    <span className="text-xs font-normal text-muted-foreground">
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
                    className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </Button>
                  <PopoverClose asChild>
                    <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs">
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
                  selection={{
                    groups: filters.colorGroup ? [filters.colorGroup] : [],
                    variations: [],
                    nuances: [],
                  }}
                  onChange={(sel) => {
                    const selected =
                      sel.groups.length > 0 ? sel.groups[sel.groups.length - 1] : undefined;
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
                  onCategoriesChange={(cats) =>
                    onUpdateFilter(
                      'categoryId',
                      cats.length > 0 ? cats[cats.length - 1] : undefined,
                    )
                  }
                  compact
                />
              </FilterSection>

              {/* Seção "Estoque" removida: o input "Preciso de X un..." no toolbar
                  já controla minQuantityNeeded e o toggle "Em Estoque / Estoque Futuro"
                  cobre includeFutureStock. minQtyIncludesFutureStock é derivado
                  automaticamente do toggle do toolbar (ver normalização abaixo). */}

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
                  onValueChange={(v) =>
                    onUpdateFilter('supplierId', v === '__all__' ? undefined : v)
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Todos os fornecedores" />
                  </SelectTrigger>
                  <SelectContent className="max-h-48 overflow-y-auto">
                    <SelectItem value="__all__" className="text-xs">
                      Todos ({totalProducts})
                    </SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.name} value={s.name} className="text-xs">
                        {s.name} ({s.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterSection>

              {/* Alerts toggle */}
              <div className="flex items-center justify-between border-t border-border/40 px-3 py-2.5">
                <Label className="flex cursor-pointer items-center gap-1.5 text-xs">
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
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
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

        {/* Botão dedicado: Estoque Futuro */}
        <Popover>
          <StockHelpTooltip
            title="Em Estoque / Estoque Futuro"
            description="Mostre só o que tem agora, ou inclua o que está chegando em 7, 15 ou 30 dias."
            example="Janela 15 dias: vende o que chega até lá."
            emptyHint="Sem chegadas? Aumente para 30 dias."
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="default"
                data-testid="future-stock-toggle-button"
                aria-pressed={!!filters.includeFutureStock}
                aria-label={
                  filters.includeFutureStock
                    ? `Estoque Futuro ativo, janela ${filters.futureStockWindowDays ?? 15} dias. Atalho: Shift+F`
                    : 'Considerando apenas estoque atual. Atalho Shift+F para incluir Estoque Futuro'
                }
                className={cn(
                  'relative gap-2 font-normal text-muted-foreground hover:text-foreground',
                  filters.includeFutureStock &&
                    'border-border/60 text-foreground [&_svg]:text-primary',
                )}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">
                  {filters.includeFutureStock ? 'Estoque Futuro' : 'Em Estoque'}
                </span>
                {filters.includeFutureStock && (
                  <span
                    aria-hidden="true"
                    className="ml-0.5 rounded-sm border border-border/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                  >
                    {filters.futureStockWindowDays ?? 15}d
                  </span>
                )}
              </Button>
            </PopoverTrigger>
          </StockHelpTooltip>
          <PopoverContent className="w-72 p-0" align="start">
            <div className="space-y-2 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <Label
                  htmlFor="future-stock-switch"
                  className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-foreground"
                >
                  <Sparkles className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  Incluir Estoque Futuro
                </Label>
                <Switch
                  id="future-stock-switch"
                  data-testid="future-stock-switch"
                  checked={!!filters.includeFutureStock}
                  onCheckedChange={(v) => setIncludeFutureStock(v)}
                  aria-label="Incluir Estoque Futuro no cálculo"
                />
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">
                {filters.includeFutureStock
                  ? 'Somando o que chega na janela ao estoque atual.'
                  : 'Considerando apenas o que está disponível agora.'}
                <span className="ml-1 opacity-70">Atalho: Shift+F</span>
              </p>
            </div>
            {filters.includeFutureStock && (
              <div className="space-y-1.5 border-t border-border/40 px-3 py-2.5">
                <span
                  id="future-stock-window-label"
                  className="text-[10px] uppercase tracking-wide text-muted-foreground"
                >
                  Janela de chegada
                </span>
                <div
                  role="radiogroup"
                  aria-labelledby="future-stock-window-label"
                  className="grid grid-cols-3 gap-1"
                >
                  {FUTURE_STOCK_WINDOWS.map((d) => {
                    const active = filters.futureStockWindowDays === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        data-testid={`future-stock-window-${d}`}
                        onClick={() => onUpdateFilter('futureStockWindowDays', d)}
                        className={cn(
                          'h-7 rounded-md border text-xs transition-colors',
                          active
                            ? 'border-foreground/30 bg-muted/60 font-medium text-foreground'
                            : 'border-border/40 text-muted-foreground hover:border-border hover:text-foreground',
                        )}
                      >
                        {d} dias
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Risco de Ruptura — horizonte de projeção (3/7/15/30 dias).
            Promovido da tabela para a toolbar logo após "Estoque Futuro",
            seguindo o mesmo design dos demais botões da barra. */}
        <Popover>
          <StockHelpTooltip
            title="Risco de Ruptura"
            description="Ligue para filtrar só SKUs que podem zerar dentro da janela escolhida (3/7/15/30d)."
            example="3 dias = só o que esgota agora. 30 dias = visão ampla."
            emptyHint="Sem SKUs em risco no momento — Switch fica indisponível."
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="default"
                data-testid="rupture-horizon-control"
                aria-pressed={isRuptureRiskActive}
                aria-label={
                  isRuptureRiskActive
                    ? `Risco de Ruptura ativo, janela ${ruptureHorizon} dias`
                    : 'Filtro de Risco de Ruptura desligado'
                }
                className={cn(
                  'relative gap-2 font-normal text-muted-foreground hover:text-foreground',
                  isRuptureRiskActive &&
                    'border-border/60 text-foreground [&_svg]:text-primary',
                )}
              >
                <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Risco</span>
                {isRuptureRiskActive && ruptureRiskCount > 0 && (
                  <span
                    data-testid="rupture-risk-horizon-badge"
                    aria-hidden="true"
                    className="ml-0.5 rounded-sm border border-border/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                  >
                    {ruptureHorizon}d
                  </span>
                )}
              </Button>
            </PopoverTrigger>
          </StockHelpTooltip>
          <PopoverContent className="w-72 p-0" align="start">
            <div className="space-y-2 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <Label
                  htmlFor="rupture-risk-switch"
                  className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-foreground"
                >
                  <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  Mostrar só Risco de Ruptura
                </Label>
                <Switch
                  id="rupture-risk-switch"
                  data-testid="rupture-risk-switch"
                  checked={isRuptureRiskActive}
                  disabled={!onToggleRuptureRisk || ruptureRiskCount === 0}
                  onCheckedChange={(v) => onToggleRuptureRisk?.(v)}
                  aria-label="Filtrar somente SKUs em risco de ruptura"
                />
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">
                {ruptureRiskCount === 0
                  ? 'Nenhum SKU em risco detectado no momento.'
                  : isRuptureRiskActive
                    ? `Mostrando apenas SKUs que podem zerar em ${ruptureHorizon} dias.`
                    : `${ruptureRiskCount} SKU${ruptureRiskCount === 1 ? '' : 's'} em risco — ligue o Switch para filtrar.`}
              </p>
            </div>
            <div className="space-y-1.5 border-t border-border/40 px-3 py-2.5">
              <span
                id="rupture-horizon-label"
                className="text-[10px] uppercase tracking-wide text-muted-foreground"
              >
                Horizonte de projeção
              </span>
              <div
                role="radiogroup"
                aria-labelledby="rupture-horizon-label"
                className="grid grid-cols-4 gap-1"
              >
                {RUPTURE_HORIZON_OPTIONS.map((d) => {
                  const active = ruptureHorizon === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      data-testid={`rupture-horizon-${d}`}
                      onClick={() => setRuptureHorizon(d)}
                      className={cn(
                        'h-7 rounded-md border text-xs transition-colors',
                        active
                          ? 'border-foreground/30 bg-muted/60 font-medium text-foreground'
                          : 'border-border/40 text-muted-foreground hover:border-border hover:text-foreground',
                      )}
                    >
                      {d}d
                    </button>
                  );
                })}
              </div>
            </div>
          </PopoverContent>
        </Popover>


        {/* 2. Smart Quantity Filter (Tiragem) */}
        <StockHelpTooltip
          title="Preciso de X unidades"
          description="Digite a quantidade do pedido. Mostra quem atende agora (🟢), com reposição (🟡) ou não atende (🔴)."
          example="500 → veja quem cobre o pedido."
          emptyHint="Reduza a quantidade ou troque o fornecedor."
        >
          <div className="relative w-full sm:w-48">
            <ShoppingCart className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="number"
              placeholder="Preciso de X un..."
              value={quantityInput}
              onChange={(e) => setQuantityInput(e.target.value)}
              className="pl-9"
              min={0}
            />
          </div>
        </StockHelpTooltip>

        {/* Hint: avisa que a régua está em modo estrito apesar do Estoque Futuro ON */}
        {filters.minQuantityNeeded &&
          filters.minQuantityNeeded > 0 &&
          filters.includeFutureStock &&
          !filters.minQtyIncludesFutureStock && (
            <span
              data-testid="min-qty-strict-hint"
              role="status"
              className="inline-flex items-center gap-1 rounded-md border border-warning/30 bg-warning/10 px-2 py-1 text-[11px] text-warning"
              title="Estamos olhando só o estoque atual. Para contar o que está chegando, abra Filtros → Estoque."
            >
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              Régua estrita: ignora Estoque Futuro
            </span>
          )}

        {/* 3. Search — commit on Enter / botão "Busca" (sem lupa interna) */}
        <StockHelpTooltip
          title="Buscar produto"
          description="Digite nome, SKU ou cor e pressione Enter. Ignora acentos e maiúsculas."
          example='"caneca azul" acha "Caneca cerâmica azul royal".'
          emptyHint="Use menos palavras ou limpe os filtros."
        >
          <div className="relative flex max-w-md flex-1 items-center gap-2">
            <div className="relative flex-1">
              <Input
                placeholder="Buscar no Estoque (Nome, SKU ou Cor)... "
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitSearch();
                  }
                }}
                className="pr-8"
                aria-label="Buscar no Estoque por Nome, SKU ou Cor"
              />
              {localSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setLocalSearch('');
                    onUpdateFilter('search', '');
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Limpar busca"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button
              type="button"
              onClick={commitSearch}
              variant="default"
              size="sm"
              className="shrink-0"
              data-testid="stock-search-button"
              // Habilitado quando há algo a buscar: texto digitado OU
              // pelo menos um filtro ativo (status, categoria, fornecedor,
              // cor, quantidade mínima). Loading desabilita.
              disabled={isSearching || (localSearch.trim() === '' && activeFiltersCount === 0)}
              aria-label="Aplicar busca no estoque"
              aria-busy={isSearching}
              title="Aplicar busca (Enter)"
            >
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              <span>{isSearching ? 'Buscando…' : 'Busca'}</span>
            </Button>
          </div>
        </StockHelpTooltip>

        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            onClick={handleReset}
            size="icon"
            aria-label="Limpar filtros"
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}

        {/* Slot à direita da toolbar — recebe o badge "Atualizado há…" via
            portal do StockDashboard (#stock-toolbar-slot). `ml-auto` empurra
            para o canto direito da barra. */}
        <div
          id="stock-toolbar-slot"
          data-testid="stock-toolbar-slot"
          className="order-last ml-auto flex w-full items-center justify-end sm:w-auto"
        />
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
              <Badge variant="secondary" className="gap-1 pr-1 text-xs">
                <LayoutGrid className="h-3 w-3" />
                Categoria
                <button
                  onClick={() => onUpdateFilter('categoryId', undefined)}
                  className="ml-0.5 hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.supplierId && (
              <Badge variant="secondary" className="gap-1 pr-1 text-xs">
                <Building2 className="h-3 w-3" />
                {filters.supplierId}
                <button
                  onClick={() => onUpdateFilter('supplierId', undefined)}
                  className="ml-0.5 hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {(filters.colorName || filters.colorGroup) && (
              <Badge variant="secondary" className="gap-1 pr-1 text-xs">
                <Palette className="h-3 w-3" />
                {filters.colorName || filters.colorGroup}
                <button
                  onClick={() => {
                    onUpdateFilter('colorName', undefined);
                    onUpdateFilter('colorGroup', undefined);
                  }}
                  className="ml-0.5 hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.minQuantityNeeded && filters.minQuantityNeeded > 0 && (
              <Badge variant="secondary" className="gap-1 pr-1 text-xs">
                <ShoppingCart className="h-3 w-3" />≥ {filters.minQuantityNeeded} un
                <button
                  onClick={() => {
                    setQuantityInput('');
                    onUpdateFilter('minQuantityNeeded', undefined);
                  }}
                  className="ml-0.5 hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.showOnlyWithAlerts && (
              <Badge variant="secondary" className="gap-1 pr-1 text-xs">
                <AlertTriangle className="h-3 w-3" />
                Com alertas
                <button
                  onClick={() => onUpdateFilter('showOnlyWithAlerts', false)}
                  className="ml-0.5 hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}

            <span className="ml-1 flex items-center text-xs text-muted-foreground">
              <Sparkles className="mr-1 h-3 w-3" />
              {filteredCount} de {totalProducts} produtos
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
