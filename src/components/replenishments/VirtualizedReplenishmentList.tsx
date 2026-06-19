import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { type ReplenishmentWithDetails, type replenishmentToProduct } from '@/hooks/products';
import { ProductListItem } from '@/components/products/ProductListItem';
import { SelectionCheckbox } from '@/components/common/SelectionCheckbox';
import { cn } from '@/lib/utils';

interface VirtualizedListProps {
  products: ReplenishmentWithDetails[];
  productMap: Map<string, ReturnType<typeof replenishmentToProduct>>;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onProductClick: (id: string) => void;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  isInCompare: (id: string) => boolean;
  onToggleCompare: (id: string) => { added: boolean; isFull: boolean };
  canAddToCompare: boolean;
}

const SCROLL_CONTAINER_STYLE = {
  maxHeight:
    'calc(100vh - var(--header-h, 56px) - var(--breadcrumb-h, 0px) - var(--replenishment-sticky-h, 180px) - 1rem)',
} as const;

export function VirtualizedReplenishmentList({
  products,
  productMap,
  selectionMode,
  selectedIds,
  onToggleSelect,
  onProductClick,
  isFavorite,
  toggleFavorite,
  isInCompare,
  onToggleCompare,
  canAddToCompare,
}: VirtualizedListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: products.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 8,
  });

  return (
    <div
      ref={parentRef}
      className="overflow-auto"
      style={SCROLL_CONTAINER_STYLE}
      role="list"
      aria-label="Lista de produtos repostos"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = products[virtualRow.index];
          const prod = productMap.get(item.product_id);
          if (!prod) return null;
          const isSelected = selectedIds.has(item.product_id);

          return (
            <div
              key={virtualRow.key}
              role="listitem"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
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
                      onChange={() => onToggleSelect(item.product_id)}
                      size="md"
                      aria-label={`Selecionar ${item.product_name}`}
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <ProductListItem
                    product={prod}
                    onClick={() =>
                      selectionMode
                        ? onToggleSelect(item.product_id)
                        : onProductClick(item.product_id)
                    }
                    isFavorited={isFavorite(item.product_id)}
                    onToggleFavorite={toggleFavorite}
                    isInCompare={isInCompare(item.product_id)}
                    onToggleCompare={onToggleCompare}
                    canAddToCompare={canAddToCompare}
                    priority={virtualRow.index < 6}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
