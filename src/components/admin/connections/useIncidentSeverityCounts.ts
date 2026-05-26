/**
 * useIncidentSeverityCounts — Onda 14
 *
 * Conta os incidentes recentes agrupados por severidade. Usado pelo
 * SeverityFilterControl para exibir badges de contagem nas pills.
 */
import { useMemo } from 'react';
import { useRecentIncidents } from './useRecentIncidents';

export function useIncidentSeverityCounts() {
  const { data } = useRecentIncidents();
  return useMemo(() => {
    const c = { P0: 0, P1: 0, P2: 0, total: 0 };
    for (const i of data ?? []) {
      c[i.severity]++;
      c.total++;
    }
    return c;
  }, [data]);
}
