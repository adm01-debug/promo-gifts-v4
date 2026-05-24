/**
 * PromptDialogs — History, Test Preview, Add Technique dialogs
 */
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, History, Plus, TestTube, RotateCcw } from 'lucide-react';

export interface PromptHistory {
  id: string;
  config_id: string;
  config_key: string;
  version: number;
  new_prompt: string;
  ai_model: string;
  changed_by: string | null;
  changed_at: string;
  change_notes: string | null;
  old_prompt: string | null;
}

export interface Technique {
  id: string;
  name: string;
  code: string | null;
}

interface HistoryDialogProps {
  open: boolean;
  label: string;
  history: PromptHistory[];
  loading: boolean;
  onClose: () => void;
  onRestore: (entry: PromptHistory) => void;
}

export function HistoryDialog({
  open,
  label,
  history,
  loading,
  onClose,
  onRestore,
}: HistoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico: {label}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Nenhum histórico ainda</p>
          ) : (
            <div className="space-y-4">
              {history.map((entry) => (
                <Card key={entry.id} className="border-border/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">v{entry.version}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(entry.changed_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => onRestore(entry)}>
                        <RotateCcw className="mr-1 h-3 w-3" />
                        Restaurar
                      </Button>
                    </div>
                    {entry.change_notes && (
                      <p className="text-xs italic text-muted-foreground">{entry.change_notes}</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="mb-1 text-xs text-muted-foreground">
                      Modelo: {entry.ai_model}
                    </div>
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs">
                      {entry.new_prompt}
                    </pre>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

interface TestDialogProps {
  open: boolean;
  label: string;
  result: string | null;
  loading: boolean;
  onClose: () => void;
}

export function TestDialog({ open, label, result, loading, onClose }: TestDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Preview do Prompt: {label}
          </DialogTitle>
          <DialogDescription>
            Visualização do prompt com variáveis substituídas por valores de exemplo
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : result ? (
          <ScrollArea className="max-h-[60vh]">
            <pre className="whitespace-pre-wrap rounded-md bg-muted/50 p-4 text-sm">{result}</pre>
          </ScrollArea>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

interface AddTechniqueDialogProps {
  open: boolean;
  techniques: Technique[];
  selected: string;
  onSelectTechnique: (id: string) => void;
  onAdd: () => void;
  onClose: () => void;
}

export function AddTechniqueDialog({
  open,
  techniques,
  selected,
  onSelectTechnique,
  onAdd,
  onClose,
}: AddTechniqueDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Prompt por Técnica</DialogTitle>
          <DialogDescription>
            Crie um prompt customizado para uma técnica específica
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label>Técnica</Label>
          <Select value={selected} onValueChange={onSelectTechnique}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a técnica..." />
            </SelectTrigger>
            <SelectContent>
              {techniques.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name} {t.code && `(${t.code})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={onAdd} disabled={!selected}>
            <Plus className="mr-2 h-4 w-4" />
            Criar Prompt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
