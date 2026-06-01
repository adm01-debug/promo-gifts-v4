import { useEffect, useCallback, useState } from 'react';

interface UseUnsavedChangesGuardOptions {
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Custom message for the browser dialog */
  message?: string;
}

/**
 * Hook that warns users before leaving a page with unsaved changes.
 * Uses the browser's native `beforeunload` event for tab close/refresh,
 * and provides a confirmation dialog helper for in-app navigation.
 */
export function useUnsavedChangesGuard({
  hasUnsavedChanges,
  message = 'Você tem alterações não salvas. Deseja realmente sair?',
}: UseUnsavedChangesGuardOptions) {
  const [showDialog, setShowDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Browser tab close / refresh guard
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges, message]);

  // Guard for in-app navigation
  const guardNavigation = useCallback(
    (action: () => void) => {
      if (hasUnsavedChanges) {
        setPendingAction(() => action);
        setShowDialog(true);
      } else {
        action();
      }
    },
    [hasUnsavedChanges],
  );

  const confirmLeave = useCallback(() => {
    setShowDialog(false);
    pendingAction?.();
    setPendingAction(null);
  }, [pendingAction]);

  const cancelLeave = useCallback(() => {
    setShowDialog(false);
    setPendingAction(null);
  }, []);

  return {
    showDialog,
    guardNavigation,
    confirmLeave,
    cancelLeave,
    message,
  };
}
