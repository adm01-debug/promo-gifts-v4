/**
 * SortableStep — Extracted from WorkflowCanvas
 */
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GripVertical, Trash2, Settings2, ArrowRight, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkflowStep } from './WorkflowCanvas';
import { STEP_TYPES, AI_MODELS } from './workflowConstants';

interface SortableStepProps {
  step: WorkflowStep;
  index: number;
  totalSteps: number;
  onEdit: (step: WorkflowStep) => void;
  onDelete: (id: string) => void;
  onDuplicate: (step: WorkflowStep) => void;
}

export function SortableStep({
  step,
  index,
  totalSteps,
  onEdit,
  onDelete,
  onDuplicate,
}: SortableStepProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const typeConfig = STEP_TYPES.find((t) => t.value === step.type) || STEP_TYPES[0];
  const Icon = typeConfig.icon;

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {index < totalSteps - 1 && (
        <div className="absolute left-7 top-full z-0 h-6 w-0.5 bg-border" />
      )}
      {index < totalSteps - 1 && (
        <div className="absolute left-[22px] top-[calc(100%+20px)] z-10">
          <ArrowRight className="h-3.5 w-3.5 -rotate-90 text-muted-foreground" />
        </div>
      )}
      <div
        className={cn(
          'group flex items-stretch rounded-xl border transition-all duration-200',
          typeConfig.border,
          isDragging ? 'scale-[1.02] opacity-80 shadow-lg' : 'hover:shadow-md',
          'bg-card',
        )}
      >
        <div
          {...attributes}
          {...listeners}
          className="flex cursor-grab items-center rounded-l-xl border-r border-border/50 px-2 hover:bg-muted/50 active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex flex-1 items-center gap-3 p-3">
          <div className={cn('shrink-0 rounded-lg p-2', typeConfig.bg)}>
            <Icon className={cn('h-5 w-5', typeConfig.color)} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">{step.name}</span>
              <Badge variant="outline" className="shrink-0 px-1.5 text-[10px]">
                {typeConfig.label}
              </Badge>
              {step.agentModel && (
                <Badge variant="secondary" className="shrink-0 px-1.5 text-[10px]">
                  {AI_MODELS.find((m) => m.value === step.agentModel)?.label || step.agentModel}
                </Badge>
              )}
            </div>
            {step.description && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{step.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 px-2 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Copiar"
            className="h-7 w-7"
            onClick={() => onDuplicate(step)}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Settings2"
            className="h-7 w-7"
            onClick={() => onEdit(step)}
          >
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Excluir"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(step.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
