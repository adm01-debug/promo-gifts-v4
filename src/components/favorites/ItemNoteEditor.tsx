import { useEffect, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  initialNote: string | null;
  onSave: (note: string | null) => Promise<void> | void;
  triggerClassName?: string;
}

export function ItemNoteEditor({ initialNote, onSave, triggerClassName }: Props) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(initialNote ?? '');
  const [busy, setBusy] = useState(false);

  // Re-sync when initialNote changes from a remote refetch, but only when
  // the popover is closed so we don't overwrite the user's in-progress edit.
  useEffect(() => {
    if (!open) setNote(initialNote ?? '');
  }, [initialNote, open]);

  const hasNote = !!initialNote?.trim();
  const remaining = 280 - note.length;

  const handleSave = async () => {
    setBusy(true);
    try {
      await onSave(note.trim() ? note.trim() : null);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant={hasNote ? 'default' : 'secondary'}
          aria-label={hasNote ? 'Editar nota' : 'Adicionar nota'}
          className={cn(
            'h-7 w-7 backdrop-blur-sm',
            hasNote ? 'bg-primary text-primary-foreground' : 'bg-card/90 hover:bg-primary/20',
            triggerClassName,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <StickyNote className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">Anotação</p>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 280))}
            placeholder="Ex: cliente pediu este modelo na cor azul"
            className="min-h-[80px] text-sm"
            autoFocus
          />
          <div className="flex items-center justify-between">
            <span
              className={cn(
                'text-[11px]',
                remaining < 30 ? 'text-warning' : 'text-muted-foreground',
              )}
            >
              {remaining} caracteres restantes
            </span>
            <Button size="sm" onClick={handleSave} disabled={busy} className="h-7 text-xs">
              {busy ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
