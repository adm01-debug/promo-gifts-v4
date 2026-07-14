/**
 * Step 5 — Layout & Gerar: DnD para ordenar produtos + ações finais.
 * Usa @dnd-kit (já presente no projeto).
 */

import { useMemo } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Magazine, MagazineItem } from '@/types/magazine';
import { paginateMagazine } from '../../pagination';
import { formatPrice, itemPrice } from '../templates/shared';

interface Props {
  magazine: Magazine;
  onReorder: (orderedIds: string[]) => void;
  onRemove: (itemId: string) => void;
  /** Onda 1 — coordena highlight LayoutStep ↔ Preview. */
  onItemHover?: (itemId: string | null) => void;
  highlightedItemId?: string | null;
}

export function LayoutStep({ magazine, onReorder, onRemove, onItemHover, highlightedItemId }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const items = useMemo(() => [...magazine.items].sort((a, b) => a.position - b.position), [magazine.items]);
  const pages = useMemo(() => paginateMagazine(magazine), [magazine]);

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((i) => i.id === active.id);
    const newIdx = items.findIndex((i) => i.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    onReorder(arrayMove(items, oldIdx, newIdx).map((i) => i.id));
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="text-sm font-semibold">Ordenar produtos ({items.length})</div>
          <p className="text-xs text-muted-foreground">
            Arraste para reordenar. A paginação é recalculada automaticamente com base no template escolhido.
          </p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {items.map((it, idx) => (
                  <SortableRow
                    key={it.id}
                    item={it}
                    index={idx}
                    onRemove={onRemove}
                    onHover={onItemHover}
                    highlighted={highlightedItemId === it.id}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-4">
          <div className="text-sm font-semibold">Sumário</div>
          <div className="space-y-1 text-xs">
            {pages.map((p) => (
              <div key={p.index} className="flex items-center justify-between rounded border px-2 py-1">
                <span className="font-mono">{String(p.index + 1).padStart(2, '0')}</span>
                <span className="flex-1 truncate px-2 text-muted-foreground">
                  {p.kind === 'cover'
                    ? 'Capa'
                    : p.kind === 'back-cover'
                      ? 'Contracapa'
                      : p.kind === 'section'
                        ? `Seção: ${p.sectionTitle}`
                        : `${p.items.length} produto(s)`}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SortableRow({
  item,
  index,
  onRemove,
  onHover,
  highlighted,
}: {
  item: MagazineItem;
  index: number;
  onRemove: (id: string) => void;
  onHover?: (id: string | null) => void;
  highlighted?: boolean;
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
    <div
      ref={setNodeRef}
      style={style}
      onMouseEnter={() => onHover?.(item.id)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(item.id)}
      onBlur={() => onHover?.(null)}
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-background p-2 transition',
        highlighted && 'border-primary ring-2 ring-primary/40',
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground"
        aria-label="Arrastar"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="w-8 text-center font-mono text-xs text-muted-foreground">
        {String(index + 1).padStart(2, '0')}
      </span>
      <img
        src={item.productSnapshot.image_url}
        alt={item.productSnapshot.name}
        className="h-10 w-10 rounded object-cover"
      />
      <div className="flex-1 overflow-hidden">
        <div className="line-clamp-1 text-sm font-medium">{item.productSnapshot.name}</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Cód. {item.productSnapshot.sku}</span>
          <span>·</span>
          <span>{formatPrice(itemPrice(item))}</span>
        </div>
      </div>
      <Button variant="ghost" size="icon" onClick={() => onRemove(item.id)} aria-label="Remover">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
