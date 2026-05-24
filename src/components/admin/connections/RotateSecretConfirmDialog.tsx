import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { SecretMaskedDiff } from './SecretMaskedDiff';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  secretName: string;
  currentSuffix?: string | null;
  currentLength?: number | null;
  newSuffix?: string;
  newLength?: number;
  isLoading: boolean;
  error?: string | null;
  onConfirm: (notes?: string) => Promise<void> | void;
}

const MAX_NOTES = 200;

export function RotateSecretConfirmDialog({
  open,
  onOpenChange,
  secretName,
  currentSuffix,
  currentLength,
  newSuffix,
  newLength,
  isLoading,
  error,
  onConfirm,
}: Props) {
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) setNotes('');
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (isLoading) return;
    onOpenChange(next);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent
        className="max-w-lg"
        onEscapeKeyDown={(e) => isLoading && e.preventDefault()}
      >
        <AlertDialogHeader>
          <div className="flex items-start gap-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-warning/10"
            >
              <AlertTriangle className="h-6 w-6 text-warning" />
            </motion.div>
            <div className="space-y-1">
              <AlertDialogTitle className="text-lg">Rotacionar {secretName}?</AlertDialogTitle>
              <AlertDialogDescription>
                Você está prestes a substituir esta credencial pelo novo valor digitado.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        {newSuffix !== undefined && (
          <SecretMaskedDiff
            currentSuffix={currentSuffix ?? null}
            currentLength={currentLength ?? null}
            newSuffix={newSuffix}
            newLength={newLength ?? newSuffix.length}
            className="my-2"
          />
        )}

        {/* Impacto */}
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <h4 className="mb-2 text-sm font-medium">Isto irá:</h4>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
              Sobrescrever a credencial em uso agora
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
              Registrar a rotação no histórico de auditoria
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
              Disparar verificação automática da nova chave
            </li>
          </ul>
        </div>

        {/* Motivo opcional */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="rotation-notes" className="text-sm">
              Motivo <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <span className="text-xs text-muted-foreground">
              {notes.length}/{MAX_NOTES}
            </span>
          </div>
          <Textarea
            id="rotation-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, MAX_NOTES))}
            placeholder="Ex: rotação periódica trimestral, comprometimento suspeito, troca de fornecedor..."
            rows={3}
            disabled={isLoading}
            className="text-sm"
          />
        </div>

        <p className="text-sm font-medium text-destructive">Esta ação não pode ser desfeita.</p>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirm(notes.trim() || undefined)}
            disabled={isLoading}
            className="bg-warning text-warning-foreground hover:bg-warning/90"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sim, rotacionar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
