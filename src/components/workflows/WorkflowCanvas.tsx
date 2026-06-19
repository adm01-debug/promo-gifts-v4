import { useState, useCallback } from 'react';
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
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Play, Pause, Workflow, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { STEP_TYPES } from './workflowConstants';
import { SortableStep } from './WorkflowStepCard';
import { WorkflowEditDialog } from './WorkflowEditDialog';

// Types
export interface WorkflowStep {
  id: string;
  name: string;
  type: 'agent' | 'tool' | 'condition' | 'output';
  description: string;
  agentModel?: string;
  prompt?: string;
  config: Record<string, unknown>;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  status: 'draft' | 'active' | 'paused';
}

const WORKFLOW_STATUS_CLASSES: Record<WorkflowDefinition['status'], string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-primary/10 text-primary',
  paused: 'bg-warning/10 text-warning',
} as const;

export function WorkflowCanvas() {
  const [workflow, setWorkflow] = useState<WorkflowDefinition>({
    id: crypto.randomUUID(),
    name: 'Novo Workflow',
    description: 'Orquestração multiagente',
    steps: [],
    status: 'draft',
  });

  const [editDialog, setEditDialog] = useState<WorkflowStep | null>(null);
  const [editForm, setEditForm] = useState<Partial<WorkflowStep>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setWorkflow((prev) => {
      const oldIndex = prev.steps.findIndex((s) => s.id === active.id);
      const newIndex = prev.steps.findIndex((s) => s.id === over.id);
      return { ...prev, steps: arrayMove(prev.steps, oldIndex, newIndex) };
    });
  }, []);

  const addStep = (type: WorkflowStep['type']) => {
    const typeLabel = STEP_TYPES.find((t) => t.value === type)?.label || type;
    const newStep: WorkflowStep = {
      id: crypto.randomUUID(),
      name: `${typeLabel} ${workflow.steps.length + 1}`,
      type,
      description: '',
      agentModel: type === 'agent' ? 'google/gemini-2.5-flash' : undefined,
      prompt: type === 'agent' ? '' : undefined,
      config: {},
    };
    setWorkflow((prev) => ({ ...prev, steps: [...prev.steps, newStep] }));
    toast.success(`Etapa "${typeLabel}" adicionada`);
  };

  const deleteStep = (id: string) => {
    setWorkflow((prev) => ({ ...prev, steps: prev.steps.filter((s) => s.id !== id) }));
  };

  const duplicateStep = (step: WorkflowStep) => {
    const newStep = { ...step, id: crypto.randomUUID(), name: `${step.name} (cópia)` };
    setWorkflow((prev) => ({ ...prev, steps: [...prev.steps, newStep] }));
    toast.success('Etapa duplicada');
  };

  const openEdit = (step: WorkflowStep) => {
    setEditForm({ ...step });
    setEditDialog(step);
  };

  const saveEdit = () => {
    if (!editDialog || !editForm) return;
    setWorkflow((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => (s.id === editDialog.id ? { ...s, ...editForm } : s)),
    }));
    setEditDialog(null);
    toast.success('Etapa atualizada');
  };

  return (
    <div className="space-y-6">
      {/* Workflow Header */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5">
                <Workflow className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <Input
                  value={workflow.name}
                  onChange={(e) => setWorkflow((p) => ({ ...p, name: e.target.value }))}
                  className="h-auto border-none bg-transparent p-0 text-lg font-bold focus-visible:ring-0"
                />
                <Input
                  value={workflow.description}
                  onChange={(e) => setWorkflow((p) => ({ ...p, description: e.target.value }))}
                  className="mt-0.5 h-auto border-none bg-transparent p-0 text-sm text-muted-foreground focus-visible:ring-0"
                  placeholder="Descrição do workflow..."
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={cn('text-xs', WORKFLOW_STATUS_CLASSES[workflow.status])}>
                {workflow.status === 'draft'
                  ? 'Rascunho'
                  : workflow.status === 'active'
                    ? 'Ativo'
                    : 'Pausado'}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setWorkflow((p) => ({
                    ...p,
                    status: p.status === 'active' ? 'paused' : 'active',
                  }))
                }
              >
                {workflow.status === 'active' ? (
                  <>
                    <Pause className="mr-1 h-4 w-4" />
                    Pausar
                  </>
                ) : (
                  <>
                    <Play className="mr-1 h-4 w-4" />
                    Ativar
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Add Step Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-medium text-muted-foreground">Adicionar:</span>
        {STEP_TYPES.map((type) => {
          const Icon = type.icon;
          return (
            <Button
              key={type.value}
              variant="outline"
              size="sm"
              onClick={() => addStep(type.value as WorkflowStep['type'])}
              className={cn('gap-1.5', type.border, 'hover:bg-muted/50')}
            >
              <Icon className={cn('h-4 w-4', type.color)} />
              {type.label}
            </Button>
          );
        })}
      </div>

      {/* Canvas */}
      <Card className="min-h-[300px] border-border/50">
        <CardContent className="p-6">
          {workflow.steps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 rounded-full bg-muted/50 p-4">
                <Sparkles className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="font-display text-lg font-semibold text-muted-foreground">
                Canvas vazio
              </h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Adicione etapas para criar seu fluxo de orquestração multiagente. Arraste para
                reordenar.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => addStep('agent')}>
                <Plus className="mr-1 h-4 w-4" />
                Adicionar primeira etapa
              </Button>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={workflow.steps.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-8">
                  {workflow.steps.map((step, index) => (
                    <SortableStep
                      key={step.id}
                      step={step}
                      index={index}
                      totalSteps={workflow.steps.length}
                      onEdit={openEdit}
                      onDelete={deleteStep}
                      onDuplicate={duplicateStep}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Step summary */}
      {workflow.steps.length > 0 && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            {workflow.steps.length} etapa{workflow.steps.length > 1 ? 's' : ''}
          </span>
          <span>•</span>
          <span>{workflow.steps.filter((s) => s.type === 'agent').length} agente(s)</span>
          <span>•</span>
          <span>{workflow.steps.filter((s) => s.type === 'tool').length} ferramenta(s)</span>
        </div>
      )}

      {/* Edit Step Dialog */}
      <WorkflowEditDialog
        step={editDialog}
        form={editForm}
        onFormChange={setEditForm}
        onSave={saveEdit}
        onClose={() => setEditDialog(null)}
      />
    </div>
  );
}
