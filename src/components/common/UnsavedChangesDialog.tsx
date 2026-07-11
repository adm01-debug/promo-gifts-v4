import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface UnsavedChangesDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  message?: string;
}

export function UnsavedChangesDialog({
  open,
  onConfirm,
  onCancel,
  message = 'Você tem alterações não salvas. Deseja realmente sair?',
}: UnsavedChangesDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(isOpen) => !isOpen && onCancel()}
      variant="warning"
      title="Alterações não salvas"
      description={message}
      confirmLabel="Sair sem salvar"
      cancelLabel="Continuar editando"
      cancelLabelShort="Continuar"
      onConfirm={onConfirm}
      onCancel={onCancel}
      testId="unsaved-changes-dialog"
    />
  );
}
