/**
 * RemovePersonalizationDialog - Confirmação antes de excluir gravação
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { X, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RemovePersonalizationDialogProps {
  techniqueName: string;
  locationName: string;
  onConfirm: () => void;
  trigger?: React.ReactNode;
  variant?: 'icon' | 'button';
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
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {trigger || (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Fechar"
            className={cn(
              variant === 'icon' ? 'h-6 w-6 text-muted-foreground hover:text-destructive' : '',
              className,
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Remover gravação?
          </AlertDialogTitle>
          <AlertDialogDescription>
            A personalização <strong>{techniqueName}</strong> no local{' '}
            <strong>{locationName}</strong> será removida. Você precisará configurá-la novamente se
            quiser adicioná-la de volta.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
          >
            Remover
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
