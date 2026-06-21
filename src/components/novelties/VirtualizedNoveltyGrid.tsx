import { useEffect, useRef, type RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { NoveltyWithDetails } from '@/hooks/products';
import type { ColumnCount } from '@/components/products/ColumnSelector';
import {
  useResponsiveColumns,
  getGridColsClass,
  getGridGapClass,
} from '@/components/replenishments/grid-layout';
import { NoveltyGridCard } from './NoveltyCards';
import type { ColorDotLike } from '@/components/products/ProductColorSwatches';

interface VirtualizedNoveltyGridProps {
  products: NoveltyWithDetails[];
  gridColumns: ColumnCount;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onProductClick: (id: string) => void;
  onStatusClick?: (type: string, value?: number | string) => void;
  colorsByProduct?: ReadonlyMap<string, readonly ColorDotLike[]>;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  /** Incrementa p/ rolar o container ao topo (troca de filtros). */
  scrollToTopToken?: number;
  /**
   * Elemento de scroll EXTERNO (overflow-y-auto). A página de Novidades
   * cria um container com altura fixa para que a barra de rolagem fique
   * ao lado dos produtos — não no body. Obrigatório.
   */
  scrollElementRef: RefObject<HTMLElement | null>;
}

/**
 * Grade virtualizada de Novidades — agora ancorada num container de scroll
 * INTERNO (passado via `scrollElementRef`). A janela do navegador permanece
 * sem barra de rolagem; o scrollbar aparece à direita do grid de produtos.
 */
export function VirtualizedNoveltyGrid({
  products,
  gridColumns,
  selectionMode,
  selectedIds,
  onToggleSelect,
  onProductClick,
  onStatusClick,
  colorsByProduct,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  scrollToTopToken = 0,
  scrollElementRef,
}: VirtualizedNoveltyGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const numCols = useResponsiveColumns(gridColumns);
  const rowCount = Math.ceil(products.length / numCols);

  const estimatedRowHeight = numCols <= 2 ? 520 : numCols <= 3 ? 480 : numCols <= 4 ? 460 : 440;

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan: 5,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  // Reset de scroll ao topo quando os filtros mudam (skip 1º render).
  const isFirstScrollRef = useRef(true);
  useEffect(() => {
    if (isFirstScrollRef.current) {
      isFirstScrollRef.current = false;
      return;
    }
    scrollElementRef.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [scrollToTopToken, scrollElementRef]);

  // Infinite scroll baseado no scroll do CONTAINER interno.
  useEffect(() => {
    if (!onLoadMore) return;
    const el = scrollElementRef.current;
    if (!el) return;
    const onScroll = () => {
      if (!hasMore || isLoadingMore) return;
      const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
      const threshold = Math.max(640, el.clientHeight);
      if (remaining < threshold) onLoadMore();
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    const t = setTimeout(onScroll, 180);
    return () => {
      el.removeEventListener('scroll', onScroll);
      clearTimeout(t);
    };
  }, [products.length, hasMore, isLoadingMore, onLoadMore, scrollElementRef]);

  return (
    <div
      ref={parentRef}
      data-testid="novelty-list-wrapper"
      role="list"
      aria-label="Grade de novidades"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const startIdx = virtualRow.index * numCols;
          const rowProducts = products.slice(startIdx, startIdx + numCols);

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className={`grid ${getGridColsClass(gridColumns)} ${getGridGapClass(gridColumns)} pb-8`}
            >
              {rowProducts.map((product) => (
                <div key={product.novelty_id} role="listitem">
                  <NoveltyGridCard
                    product={product}
                    selectionMode={selectionMode}
                    isSelected={selectedIds.has(product.product_id)}
                    onSelect={
                      selectionMode
                        ? () => onToggleSelect(product.product_id)
                        : () => onProductClick(product.product_id)
                    }
                    onStatusClick={onStatusClick}
                    colors={colorsByProduct?.get(product.product_id)}
                    priority={virtualRow.index === 0}
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
