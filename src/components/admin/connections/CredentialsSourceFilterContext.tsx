import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { SecretStatus } from '@/hooks/admin';

export type CredentialSource = 'all' | 'db' | 'env' | 'none';

interface Ctx {
  filter: CredentialSource;
  setFilter: (f: CredentialSource) => void;
  matchesFilter: (status?: SecretStatus) => boolean;
}

const CredentialsSourceFilterContext = createContext<Ctx | null>(null);

function resolveSource(status?: SecretStatus): 'db' | 'env' | 'none' {
  if (!status) return 'none';
  if (status.source) return status.source;
  if (status.env_fallback_active) return 'env';
  return status.has_value ? 'db' : 'none';
}

export function CredentialsSourceFilterProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useSearchParams();
  const raw = params.get('source');
  const filter: CredentialSource = raw === 'db' || raw === 'env' || raw === 'none' ? raw : 'all';

  const setFilter = useCallback(
    (next: CredentialSource) => {
      const np = new URLSearchParams(params);
      if (next === 'all') np.delete('source');
      else np.set('source', next);
      setParams(np, { replace: true });
    },
    [params, setParams],
  );

  const matchesFilter = useCallback(
    (status?: SecretStatus) => {
      if (filter === 'all') return true;
      return resolveSource(status) === filter;
    },
    [filter],
  );

  const value = useMemo(
    () => ({ filter, setFilter, matchesFilter }),
    [filter, setFilter, matchesFilter],
  );
  return (
    <CredentialsSourceFilterContext.Provider value={value}>
      {children}
    </CredentialsSourceFilterContext.Provider>
  );
}

export function useCredentialsSourceFilter(): Ctx {
  const ctx = useContext(CredentialsSourceFilterContext);
  if (!ctx) {
    // Safe no-op fallback when used outside provider
    return {
      filter: 'all',
      setFilter: () => {},
      matchesFilter: () => true,
    };
  }
  return ctx;
}

export { resolveSource };
