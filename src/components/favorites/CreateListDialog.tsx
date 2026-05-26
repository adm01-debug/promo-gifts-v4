import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { FavoritesClientPicker } from './FavoritesClientPicker';
import type { FavoriteList } from '@/hooks/favorites';

const COLORS = [
  '#EF4444',
  '#F97316',
  '#F59E0B',
  '#EAB308',
  '#84CC16',
  '#22C55E',
  '#10B981',
  '#06B6D4',
  '#3B82F6',
  '#6366F1',
  '#8B5CF6',
  '#A855F7',
  '#EC4899',
  '#F43F5E',
  '#64748B',
  '#0F172A',
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  existing?: FavoriteList;
  onCreate: (data: {
    name: string;
    color: string;
    icon: string;
    description?: string;
    client_id?: string | null;
    client_name?: string | null;
  }) => Promise<void>;
}

export function CreateListDialog({ open, onOpenChange, existing, onCreate }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLORS[8]);
  const [client, setClient] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(existing?.name ?? '');
      setDescription(existing?.description ?? '');
      setColor(existing?.color ?? COLORS[8]);
      setClient(
        existing?.client_id && existing?.client_name
          ? { id: existing.client_id, name: existing.client_name }
          : null,
      );
    }
  }, [open, existing]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onCreate({
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        icon: 'Heart',
        client_id: client?.id ?? null,
        client_name: client?.name ?? null,
      });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? 'Editar lista' : 'Nova lista de favoritos'}</DialogTitle>
          <DialogDescription>
            Organize seus favoritos por cliente, projeto ou tema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="list-name">Nome</Label>
            <Input
              id="list-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Cliente Acme — Q4"
              maxLength={60}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="list-desc">Descrição (opcional)</Label>
            <Textarea
              id="list-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notas internas sobre esta lista…"
              maxLength={200}
              className="min-h-[60px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Cliente CRM (opcional)</Label>
            <FavoritesClientPicker
              selectedClientId={client?.id ?? null}
              selectedClientName={client?.name ?? null}
              onSelect={setClient}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Cor</Label>
            <div className="grid grid-cols-8 gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'h-8 w-8 rounded-lg border-2 transition-all',
                    color === c
                      ? 'scale-110 border-foreground shadow-md'
                      : 'border-transparent hover:scale-105',
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || busy}>
            {busy ? 'Salvando…' : existing ? 'Salvar' : 'Criar lista'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
