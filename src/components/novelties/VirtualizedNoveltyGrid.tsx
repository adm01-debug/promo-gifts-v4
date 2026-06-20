import { useEffect, useRef } from 'react';
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
  onStatusClick?: (type: string, value?: string | number) => void;
  colorsByProduct?: ReadonlyMap<string, readonly ColorDotLike[]>;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  /** Increment this counter to imperatively scroll the inner container back to the top.
   *  Typically incremented whenever the active filter set changes. */
  scrollToTopToken?: number;
}

/**
 * Grade virtualizada de Novidades — espelha a implementação de Reposição
 * para garantir colunas responsivas, espaçamento vertical uniforme (pb-8)
 * e alinhamento interno consistente em todas as resoluções.
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
}: VirtualizedNoveltyGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const numCols = useResponsiveColumns(gridColumns);
  const rowCount = Math.ceil(products.length / numCols);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 480,
    overscan: 3,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  // Scroll the inner container back to the top whenever the active filter set
  // changes. Skip the very first render (token = 0 on mount) to avoid an
  // unnecessary instant-scroll on initial page load.
  const isFirstScrollRef = useRef(true);
  useEffect(() => {
    if (isFirstScrollRef.current) {
      isFirstScrollRef.current = false;
      return;
    }
    parentRef.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [scrollToTopToken]);

  useEffect(() => {
    const el = parentRef.current;
    if (!el || !onLoadMore) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const handleScroll = () => {
      if (!hasMore || isLoadingMore) return;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 640) {
        onLoadMore();
      }
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    timeoutId = setTimeout(handleScroll, 180);

    return () => {
      el.removeEventListener('scroll', handleScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [products.length, hasMore, isLoadingMore, onLoadMore]);

  return (
    <div
      ref={parentRef}
      data-testid="novelty-list-wrapper"
      className="scrollbar-products overflow-y-auto pr-2"
      style={{
        height:
          'max(420px, calc(100vh - var(--header-h,56px) - var(--breadcrumb-h,0px) - var(--novelty-sticky-h,160px) - 112px))',
      }}
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
