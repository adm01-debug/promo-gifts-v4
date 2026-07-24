/**
 * RemovePersonalizationDialog - Confirmação antes de excluir gravação
 */

import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RemovePersonalizationDialogProps {
  techniqueName: string;
  locationName: string;
  onConfirm: () => void;
  trigger?: React.ReactNode;
  variant?: 'button' | 'icon';
  className?: string;
}

export function RemovePersonalizationDialog({
  techniqueName,
  locationName,
  onConfirm,
  trigger,
  variant = 'icon',
  className,
}: RemovePersonalizationDialogProps) {
  const [open, setOpen] = useState(false);
  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(true);
  };

  return (
    <>
      {trigger ? (
        <span onClick={handleTriggerClick} className="inline-flex">
          {trigger}
        </span>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Fechar"
          className={cn(
            variant === 'icon' ? 'h-6 w-6 text-muted-foreground hover:text-destructive' : '',
            className,
          )}
          onClick={handleTriggerClick}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        variant="destructive"
        title="Remover gravação?"
        description={`A personalização "${techniqueName}" no local "${locationName}" será removida. Você precisará configurá-la novamente se quiser adicioná-la de volta.`}
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        onConfirm={onConfirm}
        testId="remove-personalization-dialog"
      />
    </>
  );
}
