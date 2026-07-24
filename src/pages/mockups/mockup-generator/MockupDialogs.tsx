/**
 * MockupGenerator Dialogs — Technique change + Delete confirmation
 */
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

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
  const description = [
    `Você está trocando de "${fromName ?? ''}" para "${toName ?? ''}".`,
    'O logo será mantido, mas as dimensões serão ajustadas aos limites da nova técnica.',
    hasGeneratedMockup ? 'O mockup gerado será descartado (será necessário gerar novamente).' : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) onCancel();
      }}
      variant="warning"
      title="Alterar técnica de personalização?"
      description={description}
      confirmLabel="Alterar técnica"
      cancelLabel="Cancelar"
      onConfirm={onConfirm}
      onCancel={onCancel}
      testId="mockup-technique-change-dialog"
    />
  );
}

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeleteMockupDialog({ open, onOpenChange, onConfirm }: DeleteDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      variant="destructive"
      title="Excluir mockup?"
      description="Esta ação não pode ser desfeita."
      confirmLabel="Excluir"
      cancelLabel="Cancelar"
      onConfirm={onConfirm}
      testId="mockup-delete-dialog"
    />
  );
}
