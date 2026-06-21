/**
 * useUndoRedo - History stack wrapper for useReducer
 *
 * Wraps a reducer to add undo/redo capabilities via a history stack.
 * Only meaningful actions are tracked (not UI-only state changes).
 */

import { useReducer, useCallback } from 'react';

interface HistoryState<S> {
  past: S[];
  present: S;
  future: S[];
}

/** Actions that are worth tracking in the undo history */
const TRACKED_ACTIONS = new Set([
  'SELECT_PRODUCT',
  'SET_QUANTITY',
  'SELECT_LOCATION',
  'UPDATE_SPECS',
  'ADD_PERSONALIZATION',
  'UPDATE_PERSONALIZATION',
  'REMOVE_PERSONALIZATION',
  'DUPLICATE_PERSONALIZATION',
]);

const MAX_HISTORY = 30;

export function useUndoableReducer<S, A extends { type: string }>(
  reducer: (state: S, action: A) => S,
  initialState: S,
  initializer?: (init: S) => S,
) {
  const init = initializer ? initializer(initialState) : initialState;

  const historyReducer = useCallback(
    (
      history: HistoryState<S>,
      action: A | { type: '__REDO__' } | { type: '__UNDO__' },
    ): HistoryState<S> => {
      switch (action.type) {
        case '__UNDO__': {
          if (history.past.length === 0) return history;
          const previous = history.past[history.past.length - 1];
          return {
            past: history.past.slice(0, -1),
            present: previous,
            future: [history.present, ...history.future].slice(0, MAX_HISTORY),
          };
        }
        case '__REDO__': {
          if (history.future.length === 0) return history;
          const next = history.future[0];
          return {
            past: [...history.past, history.present].slice(-MAX_HISTORY),
            present: next,
            future: history.future.slice(1),
          };
        }
        default: {
          const newPresent = reducer(history.present, action as A);
          if (newPresent === history.present) return history;

          // Only push to history for tracked actions
          if (TRACKED_ACTIONS.has(action.type)) {
            return {
              past: [...history.past, history.present].slice(-MAX_HISTORY),
              present: newPresent,
              future: [], // Clear future on new action
            };
          }

          // For non-tracked actions, just update present
          return { ...history, present: newPresent };
        }
      }
    },
    [reducer],
  );

  const [history, historyDispatch] = useReducer(historyReducer, {
    past: [],
    present: init,
    future: [],
  });

  const dispatch = useCallback((action: A) => {
    historyDispatch(action);
  }, []);

  const undo = useCallback(() => {
    historyDispatch({ type: '__UNDO__' });
  }, []);

  const redo = useCallback(() => {
    historyDispatch({ type: '__REDO__' });
  }, []);

  return {
    state: history.present,
    dispatch,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    historyLength: history.past.length,
  };
}
