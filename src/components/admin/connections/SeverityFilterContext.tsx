/**
 * SeverityFilterContext — Onda 14
 *
 * Estado global compartilhado de filtro por severidade (P0/P1/P2/all) para
 * o módulo /admin/conexoes. Persiste em:
 *   - URL (search param `severity`) — para deep-linking e refresh
 *   - localStorage (`connections.severityFilter`) — para manter entre sessões
 *
 * Ao filtrar:
 *   - ConnectionsIncidentStrip mostra apenas incidentes com severidade ≥ filtro
 *   - ConnectionsPulseBar permanece global (mostra status real do sistema)
 *   - Outras tabelas que opte usar `useSeverityFilter()` aplicam o mesmo critério
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export type SeverityFilter = 'all' | 'P0' | 'P1' | 'P2';

const STORAGE_KEY = 'connections.severityFilter';
const VALID: SeverityFilter[] = ['all', 'P0', 'P1', 'P2'];

function readInitial(searchParams: URLSearchParams): SeverityFilter {
  const fromUrl = searchParams.get('severity');
  if (fromUrl && (VALID as string[]).includes(fromUrl)) return fromUrl as SeverityFilter;
  if (typeof window !== 'undefined') {
    const fromStorage = window.localStorage.getItem(STORAGE_KEY);
    if (fromStorage && (VALID as string[]).includes(fromStorage))
      return fromStorage as SeverityFilter;
  }
  return 'all';
}

interface Ctx {
  filter: SeverityFilter;
  setFilter: (f: SeverityFilter) => void;
  /** True quando o filtro inclui a severidade dada. */
  matches: (sev: 'P0' | 'P1' | 'P2') => boolean;
}

const SeverityFilterContext = createContext<Ctx | undefined>(undefined);

export function SeverityFilterProvider({ children }: { children: React.ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilterState] = useState<SeverityFilter>(() => readInitial(searchParams));

  // Sincroniza URL ↔ estado quando o usuário navega via querystring externa.
  useEffect(() => {
    const fromUrl = searchParams.get('severity');
    if (fromUrl && (VALID as string[]).includes(fromUrl) && fromUrl !== filter) {
      setFilterState(fromUrl as SeverityFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const setFilter = useCallback(
    (next: SeverityFilter) => {
      setFilterState(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore quota errors */
      }
      setSearchParams(
        (prev) => {
          const sp = new URLSearchParams(prev);
          if (next === 'all') sp.delete('severity');
          else sp.set('severity', next);
          return sp;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const matches = useCallback(
    (sev: 'P0' | 'P1' | 'P2') => {
      if (filter === 'all') return true;
      return filter === sev;
    },
    [filter],
  );

  const value = useMemo<Ctx>(() => ({ filter, setFilter, matches }), [filter, setFilter, matches]);

  return <SeverityFilterContext.Provider value={value}>{children}</SeverityFilterContext.Provider>;
}

export function useSeverityFilter() {
  const ctx = useContext(SeverityFilterContext);
  if (!ctx) {
    // Fallback no-op para componentes usados fora do provider (ex: testes
    // unitários ou montagem isolada). Mantém o módulo previsível.
    return {
      filter: 'all' as SeverityFilter,
      setFilter: () => {},
      matches: () => true,
    };
  }
  return ctx;
}
