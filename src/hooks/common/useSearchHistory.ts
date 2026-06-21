import { useState, useEffect, useCallback } from 'react';

import { logger } from '@/lib/logger';
export type HistoryType = 'company' | 'general' | 'product';

export interface HistoryItem {
  id: string;
  label: string;
  type: HistoryType;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

const STORAGE_KEY = 'global-search-history-v2';
const MAX_HISTORY = 10;

export function useSearchHistory(type?: HistoryType) {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const loadHistory = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: HistoryItem[] = JSON.parse(stored);
        // Respeita os limites documentados (mesmo que addToHistory aplica):
        // 50 total no storage cross-type, MAX_HISTORY (10) visíveis por tipo.
        const capped = parsed.slice(0, 50);
        if (type) {
          setHistory(capped.filter((item) => item.type === type).slice(0, MAX_HISTORY));
        } else {
          setHistory(capped.slice(0, MAX_HISTORY));
        }
      }
    } catch (e) {
      logger.error('Failed to load search history', e);
    }
  }, [type]);

  useEffect(() => {
    loadHistory();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) loadHistory();
    };

    // Custom event for same-tab updates
    const handleCustomUpdate = () => loadHistory();

    window.addEventListener('storage', handleStorage);
    window.addEventListener('search-history-update', handleCustomUpdate);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('search-history-update', handleCustomUpdate);
    };
  }, [loadHistory]);

  const addToHistory = useCallback(
    (item: Omit<HistoryItem, 'timestamp'>) => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const allItems: HistoryItem[] = stored ? JSON.parse(stored) : [];

        const newItem: HistoryItem = { ...item, timestamp: Date.now() };

        // Remove existing item with same ID/Label to avoid duplicates
        const filtered = allItems.filter(
          (i) =>
            !(i.id === newItem.id && i.type === newItem.type) &&
            !(i.label.toLowerCase() === newItem.label.toLowerCase() && i.type === newItem.type),
        );

        const updated = [newItem, ...filtered].slice(0, 50); // Keep 50 total across all types

        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

        if (!type || newItem.type === type) {
          setHistory(updated.filter((i) => !type || i.type === type).slice(0, MAX_HISTORY));
        }

        // Dispatch custom event for same-tab updates
        window.dispatchEvent(new Event('search-history-update'));
      } catch (e) {
        logger.error('Failed to save search history', e);
      }
    },
    [type],
  );

  const removeFromHistory = useCallback((id: string) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;

      const allItems: HistoryItem[] = JSON.parse(stored);
      const updated = allItems.filter((i) => i.id !== id);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setHistory((prev) => prev.filter((i) => i.id !== id));

      window.dispatchEvent(new Event('search-history-update'));
    } catch (e) {
      logger.error('Failed to remove search history', e);
    }
  }, []);

  const clearHistory = useCallback(() => {
    try {
      if (type) {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return;
        const allItems: HistoryItem[] = JSON.parse(stored);
        const updated = allItems.filter((i) => i.type !== type);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        setHistory([]);
      } else {
        localStorage.removeItem(STORAGE_KEY);
        setHistory([]);
      }
      window.dispatchEvent(new Event('search-history-update'));
    } catch (e) {
      logger.error('Failed to clear search history', e);
    }
  }, [type]);

  return {
    history,
    addToHistory,
    removeFromHistory,
    clearHistory,
    refreshHistory: loadHistory,
  };
}
