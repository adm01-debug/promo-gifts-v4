import { toast as sonnerToast } from 'sonner';
import { Undo2, Check, X, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UndoToastOptions {
  title: string;
  description?: string;
  onUndo: () => void;
  duration?: number;
}

interface ActionToastOptions {
  title: string;
  description?: string;
  duration?: number;
}

/**
 * Shows a toast with an Undo button for reversible actions
 */
export function showUndoToast({ title, description, onUndo, duration = 5000 }: UndoToastOptions) {
  let undone = false;

  const toastId = sonnerToast(
    <div className="flex w-full items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{title}</p>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      <button
        onClick={() => {
          if (!undone) {
            undone = true;
            onUndo();
            sonnerToast.dismiss(toastId);
            sonnerToast.success('Ação desfeita!', {
              duration: 2000,
              icon: <Undo2 className="h-4 w-4" />,
            });
          }
        }}
        className={cn(
          'flex items-center gap-1.5 rounded-lg px-3 py-1.5',
          'bg-primary/10 text-primary hover:bg-primary/20',
          'text-sm font-medium transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-primary/50',
        )}
      >
        <Undo2 className="h-4 w-4" />
        Desfazer
      </button>
    </div>,
    {
      duration,
      className: '!bg-card !border-border',
    },
  );

  return toastId;
}

/**
 * Shows a success toast with check icon
 */
export function showSuccessToast({ title, description, duration = 3000 }: ActionToastOptions) {
  return sonnerToast.success(title, {
    description,
    duration,
    icon: <Check className="h-4 w-4 text-success" />,
  });
}

/**
 * Shows an error toast with X icon
 */
export function showErrorToast({ title, description, duration = 4000 }: ActionToastOptions) {
  return sonnerToast.error(title, {
    description,
    duration,
    icon: <X className="h-4 w-4 text-destructive" />,
  });
}

/**
 * Shows a warning toast
 */
export function showWarningToast({ title, description, duration = 4000 }: ActionToastOptions) {
  return sonnerToast.warning(title, {
    description,
    duration,
    icon: <AlertTriangle className="h-4 w-4 text-warning" />,
  });
}

/**
 * Shows an info toast
 */
export function showInfoToast({ title, description, duration = 3000 }: ActionToastOptions) {
  return sonnerToast.info(title, {
    description,
    duration,
    icon: <Info className="h-4 w-4 text-info" />,
  });
}

/**
 * Helper to create undoable actions
 */
export function createUndoableAction<T>({
  action,
  undo,
  successMessage,
  undoMessage,
}: {
  action: () => T;
  undo: (result: T) => void;
  successMessage: string;
  undoMessage?: string;
}) {
  const result = action();

  showUndoToast({
    title: successMessage,
    description: undoMessage,
    onUndo: () => undo(result),
  });

  return result;
}
