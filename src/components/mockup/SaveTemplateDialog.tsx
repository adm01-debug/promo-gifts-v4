import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { PersonalizationArea } from './MultiAreaManager';

interface SaveTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateName: string;
  onTemplateNameChange: (name: string) => void;
  onSave: () => void;
  areas: PersonalizationArea[];
}

export function SaveTemplateDialog({
  open,
  onOpenChange,
  templateName,
  onTemplateNameChange,
  onSave,
  areas,
}: SaveTemplateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Salvar Template Personalizado</DialogTitle>
          <DialogDescription>
            Salve a configuração atual das áreas como um template reutilizável.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nome do Template</label>
            <Input
              value={templateName}
              onChange={(e) => onTemplateNameChange(e.target.value)}
              placeholder="Ex: Minha Camiseta Personalizada"
              onKeyDown={(e) => e.key === 'Enter' && onSave()}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            <p>Áreas que serão salvas:</p>
            <ul className="mt-1 list-inside list-disc">
              {areas.map((area) => (
                <li key={area.id}>
                  {area.name} ({area.logoWidth}x{area.logoHeight}cm)
                </li>
              ))}
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSave}>
            <Save className="mr-1 h-4 w-4" />
            Salvar Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
