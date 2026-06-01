/**
 * MockupGenerator Dialogs — Technique change + Delete confirmation
 */
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface TechniqueChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromName?: string;
  toName?: string;
  hasGeneratedMockup: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TechniqueChangeDialog({
  open,
  onOpenChange,
  fromName,
  toName,
  hasGeneratedMockup,
  onConfirm,
  onCancel,
}: TechniqueChangeDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Alterar técnica de personalização?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              Você está trocando de <strong>{fromName}</strong> para <strong>{toName}</strong>.
            </span>
            <span className="block text-sm">
              • O logo será mantido, mas as dimensões serão ajustadas aos limites da nova técnica.
              {hasGeneratedMockup && (
                <span className="block">
                  • O mockup gerado será descartado (será necessário gerar novamente).
                </span>
              )}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Alterar técnica</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeleteMockupDialog({ open, onOpenChange, onConfirm }: DeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir mockup?</AlertDialogTitle>
          <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
