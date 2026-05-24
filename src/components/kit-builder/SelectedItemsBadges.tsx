/**
 * Selected Items Badges
 * Exibe os itens selecionados como badges compactos com Drag & Drop
 */

import { X, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { VariantSelector, type VariantSelectionData } from './VariantSelector';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { KitItem } from '@/lib/kit-builder';

interface SelectedItemsBadgesProps {
  items: KitItem[];
  onRemoveItem: (itemId: string) => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onUpdateVariant: (itemId: string, data: VariantSelectionData) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
}

function SortableItemBadge({
  item,
  onRemoveItem,
  onUpdateQuantity,
  onUpdateVariant,
}: {
  item: KitItem;
  onRemoveItem: (id: string) => void;
  onUpdateQuantity: (id: string, qty: number) => void;
  onUpdateVariant: (id: string, data: VariantSelectionData) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Badge
      ref={setNodeRef}
      style={style}
      variant="secondary"
      className="pl-1 pr-1 py-1 flex items-center gap-1.5 cursor-default"
    >
      <span {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none">
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </span>
      <span className="font-medium">{item.quantity}x</span>
      <span className="max-w-[150px] truncate">{item.name}</span>
      {item.isReplaceable && item.allowedVariantIds && item.allowedVariantIds.length > 0 && (
        <VariantSelector
          itemId={item.id}
          itemName={item.name}
          allowedVariantIds={item.allowedVariantIds}
          selectedColor={item.selectedColor}
          selectedSize={item.selectedSize}
          onSelectVariant={onUpdateVariant}
        />
      )}
      <div className="flex items-center gap-0.5 ml-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
          aria-label="Diminuir quantidade"
        >
          -
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
          aria-label="Aumentar quantidade"
        >
          +
        </Button>
        <Button
          variant="ghost"
          size="icon" aria-label="Fechar"
          className="h-5 w-5 text-destructive hover:text-destructive"
          onClick={() => onRemoveItem(item.id)}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </Badge>
  );
}

export function SelectedItemsBadges({
  items,
  onRemoveItem,
  onUpdateQuantity,
  onUpdateVariant,
  onReorder,
}: SelectedItemsBadgesProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (items.length === 0) return null;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorder) return;
    const oldIndex = items.findIndex(i => i.id === active.id);
    const newIndex = items.findIndex(i => i.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      onReorder(oldIndex, newIndex);
    }
  };

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">
        Itens no Kit ({items.length}) {onReorder && <span className="text-xs">— arraste para reordenar</span>}
      </h4>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(i => i.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex flex-wrap gap-2">
            {items.map(item => (
              <SortableItemBadge
                key={item.id}
                item={item}
                onRemoveItem={onRemoveItem}
                onUpdateQuantity={onUpdateQuantity}
                onUpdateVariant={onUpdateVariant}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
