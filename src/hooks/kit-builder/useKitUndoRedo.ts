/**
 * Kit Undo/Redo Hook
 * Maintains a history stack of kit state snapshots.
 *
 * O snapshot guarda o estado COMPLETO e restaurável do kit (caixa, itens,
 * personalização, etc.) — não uma versão lossy (boxId/keys) que não permitia
 * restaurar fielmente. `useKitBuilder.restoreKitSnapshot` consome este shape.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { KitBox, KitItem, KitType, KitIdentity, KitPersonalization } from '@/lib/kit-builder';

export interface KitSnapshot {
  name: string;
  kitType: KitType;
  box: KitBox | null;
  items: KitItem[];
  personalization: KitPersonalization;
  kitQuantity: number;
  identity?: KitIdentity;
}

const MAX_HISTORY = 30;

export function useKitUndoRedo() {
  const [history, setHistory] = useState<KitSnapshot[]>([]);
  const [future, setFuture] = useState<KitSnapshot[]>([]);
  const isRestoringRef = useRef(false);
  // BUG-16 FIX: store the restore timer id so it can be cleared on unmount
  // and before each new undo/redo call. Previously both undo() and redo()
  // called setTimeout without storing the id — on unmount the 100ms timer
  // would fire and attempt to mutate a ref on a component that may have been
  // destroyed. Also: if undo was called rapidly, multiple timers could stack,
  // each resetting isRestoringRef independently.
  const restoreTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Cleanup the restore timer on unmount
  useEffect(() => {
    return () => {
      if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
    };
  }, []);

  const pushSnapshot = useCallback((snapshot: KitSnapshot) => {
    if (isRestoringRef.current) return;
    setHistory((prev) => {
      const last = prev.at(-1);
      if (last && JSON.stringify(last) === JSON.stringify(snapshot)) return prev;
      const next = [...prev, snapshot];
      if (next.length > MAX_HISTORY) next.shift();
      return next;
    });
    setFuture([]);
  }, []);

  const canUndo = history.length > 1;
  const canRedo = future.length > 0;

  const undo = useCallback((): KitSnapshot | null => {
    if (history.length <= 1) return null;
    isRestoringRef.current = true;
    const newHistory = [...history];
    const current = newHistory.pop();
    if (!current) {
      isRestoringRef.current = false;
      return null;
    }
    const prev = newHistory.at(-1) ?? null;
    setHistory(newHistory);
    setFuture((f) => [current, ...f]);
    // Clear any pending timer before scheduling the reset
    if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
    restoreTimerRef.current = setTimeout(() => {
      restoreTimerRef.current = undefined;
      isRestoringRef.current = false;
    }, 100);
    return prev;
  }, [history]);

  const redo = useCallback((): KitSnapshot | null => {
    if (future.length === 0) return null;
    isRestoringRef.current = true;
    const [next, ...rest] = future;
    setFuture(rest);
    setHistory((prev) => [...prev, next]);
    // Clear any pending timer before scheduling the reset
    if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
    restoreTimerRef.current = setTimeout(() => {
      restoreTimerRef.current = undefined;
      isRestoringRef.current = false;
    }, 100);
    return next;
  }, [future]);

  const reset = useCallback(() => {
    // Clear any pending restore timer when resetting
    if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
    setHistory([]);
    setFuture([]);
  }, []);

  return { pushSnapshot, undo, redo, canUndo, canRedo, reset, isRestoring: isRestoringRef };
}
