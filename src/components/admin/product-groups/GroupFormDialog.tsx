import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Loader2 } from 'lucide-react';

interface GroupFormDialogProps {
  isPending: boolean;
  onCreate: (data: { group_code: string; group_name: string; description?: string }) => void;
}

export function GroupFormDialog({ isPending, onCreate }: GroupFormDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', description: '' });

  const handleAdd = () => {
    if (!form.code || !form.name) return;
    onCreate({
      group_code: form.code.toUpperCase(),
      group_name: form.name,
      description: form.description || undefined,
    });
    setIsOpen(false);
    setForm({ code: '', name: '', description: '' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo Grupo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Grupo de Produtos</DialogTitle>
          <DialogDescription>
            Crie um grupo para agrupar produtos com regras de personalização similares
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="group-code">Código</Label>
            <Input
              id="group-code"
              placeholder="Ex: SQUEEZE-PLASTICO"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="group-name">Nome</Label>
            <Input
              id="group-name"
              placeholder="Ex: Squeezes Plásticos"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="group-desc">Descrição</Label>
            <Textarea
              id="group-desc"
              placeholder="Descrição opcional do grupo..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleAdd} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar Grupo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
