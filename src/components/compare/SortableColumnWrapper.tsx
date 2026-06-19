/**
 * SortableColumnWrapper (C6 #4) — Wrapper com drag-and-drop horizontal para reordenar colunas.
 * Usa @dnd-kit/sortable; persiste ordem via callback onReorder.
 */
import type { ReactNode } from 'react';
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
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface SortableColumnProps {
  id: string;
  children: ReactNode;
}

function SortableColumn({ id, children }: SortableColumnProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="group relative">
      <button
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1 z-10 cursor-grab rounded p-1 opacity-0 transition-opacity hover:bg-muted active:cursor-grabbing group-hover:opacity-100"
        aria-label="Reordenar coluna"
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </button>
      {children}
    </div>
  );
}

interface SortableColumnWrapperProps {
  ids: string[];
  onReorder: (newOrder: string[]) => void;
  children: (id: string) => ReactNode;
  className?: string;
}

export function SortableColumnWrapper({
  ids,
  onReorder,
  children,
  className,
}: SortableColumnWrapperProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = ids.indexOf(String(active.id));
    const newIdx = ids.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    onReorder(arrayMove(ids, oldIdx, newIdx));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
        <div className={className}>
          {ids.map((id) => (
            <SortableColumn key={id} id={id}>
              {children(id)}
            </SortableColumn>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
