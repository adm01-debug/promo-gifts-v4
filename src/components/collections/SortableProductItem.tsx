/**
 * SortableProductItem — Draggable product row for collection management.
 * Extracted from CollectionDetailPage for modularity.
 */
import { useState } from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { GripVertical, FileText, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SelectionCheckbox } from '@/components/common/SelectionCheckbox';
import { PriceDropBadge } from '@/components/favorites/PriceDropBadge';
import { cn } from '@/lib/utils';

interface SortableProductItemProps {
  product: {
    id: string;
    name: string;
    sku?: string;
    images?: string[];
    price?: number | null;
  };
  variant?: {
    color_name?: string | null;
    color_hex?: string | null;
    thumbnail?: string | null;
  };
  priceAtSave?: number | null;
  addedAt?: string | null;
  onRemove: () => void;
  isSelected: boolean;
  onToggleSelect: () => void;
  notes?: string;
  onNotesChange: (notes: string) => void;
}

export function SortableProductItem({
  product,
  variant,
  priceAtSave,
  addedAt,
  onRemove,
  isSelected,
  onToggleSelect,
  notes,
  onNotesChange,
}: SortableProductItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: product.id,
  });

  const priceDiffPct =
    priceAtSave && product.price ? ((product.price - priceAtSave) / priceAtSave) * 100 : null;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const displayImage = variant?.thumbnail || product.images?.[0];
  const [showNotes, setShowNotes] = useState(!!notes);

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex flex-col gap-2 rounded-xl border-[1.5px] bg-card p-3 transition-all duration-200',
        isSelected
          ? 'border-primary/50 bg-primary/5 shadow-md shadow-primary/10'
          : 'border-primary/15 hover:border-primary/30 hover:shadow-sm',
      )}
    >
      <div className="flex items-center gap-3">
        <div onClick={(e) => e.stopPropagation()}>
          <SelectionCheckbox checked={isSelected} onChange={onToggleSelect} size="sm" />
        </div>
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="Arrastar"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        {displayImage && (
          <img
            src={displayImage}
            alt={product.name}
            className="h-12 w-12 rounded-lg object-cover"
            loading="lazy"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{product.name}</p>
            {priceDiffPct !== null && (
              <PriceDropBadge
                priceDiffPct={priceDiffPct}
                priceAtSave={priceAtSave ?? null}
                currentPrice={product.price ?? null}
                savedAt={addedAt ?? undefined}
                size="sm"
              />
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <p className="text-xs text-muted-foreground">{product.sku}</p>
            {variant?.color_hex && (
              <span className="flex items-center gap-1">
                <span
                  className="h-2.5 w-2.5 rounded-full border border-border"
                  style={{ backgroundColor: variant.color_hex }}
                />
                {variant.color_name && (
                  <span className="max-w-[80px] truncate text-xs text-muted-foreground">
                    {variant.color_name}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Nota"
          className="shrink-0 text-muted-foreground hover:text-primary"
          onClick={() => setShowNotes((v) => !v)}
        >
          <FileText className={cn('h-4 w-4', notes && 'text-primary')} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Remover da coleção"
          className="shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <AnimatePresence>
        {showNotes && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Input
              placeholder="Nota de venda (ex: cliente gosta deste modelo)..."
              defaultValue={notes ?? ''}
              onBlur={(e) => onNotesChange(e.target.value)}
              className="ml-[76px] h-8 text-xs"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
