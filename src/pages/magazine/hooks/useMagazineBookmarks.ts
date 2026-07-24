/**
 * useMagazineBookmarks — marcadores por página, persistidos em localStorage.
 * Chave: `mag:bookmarks:<token>` -> JSON array de índices numéricos.
 */
import { useCallback, useEffect, useState } from 'react';

const KEY = (token: string) => `mag:bookmarks:${token}`;

function read(token: string | undefined): Set<number> {
  if (!token) return new Set();
  try {
    const raw = localStorage.getItem(KEY(token));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((n): n is number => Number.isFinite(n)));
  } catch {
    return new Set();
  }
}

export function useMagazineBookmarks(token: string | undefined) {
  const [bookmarks, setBookmarks] = useState<Set<number>>(() => read(token));

  useEffect(() => {
    setBookmarks(read(token));
  }, [token]);

  // M: sync entre abas — outra aba mudou os marcadores da mesma revista
  useEffect(() => {
    if (!token) return;
    const key = KEY(token);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      setBookmarks(read(token));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [token]);

  const persist = useCallback(
    (next: Set<number>) => {
      if (!token) return;
      try {
        localStorage.setItem(KEY(token), JSON.stringify(Array.from(next).sort((a, b) => a - b)));
      } catch {
        /* silencioso */
      }
    },
    [token],
  );

  const toggle = useCallback(
    (index: number) => {
      setBookmarks((current) => {
        const next = new Set(current);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const clear = useCallback(() => {
    setBookmarks(() => {
      const next = new Set<number>();
      persist(next);
      return next;
    });
  }, [persist]);

  const has = useCallback((index: number) => bookmarks.has(index), [bookmarks]);

  return { bookmarks, toggle, has, clear };
}
