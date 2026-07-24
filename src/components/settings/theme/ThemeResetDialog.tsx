import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

interface ThemeResetDialogProps {
  onConfirm: () => void;
}

export function ThemeResetDialog({ onConfirm }: ThemeResetDialogProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <RotateCcw className="h-3.5 w-3.5" /> Original
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        variant="warning"
        icon={RotateCcw}
        title="Restaurar tema original?"
        description="Isso irá reverter a skin, modo de cor e raio de borda para os valores padrão. Essa ação não pode ser desfeita."
        confirmLabel="Restaurar padrão"
        cancelLabel="Cancelar"
        onConfirm={onConfirm}
        testId="theme-reset-dialog"
      />
    </>
  );
}
