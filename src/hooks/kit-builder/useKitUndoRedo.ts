/**
 * Kit Undo/Redo Hook
 * Maintains a history stack of kit state snapshots.
 */

import { useState, useCallback, useRef } from 'react';

interface UndoRedoSnapshot {
  boxId: string | null;
  items: Array<{ id: string; quantity: number; sku: string }>;
  personalizationKeys: string[];
  name: string;
  kitQuantity: number;
}

const MAX_HISTORY = 30;

export function useKitUndoRedo() {
  const [history, setHistory] = useState<UndoRedoSnapshot[]>([]);
  const [future, setFuture] = useState<UndoRedoSnapshot[]>([]);
  const isRestoringRef = useRef(false);

  const pushSnapshot = useCallback((snapshot: UndoRedoSnapshot) => {
    if (isRestoringRef.current) return;
    setHistory((prev) => {
      const last = prev[prev.length - 1];
      if (last && JSON.stringify(last) === JSON.stringify(snapshot)) return prev;
      const next = [...prev, snapshot];
      if (next.length > MAX_HISTORY) next.shift();
      return next;
    });
    setFuture([]);
  }, []);

  const canUndo = history.length > 1;
  const canRedo = future.length > 0;

  const undo = useCallback((): UndoRedoSnapshot | null => {
    if (history.length <= 1) return null;
    isRestoringRef.current = true;
    const newHistory = [...history];
    const current = newHistory.pop();
    if (!current) {
      isRestoringRef.current = false;
      return null;
    }
    const prev = newHistory[newHistory.length - 1];
    setHistory(newHistory);
    setFuture((f) => [current, ...f]);
    setTimeout(() => {
      isRestoringRef.current = false;
    }, 100);
    return prev;
  }, [history]);

  const redo = useCallback((): UndoRedoSnapshot | null => {
    if (future.length === 0) return null;
    isRestoringRef.current = true;
    const [next, ...rest] = future;
    setFuture(rest);
    setHistory((prev) => [...prev, next]);
    setTimeout(() => {
      isRestoringRef.current = false;
    }, 100);
    return next;
  }, [future]);

  const reset = useCallback(() => {
    setHistory([]);
    setFuture([]);
  }, []);

  return { pushSnapshot, undo, redo, canUndo, canRedo, reset, isRestoring: isRestoringRef };
}
