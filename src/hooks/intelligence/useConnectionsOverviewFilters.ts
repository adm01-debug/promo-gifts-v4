import { useCallback, useEffect, useMemo, useState } from 'react';
import type { OverviewRow } from '@/hooks/intelligence';
import type { ConsecutiveFailureInfo } from '@/hooks/common';
import { CONSECUTIVE_FAILURE_THRESHOLD } from '@/lib/connections-config';

export type OverviewStatusFilter = 'all' | 'fail' | 'ok';
export type OverviewWindowFilter = '1h' | '5m' | '7d' | '24h' | 'any' | 'never';

export interface OverviewFilters {
  types: string[];
  status: OverviewStatusFilter;
  window: OverviewWindowFilter;
  onlyConsecutiveFailures: boolean;
}

const DEFAULT_FILTERS: OverviewFilters = {
  types: [],
  status: 'all',
  window: 'any',
  onlyConsecutiveFailures: false,
};

const STORAGE_KEY = 'connections-overview-filters';

const WINDOW_MS: Record<Exclude<OverviewWindowFilter, 'any' | 'never'>, number> = {
  '5m': 5 * 60_000,
  '1h': 60 * 60_000,
  '24h': 24 * 60 * 60_000,
  '7d': 7 * 24 * 60 * 60_000,
};

export function applyFilters(
  rows: OverviewRow[],
  filters: OverviewFilters,
  consecutiveFailuresMap?: Map<string, ConsecutiveFailureInfo>,
  now: number = Date.now(),
): OverviewRow[] {
  return rows.filter((r) => {
    if (filters.types.length > 0 && !filters.types.includes(r.type)) return false;

    if (filters.status === 'ok' && r.last_test_ok !== true) return false;
    if (filters.status === 'fail' && r.last_test_ok !== false) return false;

    if (filters.window === 'never') {
      if (r.last_test_at !== null) return false;
    } else if (filters.window !== 'any') {
      if (!r.last_test_at) return false;
      const ts = new Date(r.last_test_at).getTime();
      if (Number.isNaN(ts)) return false;
      if (now - ts > WINDOW_MS[filters.window]) return false;
    }

    if (filters.onlyConsecutiveFailures) {
      const info = consecutiveFailuresMap?.get(r.key);
      if (!info || info.count < CONSECUTIVE_FAILURE_THRESHOLD) return false;
    }

    return true;
  });
}

export function useConnectionsOverviewFilters() {
  const [filters, setFilters] = useState<OverviewFilters>(() => {
    if (typeof window === 'undefined') return DEFAULT_FILTERS;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_FILTERS;
      const parsed = JSON.parse(raw);
      return {
        types: Array.isArray(parsed.types) ? parsed.types : [],
        status: ['all', 'ok', 'fail'].includes(parsed.status) ? parsed.status : 'all',
        window: ['any', '5m', '1h', '24h', '7d', 'never'].includes(parsed.window)
          ? parsed.window
          : 'any',
        onlyConsecutiveFailures:
          typeof parsed.onlyConsecutiveFailures === 'boolean'
            ? parsed.onlyConsecutiveFailures
            : false,
      };
    } catch {
      return DEFAULT_FILTERS;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch {
      // ignore quota / privacy errors
    }
  }, [filters]);

  const toggleType = useCallback((type: string) => {
    setFilters((f) => ({
      ...f,
      types: f.types.includes(type) ? f.types.filter((t) => t !== type) : [...f.types, type],
    }));
  }, []);

  const setStatus = useCallback((status: OverviewStatusFilter) => {
    setFilters((f) => ({ ...f, status }));
  }, []);

  const setWindow = useCallback((window: OverviewWindowFilter) => {
    setFilters((f) => ({ ...f, window }));
  }, []);

  const removeType = useCallback((type: string) => {
    setFilters((f) => ({ ...f, types: f.types.filter((t) => t !== type) }));
  }, []);

  const setOnlyConsecutiveFailures = useCallback((value: boolean) => {
    setFilters((f) => ({ ...f, onlyConsecutiveFailures: value }));
  }, []);

  const reset = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const activeCount = useMemo(() => {
    let n = filters.types.length;
    if (filters.status !== 'all') n += 1;
    if (filters.window !== 'any') n += 1;
    if (filters.onlyConsecutiveFailures) n += 1;
    return n;
  }, [filters]);

  return {
    filters,
    setFilters,
    toggleType,
    setStatus,
    setWindow,
    removeType,
    setOnlyConsecutiveFailures,
    reset,
    activeCount,
  };
}
