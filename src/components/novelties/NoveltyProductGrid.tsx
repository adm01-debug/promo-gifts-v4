import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Package,
  ArrowUpDown,
  Building2,
  FolderTree,
  X,
  Sparkles,
  Search,
  CheckSquare,
  Loader2,
} from 'lucide-react';
import {
  useNoveltiesSelectionMode,
  useNoveltiesWithDetails,
  sortNovelties,
} from '@/hooks/products';
import { useProductsColorsBatch } from '@/hooks/products/useProductsColorsBatch';
import { ProductCardSkeleton } from '@/components/loading/ModernSkeletons';
import { NoveltyCardSkeleton } from './NoveltyCardSkeleton';
import { LayoutPopover } from '@/components/products/LayoutPopover';
import { getDefaultColumns, type ColumnCount } from '@/components/products/ColumnSelector';
import { BulkActionBar } from '@/components/products/BulkActionBar';
import { BulkVariantWizard } from '@/components/catalog/BulkVariantWizard';
import { BulkAddToCartModal } from '@/components/catalog/BulkAddToCartModal';
import { AddToCollectionModal } from '@/components/collections/AddToCollectionModal';
import { ProductListItem } from '@/components/products/ProductListItem';
import { SelectionCheckbox } from '@/components/common/SelectionCheckbox';
import { useFavoritesStore } from '@/stores/useFavoritesStore';
import { useComparisonStore } from '@/stores/useComparisonStore';
import { cn } from '@/lib/utils';
import { AnimatePresence, m as motion } from 'framer-motion';
import { NoveltyTableView } from './NoveltyCards';
import { VirtualizedNoveltyGrid } from './VirtualizedNoveltyGrid';
import { getGridColsClass, getGridGapClass } from '@/components/replenishments/grid-layout';
import { SORT_OPTIONS } from '@/constants/filters';

import { logger } from '@/lib/logger';
type ViewMode = 'grid' | 'list' | 'table';

export function NoveltyProductGrid() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [gridColumns, setGridColumns] = useState<ColumnCount>(getDefaultColumns);
  const [sortMode, setSortMode] = useState<string>('newest');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [visibleCount, setVisibleCount] = useState(40);
  const [scrollToken, setScrollToken] = useState(0);
  const pageSize = 20;
  // BUG-SCROLL-03 FIX: guard local para evitar que o IntersectionObserver
  // do sentinel dispare múltiplos setVisibleCount antes do re-render React.
  // O `isLoading: isFetching` só cobre o fetch do React Query, não a
  // paginação local — sem este guard, visibleCount saltava em múltiplos de
  // pageSize em um único "batch" do React 18, causando expansão abrupta do
  // grid e snap visual do conteúdo.
  const isLoadingMoreLocalRef = useRef(false);
  // Timer do guard — guardado em ref para cleanup no unmount (evita
  // set-state/ref-write após desmontar e leak do timeout).
  const guardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // FIX (auditoria Novidades, P1-B): sem teto fixo. Antes `{ limit: 400 }`
  // truncava o grid quando havia mais de 400 novidades ativas (ex.: 550 -> 150
  // produtos, incl. fornecedores inteiros, invisiveis; e o contador divergia do
  // card "Novidades Ativas"). O hook agora pagina o conjunto completo da janela.
  const { data: novelties, isLoading, isFetching, error } = useNoveltiesWithDetails();
  const products = useMemo(() => novelties || [], [novelties]);

  const [loadingProgress, setLoadingProgress] = useState(0);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isFetching) {
      setLoadingProgress(0);
      progressRef.current = setInterval(() => {
        setLoadingProgress((prev) => {
          if (prev >= 99) return 99;
          if (prev >= 85) return prev + 0.3;
          return prev + Math.random() * 12 + 3;
        });
      }, 300);
    } else {
      if (progressRef.current) clearInterval(progressRef.current);
      setLoadingProgress(100);
      const t = setTimeout(() => setLoadingProgress(0), 800);
      return () => clearTimeout(t);
    }
    return () => {
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [isFetching]);

  const { suppliers, categories } = useMemo(() => {
    const supMap = new Map<string, { id: string; name: string; count: number }>();
    const catMap = new Map<string, { id: string; name: string; count: number }>();
    products.forEach((p) => {
      if (p.supplier_id) {
        const name = p.supplier_name || `Fornecedor ${p.supplier_id.slice(0, 6)}`;
        const e = supMap.get(p.supplier_id);
        if (e) e.count++;
        else supMap.set(p.supplier_id, { id: p.supplier_id, name, count: 1 });
      }
      if (p.category_id && p.category_name) {
        const e = catMap.get(p.category_id);
        if (e) e.count++;
        else catMap.set(p.category_id, { id: p.category_id, name: p.category_name, count: 1 });
      }
    });
    return {
      suppliers: [...supMap.values()].sort((a, b) => b.count - a.count),
      categories: [...catMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    let filtered = [...products];
    if (searchQuery.trim()) {
      // FIX 2026-06-15 (novidades-search-accent): normaliza acento em ambos os lados
      // antes de comparar — espelha o stripAccents do postgrest.ts (PR #750).
      // Escopo INALTERADO: busca somente nas novidades já carregadas em memória.
      const norm = (s: string) =>
        s
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
      const q = norm(searchQuery.trim());
      filtered = filtered.filter(
        (p) =>
          norm(p.product_name).includes(q) ||
          (p.product_sku && norm(p.product_sku).includes(q)) ||
          (p.supplier_name && norm(p.supplier_name).includes(q)),
      );
    }
    if (selectedSupplier !== 'all')
      filtered = filtered.filter((p) => p.supplier_id === selectedSupplier);
    if (selectedCategory !== 'all')
      filtered = filtered.filter((p) => p.category_id === selectedCategory);
    // FIX (auditoria Novidades, P1): ordena pelos campos REAIS de
    // NoveltyWithDetails. Antes `sortProducts(... as Product[])` era no-op
    // silencioso (formas divergentes) e "Mais recentes" caía em A-Z.
    sortNovelties(filtered, sortMode);
    return filtered;
  }, [products, selectedSupplier, selectedCategory, sortMode, searchQuery]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(40);
    setScrollToken((prev) => prev + 1);
    // GAP-11 FIX: libera o guard ao trocar de filtro para que o primeiro
    // load-more do novo conjunto não fique bloqueado pelos 150ms residuais.
    if (guardTimerRef.current) {
      clearTimeout(guardTimerRef.current);
      guardTimerRef.current = null;
    }
    isLoadingMoreLocalRef.current = false;
    // GAP-SEL FIX: descarta seleção stale ao mudar filtros em modo de seleção.
    // Sem isso, produtos selecionados antes do filtro continuam marcados após
    // trocar o conjunto visível, criando ação em lote sobre itens invisíveis.
    if (selectionMode) sel.clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedSupplier, selectedCategory, sortMode]);

  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleCount);
  }, [filteredProducts, visibleCount]);
  const hasMore = visibleCount < filteredProducts.length;
  // Handler estável para carregar mais itens quando o wrapper virtualizado
  // chega perto do fim do scroll interno.
  const handleLoadMore = useCallback(() => {
    if (isLoadingMoreLocalRef.current) return; // Guard: evita cascata de increments
    isLoadingMoreLocalRef.current = true;
    setVisibleCount((prev) => prev + pageSize);
    // Libera o guard após o próximo ciclo de render (suficiente para o
    // IntersectionObserver recalcular com o DOM atualizado). GAP-8: o timer
    // fica em ref para ser limpo no unmount.
    if (guardTimerRef.current) clearTimeout(guardTimerRef.current);
    guardTimerRef.current = setTimeout(() => {
      isLoadingMoreLocalRef.current = false;
      guardTimerRef.current = null;
    }, 150);
  }, [pageSize]);

  // GAP-8 FIX: limpa o timer do guard ao desmontar para evitar callback órfão.
  useEffect(() => {
    return () => {
      if (guardTimerRef.current) clearTimeout(guardTimerRef.current);
    };
  }, []);

  const sel = useNoveltiesSelectionMode({ selectionMode, filteredProducts });
  const hasActiveFilters =
    selectedSupplier !== 'all' ||
    selectedCategory !== 'all' ||
    searchQuery.trim() !== '' ||
    sortMode !== 'newest';
  const handleProductClick = (id: string) => navigate(`/produto/${id}`);
  const clearFilters = () => {
    setSelectedSupplier('all');
    setSelectedCategory('all');
    setSearchQuery('');
    setSortMode('newest');
  };
  if (error) logger.error('Erro ao carregar novidades:', error);

  // Favorites & Compare stores for ProductListItem integration
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const {
    isInCompare,
    addToCompare,
    removeFromCompare,
    canAddMore: canAddToCompare,
  } = useComparisonStore();
  const onToggleCompare = useCallback(
    (productId: string) => {
      if (isInCompare(productId)) {
        removeFromCompare(productId);
        return { added: false, isFull: false };
      }
      const result = addToCompare(productId);
      return { added: !!result, isFull: !canAddToCompare };
    },
    [isInCompare, addToCompare, removeFromCompare, canAddToCompare],
  );

  // Convert novelties to Product for list view
  const productMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof sel.noveltyToProduct>>();
    filteredProducts.forEach((n) => map.set(n.product_id, sel.noveltyToProduct(n)));
    return map;
  }, [filteredProducts, sel]);

  // Batch-load cores das variantes para os produtos visíveis (visualização atual).
  // Grid: apenas paginatedProducts (virtualizados). List/table: todos filtrados,
  // pois todos estão no DOM (sem virtualização no momento).
  const visibleProductIds = useMemo(() => {
    if (viewMode === 'list' || viewMode === 'table') {
      return filteredProducts.map((n) => n.product_id);
    }
    return paginatedProducts.map((n) => n.product_id);
  }, [viewMode, filteredProducts, paginatedProducts]);
  const { data: colorsByProduct } = useProductsColorsBatch(visibleProductIds);

  const renderContent = () => {
    if (isLoading && products.length === 0) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm text-muted-foreground">
              Carregando {Math.round(loadingProgress)}% dos produtos...
            </span>
          </div>
          <div className="mb-6 h-1.5 w-64 overflow-hidden rounded-full bg-muted/50">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary"
              initial={{ width: 0 }}
              animate={{ width: `${loadingProgress}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
          <div
            data-testid="novelty-loading-grid"
            // Reserva altura mínima do bloco da lista durante o loading para que
            // a transição skeleton→cards não cause oscilação na medição do
            // virtualizer.
            style={{ minHeight: viewMode === 'list' ? 600 : 1260 }}
            className={cn(
              'grid',
              viewMode === 'list'
                ? 'grid-cols-1 gap-2'
                : `${getGridColsClass(gridColumns)} ${getGridGapClass(gridColumns)}`,
            )}
          >
            {Array.from({ length: 15 }).map((_, i) =>
              viewMode === 'list' ? (
                <div key={i} data-testid="novelty-loading-card">
                  <ProductCardSkeleton variant="compact" />
                </div>
              ) : (
                <NoveltyCardSkeleton key={i} />
              ),
            )}
          </div>
        </div>
      );
    }
    if (filteredProducts.length === 0) {
      return (
        <div className="py-10 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/80">
            <Package className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {hasActiveFilters
              ? 'Nenhuma novidade com esses filtros'
              : 'Nenhuma novidade encontrada'}
          </p>
          {hasActiveFilters ? (
            <Button variant="link" className="mt-1 text-xs" onClick={clearFilters}>
              Limpar filtros
            </Button>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground/70">
              Produtos novos aparecerão aqui automaticamente
            </p>
          )}
        </div>
      );
    }
    if (viewMode === 'table')
      return (
        <NoveltyTableView
          products={filteredProducts}
          selectionMode={selectionMode}
          selectedIds={[...sel.selectedIds]}
          onSelect={(id) => {
            if (selectionMode) {
              sel.toggleSelect(id);
              return;
            }
            handleProductClick(id);
          }}
          colorsByProduct={colorsByProduct}
          onStatusClick={(type) => {
            if (type === 'novelty') return; // already on novelty page
            if (type === 'promotion') navigate('/filtros?onSale=1');
            if (type === 'featured') navigate('/filtros?featured=1');
            if (type === 'kit') navigate('/filtros?isKit=1');
          }}
        />
      );
    const effectiveCols = Math.min(gridColumns, filteredProducts.length) as ColumnCount;

    if (viewMode === 'list') {
      return (
        <div className="space-y-2">
          {filteredProducts.map((novelty, index) => {
            const prodBase = productMap.get(novelty.product_id);
            if (!prodBase) return null;
            const batchColors = colorsByProduct?.get(novelty.product_id);
            const prod =
              batchColors && batchColors.length > 0
                ? {
                    ...prodBase,
                    colors: batchColors.map((c) => ({
                      name: c.name,
                      hex: c.hex || '',
                      group: '',
                    })),
                  }
                : prodBase;
            const isSelected = sel.selectedIds.has(novelty.product_id);
            return (
              <div
                key={novelty.novelty_id}
                className="stagger-item"
                style={{ animationDelay: `${Math.min(index * 25, 250)}ms` }}
              >
                <div
                  className={cn(
                    'flex items-center gap-1',
                    isSelected && 'rounded-xl ring-2 ring-primary',
                  )}
                >
                  {selectionMode && (
                    <div className="ml-1 flex-shrink-0">
                      <SelectionCheckbox
                        checked={isSelected}
                        onChange={() => sel.toggleSelect(novelty.product_id)}
                        size="md"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <ProductListItem
                      product={prod}
                      onClick={() =>
                        selectionMode
                          ? sel.toggleSelect(novelty.product_id)
                          : handleProductClick(novelty.product_id)
                      }
                      isFavorited={isFavorite(novelty.product_id)}
                      onToggleFavorite={toggleFavorite}
                      isInCompare={isInCompare(novelty.product_id)}
                      onToggleCompare={onToggleCompare}
                      canAddToCompare={canAddToCompare}
                      isNovelty={true}
                      noveltyDaysRemaining={novelty.days_remaining}
                      priority={index < 6}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <VirtualizedNoveltyGrid
        products={paginatedProducts}
        gridColumns={effectiveCols}
        selectionMode={selectionMode}
        selectedIds={sel.selectedIds}
        onToggleSelect={sel.toggleSelect}
        onProductClick={handleProductClick}
        colorsByProduct={colorsByProduct}
        hasMore={hasMore}
        isLoadingMore={isFetching}
        onLoadMore={handleLoadMore}
        scrollToTopToken={scrollToken}
        onStatusClick={(type) => {
          if (type === 'novelty') return;
          if (type === 'promotion') navigate('/filtros?onSale=1');
          if (type === 'featured') navigate('/filtros?featured=1');
          if (type === 'kit') navigate('/filtros?isKit=1');
        }}
      />
    );
  };

  return (
    <div className="space-y-3">
      {/* Toolbar — sticky logo abaixo do cabeçalho+KPIs (CSS var setada pela NoveltiesPage) */}
      <div className="sticky top-[calc(var(--header-h,56px)+var(--breadcrumb-h,0px)+var(--novelty-sticky-h,160px))] z-20 flex flex-col gap-2 rounded-xl border border-border/40 bg-background/95 px-3 py-2 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <h2 className="whitespace-nowrap text-[17px] font-semibold text-primary sm:text-[20px]">
              Novidades
            </h2>
            <Badge
              variant="outline"
              className="shrink-0 border-primary/40 bg-primary/10 px-1.5 text-[11px] font-semibold tabular-nums text-primary"
            >
              {isLoading && products.length === 0 ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  carregando...
                </span>
              ) : (
                <>
                  {filteredProducts.length}
                  {hasActiveFilters && <span className="text-primary/60">/{products.length}</span>}
                </>
              )}
            </Badge>
            <AnimatePresence>
              {isFetching && loadingProgress > 0 && loadingProgress < 100 && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 48 }}
                  exit={{ opacity: 0, width: 0 }}
                  className="ml-1 inline-flex items-center gap-1"
                >
                  <span className="inline-block h-1 w-[53px] overflow-hidden rounded-full bg-muted/50 align-middle">
                    <motion.span
                      className="block h-full rounded-full bg-primary/60"
                      initial={{ width: 0 }}
                      animate={{ width: `${loadingProgress}%` }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                    />
                  </span>
                  <span className="text-[11px] tabular-nums text-muted-foreground/60">
                    {Math.round(loadingProgress)}%
                  </span>
                </motion.span>
              )}
            </AnimatePresence>

            {/* Search inline — mesmo padrão do CatalogHeader */}
            <div className="hidden w-[27.5rem] sm:block lg:w-[27.5rem]">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar novidades…  /"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 border-border/50 bg-muted/40 pl-8 text-[13px] focus:bg-background"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
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
            onClick={() => {
              setSelectionMode(!selectionMode);
              if (selectionMode) sel.clearSelection();
            }}
          >
            <CheckSquare className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{selectionMode ? 'Cancelar' : 'Selecionar'}</span>
          </Button>
          <LayoutPopover
            viewMode={viewMode}
            setViewMode={setViewMode}
            gridColumns={gridColumns}
            setGridColumns={setGridColumns}
          />
        </div>

        {/* Search full-width on mobile */}
        <div className="flex w-full items-center gap-2 sm:hidden">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar novidades..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 border-border/50 bg-muted/40 pl-8 text-[13px] focus:bg-background"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
            <SelectTrigger className="h-8 w-[176px] gap-1 text-[12px]">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
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
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="h-8 w-[176px] gap-1 text-[12px]">
              <FolderTree className="h-3.5 w-3.5 shrink-0" />
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
          <Select value={sortMode} onValueChange={(v) => setSortMode(v)}>
            <SelectTrigger className="h-8 w-[198px] gap-1 text-[12px]">
              <ArrowUpDown className="h-3.5 w-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.filter((o) => !o.value.startsWith('best-seller')).map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-[12px] text-muted-foreground hover:text-foreground"
              onClick={clearFilters}
            >
              <X className="mr-0.5 h-3 w-3" />
              Limpar
            </Button>
          )}
        </div>

        {hasActiveFilters && (
          <div className="flex flex-wrap gap-1" role="list" aria-label="Filtros ativos">
            {searchQuery.trim() && (
              <Badge
                role="listitem"
                variant="secondary"
                className="h-5 cursor-pointer gap-0.5 text-[10px] hover:bg-destructive/10"
                onClick={() => setSearchQuery('')}
              >
                <Search className="h-2.5 w-2.5" />"{searchQuery}"<X className="h-2.5 w-2.5" />
              </Badge>
            )}
            {selectedSupplier !== 'all' && (
              <Badge
                role="listitem"
                variant="secondary"
                className="h-5 cursor-pointer gap-0.5 text-[10px] hover:bg-destructive/10"
                onClick={() => setSelectedSupplier('all')}
              >
                <Building2 className="h-2.5 w-2.5" />
                {suppliers.find((s) => s.id === selectedSupplier)?.name}
                <X className="h-2.5 w-2.5" />
              </Badge>
            )}
            {selectedCategory !== 'all' && (
              <Badge
                role="listitem"
                variant="secondary"
                className="h-5 cursor-pointer gap-0.5 text-[10px] hover:bg-destructive/10"
                onClick={() => setSelectedCategory('all')}
              >
                <FolderTree className="h-2.5 w-2.5" />
                {categories.find((c) => c.id === selectedCategory)?.name}
                <X className="h-2.5 w-2.5" />
              </Badge>
            )}
          </div>
        )}
      </div>

      {!isLoading && filteredProducts.length > 0 && hasActiveFilters && (
        <p className="text-[11px] text-muted-foreground">
          Mostrando <span className="font-medium text-foreground">{filteredProducts.length}</span>{' '}
          de {products.length} novidades
        </p>
      )}

      <div className="relative">
        {renderContent()}
        <AnimatePresence>
          {isFetching && products.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
            >
              <div className="flex items-center gap-2 rounded-full border bg-background/90 px-4 py-2 shadow-sm">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm text-muted-foreground">Atualizando...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sentinela do scroll infinito + indicador de carregamento */}
      {hasMore && (
        <div className="flex justify-center py-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando mais novidades...
          </div>
        </div>
      )}

      {selectionMode && (
        <BulkActionBar
          selectedCount={sel.selectedCount}
          totalCount={filteredProducts.length}
          onSelectAll={sel.selectAll}
          onClearSelection={sel.clearSelection}
          onBulkFavorite={sel.handleBulkFavorite}
          onBulkCompare={sel.handleBulkCompare}
          onBulkCollection={sel.handleBulkCollection}
          onBulkCart={sel.handleBulkCart}
          onBulkQuote={sel.handleBulkQuote}
        />
      )}
      <BulkVariantWizard
        open={sel.variantWizardOpen}
        onOpenChange={sel.setVariantWizardOpen}
        products={sel.selectedProducts}
        mode={sel.wizardMode}
        onComplete={sel.handleWizardComplete}
      />
      <BulkAddToCartModal
        open={sel.cartModalOpen}
        onOpenChange={sel.setCartModalOpen}
        products={sel.bulkCartProducts}
        variantSelections={sel.wizardSelections}
        onDone={sel.clearSelection}
      />
      <AddToCollectionModal
        open={sel.collectionModalOpen}
        onOpenChange={sel.setCollectionModalOpen}
        productId={sel.firstSelectedId}
        productName={sel.firstSelectedProduct?.product_name ?? ''}
      />
    </div>
  );
}
