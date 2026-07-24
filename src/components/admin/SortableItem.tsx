import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SortableItemProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

export function SortableItem({ id, children, className }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('relative', isDragging && 'z-50 opacity-90 shadow-lg', className)}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className={cn(
            'mt-3 cursor-grab rounded p-1 active:cursor-grabbing',
            'text-muted-foreground hover:bg-muted hover:text-foreground',
            'transition-colors focus:outline-none focus:ring-2 focus:ring-primary',
          )}
          {...attributes}
          {...listeners}
          aria-label="Arrastar"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
