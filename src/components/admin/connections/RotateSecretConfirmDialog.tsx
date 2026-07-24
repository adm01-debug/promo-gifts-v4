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
import { m as motion } from 'framer-motion';
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
        className="!max-w-lg w-[92vw] gap-0 overflow-hidden rounded-xl border border-border/60 bg-card/95 p-0 shadow-xl backdrop-blur-xl supports-[backdrop-filter]:bg-card/80"
        data-testid="rotate-secret-confirm-dialog"
        onEscapeKeyDown={(e) => isLoading && e.preventDefault()}
      >
        <div
          aria-hidden="true"
          className="h-[3px] w-full bg-gradient-to-r from-transparent via-warning to-transparent"
        />
        <div className="px-4 pb-1.5 pt-4">
          <AlertDialogHeader>
            <div className="flex items-start gap-3">
              <div className="relative flex-shrink-0">
                <span
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 rounded-xl blur-lg opacity-60 bg-warning/30"
                />
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/10 ring-1 ring-inset ring-warning/20"
                >
                  <AlertTriangle className="h-[18px] w-[18px] text-warning" strokeWidth={2.2} />
                </motion.div>
              </div>
              <div className="min-w-0 flex-1 space-y-1 pt-0.5">
                <AlertDialogTitle className="text-sm font-semibold leading-tight tracking-tight text-foreground">
                  Rotacionar {secretName}?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs leading-relaxed text-muted-foreground">
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
              className="mt-3"
            />
          )}

          <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Isto irá:
            </h4>
            <ul className="space-y-1.5 text-xs text-foreground/80">
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-warning" />
                Sobrescrever a credencial em uso agora
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-warning" />
                Registrar a rotação no histórico de auditoria
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-warning" />
                Disparar verificação automática da nova chave
              </li>
            </ul>
          </div>

          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="rotation-notes" className="text-xs">
                Motivo <span className="text-muted-foreground">(opcional)</span>
              </Label>
              <span className="text-[10px] text-muted-foreground">
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
              className="text-xs"
            />
          </div>

          <p className="mt-3 text-xs font-medium text-destructive">
            Esta ação não pode ser desfeita.
          </p>

          {error && (
            <div className="mt-2 rounded-md border border-destructive/50 bg-destructive/10 p-2.5 text-xs text-destructive">
              {error}
            </div>
          )}
        </div>

        <div className="mt-3 border-t border-border/50 bg-muted/20 px-4 py-2.5">
          <AlertDialogFooter className="gap-1.5 sm:gap-1.5">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="h-8 rounded-md px-3 text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => onConfirm(notes.trim() || undefined)}
              disabled={isLoading}
              className="inline-flex h-[26px] min-h-[26px] items-center rounded-md bg-warning px-3.5 text-xs font-semibold text-warning-foreground shadow-sm hover:bg-warning/90"
            >
              {isLoading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Sim, rotacionar
            </Button>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
