import { useRef, useState, useLayoutEffect } from 'react';
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
  onStatusClick?: (type: string, value?: string | number) => void;
  colorsByProduct?: ReadonlyMap<string, readonly ColorDotLike[]>;
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
}: VirtualizedNoveltyGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // BUG-SCROLL-02 FIX: scrollMargin stale no useWindowVirtualizer.
  //
  // PROBLEMA ANTERIOR: `scrollMargin: parentRef.current?.offsetTop ?? 0`
  // era avaliado inline no render. No 1º render, parentRef.current = null
  // → scrollMargin = 0. Em renders posteriores (após mount e CSS vars
  // settlerem), o valor mudava abruptamente para o offsetTop real (~300-520px),
  // fazendo o virtualizer renderizar um conjunto diferente de itens para o
  // mesmo window.scrollY — efeito visual de "snap" de conteúdo.
  //
  // SOLUÇÃO: capturar offsetTop UMA VEZ em useLayoutEffect (pós-mount, antes
  // do paint) via getBoundingClientRect + window.scrollY para obter a posição
  // absoluta na página. Qualquer resize subsequente (ex: toolbar sticky) é
  // capturado pelo ResizeObserver no elemento pai mais próximo.
  const [scrollMargin, setScrollMargin] = useState(0);
  useLayoutEffect(() => {
    if (!parentRef.current) return;

    const measure = () => {
      if (!parentRef.current) return;
      const rect = parentRef.current.getBoundingClientRect();
      const margin = Math.round(rect.top + window.scrollY);
      setScrollMargin(margin);
    };

    measure(); // Medição inicial (pós-mount, offsetTop já definido)

    // Atualiza em resize (responsividade: viewport muda → offsetTop muda)
    window.addEventListener('resize', measure, { passive: true });
    return () => {
      window.removeEventListener('resize', measure);
    };
  }, []); // Deps vazias: só executa 1× após mount

  const numCols = useResponsiveColumns(gridColumns);
  const rowCount = Math.ceil(products.length / numCols);

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => 480,
    overscan: 3,
    scrollMargin, // BUG-SCROLL-02 FIX: estado estável capturado em useLayoutEffect
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  return (
    <div
      ref={parentRef}
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
                transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
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
