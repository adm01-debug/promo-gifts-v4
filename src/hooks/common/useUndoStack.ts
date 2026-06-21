/**
 * useUndoStack — Pilha global de ações desfazíveis com listener Cmd/Ctrl+Z.
 * Cada item da pilha contém uma função `undo` que restaura o estado anterior.
 */
import { useCallback, useEffect, useRef } from 'react';

import { logger } from '@/lib/logger';
export interface UndoEntry {
  id: string;
  label: string;
  undo: () => Promise<void> | void;
  /** ms desde push */
  pushedAt: number;
}

const MAX_STACK = 10;
const TTL_MS = 30_000; // operações expiram em 30s

export function useUndoStack() {
  const stackRef = useRef<UndoEntry[]>([]);

  const push = useCallback((entry: Omit<UndoEntry, 'pushedAt'>) => {
    const next: UndoEntry = { ...entry, pushedAt: Date.now() };
    stackRef.current = [next, ...stackRef.current].slice(0, MAX_STACK);
  }, []);

  const popAndUndo = useCallback(async (): Promise<boolean> => {
    const now = Date.now();
    // descarta TTL expirados
    stackRef.current = stackRef.current.filter((e) => now - e.pushedAt < TTL_MS);
    const top = stackRef.current.shift();
    if (!top) return false;
    try {
      await top.undo();
      return true;
    } catch (e) {
      logger.warn('[useUndoStack] undo failed', e);
      return false;
    }
  }, []);

  const clear = useCallback(() => {
    stackRef.current = [];
  }, []);

  // Listener global Cmd/Ctrl+Z
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isUndo = (e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z';
      if (!isUndo) return;
      // ignora se foco em input/textarea/contentEditable
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable))
        return;
      e.preventDefault();
      void popAndUndo();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [popAndUndo]);

  return { push, popAndUndo, clear };
}
