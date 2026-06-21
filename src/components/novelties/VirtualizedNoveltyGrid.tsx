import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
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
  /** Incrementa p/ rolar a janela ao topo (troca de filtros). */
  scrollToTopToken?: number;
}

/**
 * Grade virtualizada de Novidades — agora ancorada ao SCROLL DA JANELA
 * (useWindowVirtualizer), espelhando o comportamento do Catálogo:
 * sidebar/header sticky, página rola naturalmente, infinite scroll
 * dispara conforme o usuário se aproxima do fim do documento.
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
  const [scrollMargin, setScrollMargin] = useState(0);

  const numCols = useResponsiveColumns(gridColumns);
  const rowCount = Math.ceil(products.length / numCols);

  const estimatedRowHeight = numCols <= 2 ? 460 : numCols <= 3 ? 440 : 420;

  // Mede o offset do container em relação ao topo do documento — necessário
  // para o useWindowVirtualizer alinhar suas posições absolutas.
  useLayoutEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const update = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      setScrollMargin(top);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(document.documentElement);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => estimatedRowHeight,
    overscan: 3,
    scrollMargin,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  // Reset de scroll ao topo quando os filtros mudam (skip 1º render).
  const isFirstScrollRef = useRef(true);
  useEffect(() => {
    if (isFirstScrollRef.current) {
      isFirstScrollRef.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [scrollToTopToken]);

  // Infinite scroll baseado no scroll da JANELA. Dispara onLoadMore quando o
  // fim do documento se aproxima (>= 1 viewport de antecedência).
  useEffect(() => {
    if (!onLoadMore) return;
    const onScroll = () => {
      if (!hasMore || isLoadingMore) return;
      const doc = document.documentElement;
      const remaining = doc.scrollHeight - window.scrollY - window.innerHeight;
      const threshold = Math.max(640, window.innerHeight);
      if (remaining < threshold) onLoadMore();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    // Dispara uma vez após montagem para o caso de já estarmos no fim.
    const t = setTimeout(onScroll, 180);
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(t);
    };
  }, [products.length, hasMore, isLoadingMore, onLoadMore]);

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
                transform: `translateY(${virtualRow.start - scrollMargin}px)`,
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
