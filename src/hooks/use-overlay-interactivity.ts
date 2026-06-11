import { useEffect, useCallback } from 'react';
import { releaseScrollLockIfIdle } from '@/lib/dom/scroll-lock';

/**
 * useOverlayInteractivity
 * -----------------------
 * Hook to ensure that scroll locks and pointer-events: none are properly
 * released when an overlay component (Dialog, Sheet, Select, etc.) closes
 * or unmounts, especially during rapid navigation or abrupt unmounting.
 */
export function useOverlayInteractivity() {
  const cleanup = useCallback(() => {
    // We use requestAnimationFrame AND a small timeout to ensure we catch 
    // the state AFTER Radix/React have finished their unmounting cycle.
    requestAnimationFrame(() => {
      releaseScrollLockIfIdle();
      // Second check slightly later as a safety measure for animations
      setTimeout(releaseScrollLockIfIdle, 50);
    });
  }, []);

  useEffect(() => {
    // Return cleanup to be called on component unmount
    return cleanup;
  }, [cleanup]);

  return {
    /** 
     * Function to be called in onCloseAutoFocus or similar close handlers
     * for immediate restoration.
     */
    handleClose: cleanup
  };
}
