import { ProductCard } from './ProductCard';
import type { Product } from '@/types/product-catalog';
import type { ActiveColorFilter } from '@/utils/color-image-resolver';
import { useEffect, useState, useRef, useMemo, memo } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useReducedMotion } from '@/hooks/ui/useReducedMotion';
import { SelectionCheckbox } from '@/components/common/SelectionCheckbox';
import { cn } from '@/lib/utils';
import { ProductCardSkeleton } from '@/components/loading/ModernSkeletons';
import { useProductsColorsBatch } from '@/hooks/products/useProductsColorsBatch';
import { useColorEnrichment } from '@/hooks/products/useColorEnrichment';

import { logger } from '@/lib/logger';
export interface ProductGridProps {
  products: Product[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onProductClick?: (productId: string) => void;
  onViewProduct?: (product: Product) => void;
  onShareProduct?: (product: Product) => void;
  onFavoriteProduct?: (product: Product) => void;
  isFavorite?: (productId: string) => boolean;
  onToggleFavorite?: (productId: string) => void;
  isInCompare?: (productId: string) => boolean;
  onToggleCompare?: (productId: string) => { added: boolean; isFull: boolean };
  canAddToCompare?: boolean;
  highlightColors?: string[];
  hideCategoryBadges?: boolean;
  activeColorFilter?: ActiveColorFilter | null;
  columns?: number;
  /** Selection mode props */
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onStatusClick?: (type: string, value?: string | number) => void;
}

const ProductCardWrapper = memo(
  ({
    product,
    index,
    isVisible: _isVisible,
    hideCategoryBadges,
    selectionMode,
    selectedIds,
    onToggleSelect,
    priority,
    ...restProps
  }: {
    product: Product;
    index: number;
    isVisible: boolean;
    hideCategoryBadges?: boolean;
    selectionMode?: boolean;
    selectedIds?: Set<string>;
    onToggleSelect?: (id: string) => void;
    priority?: boolean;
  } & Omit<React.ComponentProps<typeof ProductCard>, 'product' | 'priority'>) => {
    const reducedMotion = useReducedMotion();
    const [hasAnimated, setHasAnimated] = useState(reducedMotion);
    const ref = useRef<HTMLDivElement>(null);

    // Bug P2-06: lazy mount via IntersectionObserver para reduzir custo de DOM
    // quando o grid tem 200+ produtos. Cards fora da viewport (com margem de
    // 800px = ~2 viewports antes/depois) ficam como placeholder vazio mantendo
    // altura. priority=true (primeiros 8 cards above-the-fold) montam sempre.
    const [inView, setInView] = useState(priority === true);
    useEffect(() => {
      if (inView) return; // já está montado, IO desliga
      if (!ref.current) return;
      const el = ref.current;
      if (typeof IntersectionObserver === 'undefined') {
        // SSR/jsdom: monta direto
        setInView(true);
        return;
      }
      const io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              setInView(true);
              io.disconnect();
              break;
            }
          }
        },
        { rootMargin: '800px 0px', threshold: 0 },
      );
      io.observe(el);
      return () => io.disconnect();
    }, [inView, priority]);

    useEffect(() => {
      if (reducedMotion) {
        setHasAnimated(true);
        return;
      }
      if (!hasAnimated) {
        const timer = setTimeout(() => setHasAnimated(true), Math.min(index * 80, 800));
        return () => clearTimeout(timer);
      }
    }, [hasAnimated, index, reducedMotion]);

    const isSelected = selectionMode && selectedIds?.has(product.id);

    return (
      <div
        ref={ref}
        className={cn(
          reducedMotion
            ? ''
            : `transition-all duration-500 ease-out ${
                hasAnimated
                  ? 'translate-y-0 scale-100 opacity-100'
                  : 'translate-y-8 scale-95 opacity-0'
              }`,
          'product-card-cv relative',
          !inView && 'min-h-[480px] sm:min-h-[520px]',
          isSelected && 'rounded-xl ring-2 ring-primary/40',
        )}
        style={
          reducedMotion
            ? undefined
            : {
                transitionDelay: hasAnimated ? '0ms' : `${Math.min(index * 80, 800)}ms`,
              }
        }
      >
        {inView && selectionMode && onToggleSelect && (
          <div
            className="absolute left-2 top-2 z-20"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(product.id);
            }}
          >
            <SelectionCheckbox
              checked={!!isSelected}
              onChange={() => onToggleSelect(product.id)}
              size="md"
            />
          </div>
        )}
        {inView ? (
          <ProductCard
            product={product}
            hideCategoryBadges={hideCategoryBadges}
            {...restProps}
            priority={priority}
            onClick={selectionMode ? () => onToggleSelect?.(product.id) : restProps.onClick}
          />
        ) : (
          /* Placeholder leve que espelha exatamente a estrutura do card real para evitar saltos (CLS) */
          <ProductCardSkeleton
            variant="default"
            animate={false}
            hideCategoryBadges={hideCategoryBadges}
          />
        )}
      </div>
    );
  },
);

const columnClasses: Record<number, string> = {
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
  6: 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
  8: 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8',
};

export const ProductGrid = memo(
  ({
    products,
    isLoading,
    isError,
    onRetry,
    onProductClick,
    onViewProduct,
    onShareProduct,
    onFavoriteProduct,
    isFavorite,
    onToggleFavorite,
    isInCompare,
    onToggleCompare,
    canAddToCompare = true,
    highlightColors,
    hideCategoryBadges = false,
    activeColorFilter,
    columns = 5,
    selectionMode,
    selectedIds,
    onToggleSelect,
    onStatusClick,
  }: ProductGridProps) => {
    const [isGridVisible, setIsGridVisible] = useState(false);
    const gridRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (isLoading) return;
      // Reset animation state when products change
      setIsGridVisible(false);
      const timer = setTimeout(() => setIsGridVisible(true), 50);
      return () => clearTimeout(timer);
    }, [products, isLoading]);

    // Hidrata cores nos cards cujo fetch principal não trouxe `colors`
    // (fallback unificado p/ catálogo/super filtro/etc — mesmo padrão de Novidades).
    // RULES-OF-HOOKS FIX: hooks DEVEM rodar antes dos early returns (isError/empty)
    // abaixo — senão a contagem de hooks muda quando o componente alterna entre
    // estado de erro/vazio e estado normal, e o React crasha com "Rendered fewer
    // hooks than expected".
    const idsNeedingColors = useMemo(
      () => products.filter((p) => !p.colors || p.colors.length === 0).map((p) => p.id),
      [products],
    );
    const { data: colorsByProduct, hasError: colorsError } =
      useProductsColorsBatch(idsNeedingColors);

    // FIX ISSUE-02 2026-06-09: useColorEnrichment — resolve imagem real da variante de cor
    // quando filtro de cor está ativo no catálogo lightweight (batch colors = {name,hex} sem images[]).
    // RULES-OF-HOOKS: chamado incondicionalmente ANTES dos early returns abaixo.
    // Quando não há filtro ativo, productIds=[] desabilita as queries internas do hook.
    const hasActiveColorFilter = !!(
      activeColorFilter &&
      ((activeColorFilter.groups?.length ?? 0) > 0 ||
        (activeColorFilter.variations?.length ?? 0) > 0)
    );
    const allProductIds = useMemo(
      () => (hasActiveColorFilter ? products.map((p) => p.id) : []),
      [products, hasActiveColorFilter],
    );
    const { data: colorEnrichmentMap } = useColorEnrichment({
      productIds: allProductIds,
      colorGroups: activeColorFilter?.groups ?? [],
      colorVariations: activeColorFilter?.variations ?? [],
    });

    useEffect(() => {
      if (colorsError) {
        logger.error('[ProductGrid] Falha ao hidratar cores dos produtos:', idsNeedingColors);
      }
    }, [colorsError, idsNeedingColors]);

    if (isError) {
      return (
        <div className="flex animate-fade-in flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h3 className="mb-2 font-display text-lg font-semibold text-foreground">
            Ops! Falha ao carregar produtos
          </h3>
          <p className="mb-6 max-w-md text-sm text-muted-foreground">
            Não conseguimos conectar ao catálogo agora. Verifique sua conexão ou tente novamente.
          </p>
          {onRetry && (
            <Button onClick={onRetry} variant="outline" className="gap-2">
              <RotateCw className="h-4 w-4" />
              Tentar novamente
            </Button>
          )}
        </div>
      );
    }

    const showEmptyState = !isLoading && products.length === 0;

    if (showEmptyState) {
      return (
        <div className="flex animate-fade-in flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <span className="text-3xl">📦</span>
          </div>
          <h3 className="mb-2 font-display text-lg font-semibold text-foreground">
            Nenhum produto encontrado
          </h3>
          <p className="max-w-md text-muted-foreground">
            Tente ajustar os filtros ou realizar uma nova busca para encontrar os produtos
            desejados.
          </p>
        </div>
      );
    }

    type SkeletonEntry = { id: string; isSkeleton: true };
    const displayProducts: Array<Product | SkeletonEntry> =
      isLoading && products.length === 0
        ? Array.from({ length: 15 }).map((_, i) => ({
            id: `skeleton-${i}`,
            isSkeleton: true as const,
          }))
        : products;

    return (
      <div
        ref={gridRef}
        className={`grid ${columnClasses[columns] || columnClasses[5]} ${columns >= 8 ? 'gap-x-4 gap-y-8' : columns >= 6 ? 'gap-x-6 gap-y-8' : 'gap-x-4 gap-y-8 sm:gap-x-6 lg:gap-x-8'}`}
      >
        {displayProducts.map((product, index) =>
          'isSkeleton' in product && product.isSkeleton ? (
            <ProductCardSkeleton
              key={product.id}
              variant="default"
              selectionMode={selectionMode}
              hideCategoryBadges={hideCategoryBadges}
            />
          ) : (
            (() => {
              const p = product as Product;
              const isHydrating =
                idsNeedingColors.includes(p.id) && !colorsByProduct?.has(p.id) && !colorsError;
              const batchColors =
                !p.colors || p.colors.length === 0 ? colorsByProduct?.get(p.id) : undefined;

              const enriched: Product = {
                ...p,
                // Durante hydration as cores ainda não chegaram → [] (o card trata
                // colors vazio/ausente defensivamente; populam ao re-renderizar).
                colors: isHydrating
                  ? []
                  : batchColors && batchColors.length > 0
                    ? batchColors.map((c) => ({ name: c.name, hex: c.hex || '', group: '' }))
                    : p.colors,
              };

              // FIX ISSUE-02: imagem real da variante de cor via useColorEnrichment
              const enrichmentData = hasActiveColorFilter ? colorEnrichmentMap?.get(p.id) : null;
              const colorEnrichmentImage = enrichmentData?.image ?? null;

              return (
                <ProductCardWrapper
                  key={p.id}
                  product={enriched}
                  index={index}
                  isVisible={isGridVisible}
                  priority={index < 8}
                  onClick={onProductClick ? () => onProductClick(p.id) : undefined}
                  onView={onViewProduct}
                  onShare={onShareProduct}
                  onFavorite={onFavoriteProduct}
                  isFavorited={isFavorite ? isFavorite(p.id) : false}
                  onToggleFavorite={onToggleFavorite}
                  isInCompare={isInCompare ? isInCompare(p.id) : false}
                  onToggleCompare={onToggleCompare}
                  canAddToCompare={canAddToCompare}
                  highlightColors={highlightColors}
                  hideCategoryBadges={hideCategoryBadges}
                  activeColorFilter={activeColorFilter}
                  selectionMode={selectionMode}
                  selectedIds={selectedIds}
                  onToggleSelect={onToggleSelect}
                  onStatusClick={onStatusClick}
                  colorEnrichmentImage={colorEnrichmentImage}
                />
              );
            })()
          ),
        )}
      </div>
    );
  },
);
