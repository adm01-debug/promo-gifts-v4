/**
 * useZoneCollapse — Onda 14 + AI Router
 *
 * Estado de colapso por zona ("health" | "operation" | "connections" | "ai-router")
 * persistido em localStorage. Diferente de visibilidade (esconder do layout),
 * o colapso mantém o header visível mas oculta o conteúdo, permitindo
 * que o usuário "minimize" zonas para reduzir densidade sem perder navegação.
 */
import { useCallback, useEffect, useState } from 'react';
import type { ZoneId } from './useZoneVisibility';

const STORAGE_KEY = 'connections.zone-collapse.v1';
const ALL_EXPANDED: Record<ZoneId, boolean> = {
  health: false,
  operation: false,
  connections: false,
  'ai-router': false,
};

function loadInitial(): Record<ZoneId, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...ALL_EXPANDED };
    const parsed = JSON.parse(raw) as Partial<Record<ZoneId, boolean>>;
    return { ...ALL_EXPANDED, ...parsed };
  } catch {
    return { ...ALL_EXPANDED };
  }
}

export function useZoneCollapse() {
  const [collapsed, setCollapsed] = useState<Record<ZoneId, boolean>>(loadInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsed));
    } catch {
      /* noop */
    }
  }, [collapsed]);

  const toggle = useCallback((zone: ZoneId) => {
    setCollapsed((prev) => ({ ...prev, [zone]: !prev[zone] }));
  }, []);

  const expand = useCallback((zone: ZoneId) => {
    setCollapsed((prev) => (prev[zone] ? { ...prev, [zone]: false } : prev));
  }, []);

  const collapseAll = useCallback(
    () =>
      setCollapsed({
        health: true,
        operation: true,
        connections: true,
        'ai-router': true,
      }),
    [],
  );
  const expandAll = useCallback(() => setCollapsed({ ...ALL_EXPANDED }), []);

  return { collapsed, toggle, expand, collapseAll, expandAll };
}
