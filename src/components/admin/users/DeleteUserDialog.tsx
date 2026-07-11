import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { type UserWithRole } from './types';

interface DeleteUserDialogProps {
  user: UserWithRole | null;
  onClose: () => void;
  onConfirm: (userId: string) => Promise<boolean>;
}

export function DeleteUserDialog({ user, onClose, onConfirm }: DeleteUserDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      const ok = await onConfirm(user.user_id);
      if (ok) onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  const displayName = user?.full_name || user?.email || 'este usuário';

  return (
    <ConfirmDialog
      open={!!user}
      onOpenChange={(open) => !open && onClose()}
      variant="destructive"
      title="Excluir usuário?"
      description={`Tem certeza que deseja excluir "${displayName}"? Esta ação é irreversível e removerá todos os dados associados.`}
      confirmLabel="Excluir"
      cancelLabel="Cancelar"
      onConfirm={handleDelete}
      loading={isDeleting}
      testId="delete-user-dialog"
    />
  );
}
