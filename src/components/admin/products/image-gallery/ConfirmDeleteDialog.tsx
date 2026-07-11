import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface Props {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  description?: string;
  count?: number;
}

export function ConfirmDeleteDialog({
  open,
  onConfirm,
  onCancel,
  title = 'Confirmar remoção',
  description,
  count = 1,
}: Props) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(v) => !v && onCancel()}
      variant="destructive"
      title={title}
      description={
        description ||
        (count > 1
          ? `Tem certeza que deseja remover ${count} item(ns)? Esta ação não pode ser desfeita.`
          : 'Tem certeza que deseja remover este item? Esta ação não pode ser desfeita.')
      }
      confirmLabel="Remover"
      cancelLabel="Cancelar"
      onConfirm={onConfirm}
      onCancel={onCancel}
      testId="image-gallery-confirm-delete"
    />
  );
}
