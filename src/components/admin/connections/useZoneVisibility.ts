/**
 * useZoneVisibility — Onda 14 + AI Router
 *
 * Estado de visibilidade por zona ("health" | "operation" | "connections" | "ai-router")
 * persistido em localStorage. Permite mostrar/ocultar zonas inteiras sem
 * recarregar a página, com guarda contra ocultar todas (mantém ao menos 1).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

export type ZoneId = 'ai-router' | 'connections' | 'health' | 'operation';

const STORAGE_KEY = 'connections.zone-visibility.v1';
const ALL_VISIBLE: Record<ZoneId, boolean> = {
  health: true,
  operation: true,
  connections: true,
  'ai-router': true,
};

function loadInitial(): Record<ZoneId, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...ALL_VISIBLE };
    const parsed = JSON.parse(raw) as Partial<Record<ZoneId, boolean>>;
    return { ...ALL_VISIBLE, ...parsed };
  } catch {
    return { ...ALL_VISIBLE };
  }
}

export function useZoneVisibility() {
  const [visible, setVisible] = useState<Record<ZoneId, boolean>>(loadInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visible));
    } catch {
      /* noop */
    }
  }, [visible]);

  const toggle = useCallback((zone: ZoneId) => {
    setVisible((prev) => {
      const next = { ...prev, [zone]: !prev[zone] };
      // Guarda: nunca deixar tudo oculto — re-habilita a zona alvo se for a única visível restante
      const anyVisible = Object.values(next).some(Boolean);
      if (!anyVisible) return prev;
      return next;
    });
  }, []);

  const showAll = useCallback(() => setVisible({ ...ALL_VISIBLE }), []);
  const isolateZone = useCallback((zone: ZoneId) => {
    setVisible({
      health: false,
      operation: false,
      connections: false,
      'ai-router': false,
      [zone]: true,
    });
  }, []);

  const hiddenCount = useMemo(() => Object.values(visible).filter((v) => !v).length, [visible]);

  return { visible, toggle, showAll, isolateZone, hiddenCount };
}
