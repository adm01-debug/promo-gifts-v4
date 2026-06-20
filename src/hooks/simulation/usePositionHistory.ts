/**
 * usePositionHistory — Undo/Redo for logo positioning
 *
 * Tracks position & size changes with a configurable history depth.
 * Supports Ctrl+Z (undo) and Ctrl+Shift+Z / Ctrl+Y (redo).
 */

import { useCallback, useEffect, useRef, useMemo, useReducer } from 'react';

interface PositionState {
  positionX: number;
  positionY: number;
  logoWidth: number;
  logoHeight: number;
  logoRotation?: number;
  logoScale?: number;
}

interface UsePositionHistoryOptions {
  maxHistory?: number;
  enabled?: boolean;
}

// BUG-14 FIX: consolidate history + historyIndex into a single state updated
// atomically via useReducer. Previously both were separate useState calls.
// pushState captured historyIndex via closure and used it inside setHistory's
// functional updater — if called twice before re-render (e.g., two rapid
// mouseMove events during drag), the second call used the SAME stale
// historyIndex, slicing prev at the wrong point and discarding the first push.
interface HistoryReducerState {
  history: PositionState[];
  historyIndex: number;
}

type HistoryAction =
  | { type: 'PUSH'; payload: PositionState; maxHistory: number }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'CLEAR' };

function historyReducer(state: HistoryReducerState, action: HistoryAction): HistoryReducerState {
  switch (action.type) {
    case 'PUSH': {
      const truncated = state.history.slice(0, state.historyIndex + 1);
      const newHistory = [...truncated, action.payload];
      if (newHistory.length > action.maxHistory) newHistory.shift();
      return {
        history: newHistory,
        historyIndex: Math.min(state.historyIndex + 1, action.maxHistory - 1),
      };
    }
    case 'UNDO':
      if (state.historyIndex <= 0) return state;
      return { ...state, historyIndex: state.historyIndex - 1 };
    case 'REDO':
      if (state.historyIndex >= state.history.length - 1) return state;
      return { ...state, historyIndex: state.historyIndex + 1 };
    case 'CLEAR':
      return { history: [], historyIndex: -1 };
    default:
      return state;
  }
}

export function usePositionHistory(options: UsePositionHistoryOptions = {}) {
  const { maxHistory = 30, enabled = true } = options;

  const [{ history, historyIndex }, dispatch] = useReducer(historyReducer, {
    history: [],
    historyIndex: -1,
  });

  const isUndoRedoRef = useRef(false);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const pushState = useCallback(
    (state: PositionState) => {
      if (isUndoRedoRef.current) {
        isUndoRedoRef.current = false;
        return;
      }
      // Dispatch is always safe — reducer runs with current state atomically
      dispatch({ type: 'PUSH', payload: state, maxHistory });
    },
    [maxHistory],
  );

  const undo = useCallback((): PositionState | null => {
    if (!canUndo) return null;
    isUndoRedoRef.current = true;
    dispatch({ type: 'UNDO' });
    return history[historyIndex - 1];
  }, [canUndo, historyIndex, history]);

  const redo = useCallback((): PositionState | null => {
    if (!canRedo) return null;
    isUndoRedoRef.current = true;
    dispatch({ type: 'REDO' });
    return history[historyIndex + 1];
  }, [canRedo, historyIndex, history]);

  const clear = useCallback(() => {
    dispatch({ type: 'CLEAR' });
  }, []);

  // Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Shift+Z or Ctrl+Y (redo)
  const onUndoRedoRef = useRef<{ onApply: (state: PositionState) => void } | null>(null);

  const setOnApply = useCallback((fn: (state: PositionState) => void) => {
    onUndoRedoRef.current = { onApply: fn };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
        return;

      const isCtrl = e.ctrlKey || e.metaKey;

      // Ctrl+Z → Undo
      if (isCtrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const state = undo();
        if (state && onUndoRedoRef.current) {
          onUndoRedoRef.current.onApply(state);
        }
        return;
      }

      // Ctrl+Shift+Z or Ctrl+Y → Redo
      if (isCtrl && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault();
        const state = redo();
        if (state && onUndoRedoRef.current) {
          onUndoRedoRef.current.onApply(state);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, undo, redo]);

  return useMemo(
    () => ({
      pushState,
      undo,
      redo,
      clear,
      canUndo,
      canRedo,
      setOnApply,
      historyLength: history.length,
      currentIndex: historyIndex,
    }),
    [pushState, undo, redo, clear, canUndo, canRedo, setOnApply, history.length, historyIndex],
  );
}
