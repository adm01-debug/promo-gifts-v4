import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { NoveltyWithDetails } from '@/hooks/products';
import type { ColumnCount } from '@/components/products/ColumnSelector';
import { useResponsiveColumns, getGridColsClass, getGridGapClass } from '../replenishments/grid-layout';
import { NoveltyGridCard } from './NoveltyCards';

interface VirtualizedGridProps {
  products: NoveltyWithDetails[];
  gridColumns: ColumnCount;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onProductClick: (id: string) => void;
  onStatusClick?: (type: string, value?: string | number) => void;
}

export function VirtualizedNoveltyGrid({
  products,
  gridColumns,
  selectionMode,
  selectedIds,
  onToggleSelect,
  onProductClick,
  onStatusClick,
}: VirtualizedGridProps) {
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

  const effectiveCols = gridColumns;

  return (
    <div
      ref={parentRef}
      className="overflow-auto"
      style={{ maxHeight: 'calc(100vh - 280px)' }}
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
              className={`grid ${getGridColsClass(effectiveCols)} ${getGridGapClass(effectiveCols)} pb-8`}
            >
              {rowProducts.map((product) => (
                <div key={product.novelty_id} role="listitem">
                  <NoveltyGridCard
                    product={product}
                    onClick={() => onProductClick(product.product_id)}
                    selectionMode={selectionMode}
                    isSelected={selectedIds.has(product.product_id)}
                    onToggleSelect={() => onToggleSelect(product.product_id)}
                    onStatusClick={onStatusClick}
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
