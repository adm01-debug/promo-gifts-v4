import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ReplenishmentWithDetails } from '@/hooks/products';
import type { ColumnCount } from '@/components/products/ColumnSelector';
import { useResponsiveColumns, getGridColsClass, getGridGapClass } from './grid-layout';
import { ReplenishmentGridCard } from './ReplenishmentCards';
import type { ColorDotLike } from '@/components/products/ProductColorSwatches';

interface VirtualizedGridProps {
  products: ReplenishmentWithDetails[];
  gridColumns: ColumnCount;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onProductClick: (id: string) => void;
  colorsByProduct?: ReadonlyMap<string, readonly ColorDotLike[]>;
}

const SCROLL_CONTAINER_STYLE = { maxHeight: 'calc(100vh - 280px)' } as const;

export function VirtualizedReplenishmentGrid({
  products,
  gridColumns,
  selectionMode,
  selectedIds,
  onToggleSelect,
  onProductClick,
  colorsByProduct,
}: VirtualizedGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Usamos o hook reativo para que o número de colunas mude com a tela
  const numCols = useResponsiveColumns(gridColumns);
  const rowCount = Math.ceil(products.length / numCols);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 430,
    overscan: 3,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  const effectiveCols = gridColumns;

  return (
    <div
      ref={parentRef}
      className="overflow-auto"
      style={SCROLL_CONTAINER_STYLE}
      role="list"
      aria-label="Grade de produtos repostos"
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
              className={cn(
                'grid pb-8',
                getGridColsClass(effectiveCols),
                getGridGapClass(effectiveCols),
              )}
            >
              {rowProducts.map((product) => (
                <div key={product.replenishment_id} role="listitem">
                  <ReplenishmentGridCard
                    product={product}
                    onClick={() => onProductClick(product.product_id)}
                    selectionMode={selectionMode}
                    isSelected={selectedIds.has(product.product_id)}
                    onToggleSelect={() => onToggleSelect(product.product_id)}
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
