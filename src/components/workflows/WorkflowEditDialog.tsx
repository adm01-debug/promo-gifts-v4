/**
 * WorkflowEditDialog — Step configuration dialog extracted from WorkflowCanvas.
 */
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Settings2 } from 'lucide-react';
import { STEP_TYPES, AI_MODELS } from './workflowConstants';
import type { WorkflowStep } from './WorkflowCanvas';

interface WorkflowEditDialogProps {
  step: WorkflowStep | null;
  form: Partial<WorkflowStep>;
  onFormChange: (updater: (prev: Partial<WorkflowStep>) => Partial<WorkflowStep>) => void;
  onSave: () => void;
  onClose: () => void;
}

export function WorkflowEditDialog({
  step,
  form,
  onFormChange,
  onSave,
  onClose,
}: WorkflowEditDialogProps) {
  return (
    <Dialog open={!!step} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Configurar Etapa
          </DialogTitle>
          <DialogDescription>Configure os parâmetros desta etapa do workflow</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Nome</label>
            <Input
              value={form.name ?? ''}
              onChange={(e) => onFormChange((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Tipo</label>
            <Select
              value={form.type || 'agent'}
              onValueChange={(v) =>
                onFormChange((p) => ({
                  ...p,
                  type: v as WorkflowStep['type'],
                  agentModel: v === 'agent' ? p.agentModel || 'google/gemini-2.5-flash' : undefined,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STEP_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Descrição</label>
            <Input
              value={form.description ?? ''}
              onChange={(e) => onFormChange((p) => ({ ...p, description: e.target.value }))}
              placeholder="O que esta etapa faz..."
            />
          </div>
          {form.type === 'agent' && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium">Modelo de IA</label>
                <Select
                  value={form.agentModel || 'google/gemini-2.5-flash'}
                  onValueChange={(v) => onFormChange((p) => ({ ...p, agentModel: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Prompt do Agente</label>
                <Textarea
                  value={form.prompt ?? ''}
                  onChange={(e) => onFormChange((p) => ({ ...p, prompt: e.target.value }))}
                  className="min-h-[120px] font-mono text-xs"
                  placeholder="Instruções para o agente..."
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={onSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
