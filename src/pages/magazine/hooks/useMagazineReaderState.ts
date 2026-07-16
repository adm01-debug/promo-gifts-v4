/**
 * useMagazineReaderState — estado unificado do leitor da revista pública.
 *
 * FIX C1 (auditoria BD, 2026-07-12): este hook ANTES fazia
 * `supabase.from('magazine_reader_state').select/upsert(...)` DIRETO do
 * client anônimo. Com `GRANT SELECT ... TO anon` + `USING (true)`, qualquer
 * visitante conseguia listar `magazine_token` de TODAS as revistas do
 * sistema — o token é a credencial de acesso das revistas públicas.
 *
 * A correção fecha `anon` em TODAS as tabelas magazine_* via RLS+REVOKE no
 * banco, e este hook passa a falar exclusivamente com duas edge functions
 * que usam service_role internamente e nunca expõem o token cru ao BD
 * (gravam sha256(token), não o token):
 *
 *   - GET  magazine-reader-state-read  → busca bookmarks/last-page
 *   - POST magazine-reader-state-write → upsert (debounced)
 *
 * Persistência:
 *  1. localStorage-first (síncrono, offline-friendly, latência zero)
 *  2. Sync best-effort com as edges acima. Em qualquer erro (edge fora do
 *     ar, rede offline, revista despublicada) o sync é desativado
 *     silenciosamente para a sessão e o localStorage segue como único
 *     ponto de verdade.
 *
 * Chaves compatíveis com hooks legados:
 *  - `mag:bookmarks:<token>`   → number[]
 *  - `mag:last-page:<token>`   → string(index)
 *  - `mag:fingerprint`         → uuid do dispositivo (gerado 1x)
 *
 * Contrato: nunca lança, nunca bloqueia render, nunca depende de rede.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

// ---------- Chaves ----------
const BOOKMARKS_KEY = (token: string) => `mag:bookmarks:${token}`;
const LAST_PAGE_KEY = (token: string) => `mag:last-page:${token}`;
const FINGERPRINT_KEY = 'mag:fingerprint';
const REMOTE_DISABLED_KEY = 'mag:remote-disabled'; // flag persistente entre reloads
const TOAST_SHOWN_KEY = 'mag:remote-toast-shown'; // sessionStorage — 1x por aba

// ---------- Constantes ----------
const DEBOUNCE_MS = 600;
const MAX_BOOKMARKS = 500;
const REMOTE_TIMEOUT_MS = 4000;
const TOAST_ID = 'magazine-reader-state-remote-disabled';

// FIX C1: URLs das edge functions (nunca acessa a tabela direto)
const SUPABASE_FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1`;
const READ_ENDPOINT = `${SUPABASE_FUNCTIONS_URL}/magazine-reader-state-read`;
const WRITE_ENDPOINT = `${SUPABASE_FUNCTIONS_URL}/magazine-reader-state-write`;

// ---------- Utils ----------
function safeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    const s = window.localStorage;
    // testa disponibilidade (modo privado do Safari lança)
    s.setItem('__mag_probe__', '1');
    s.removeItem('__mag_probe__');
    return s;
  } catch {
    return null;
  }
}

function readBookmarksLocal(storage: Storage | null, token: string): Set<number> {
  if (!storage) return new Set();
  try {
    const raw = storage.getItem(BOOKMARKS_KEY(token));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((n): n is number => Number.isFinite(n) && n >= 0));
  } catch {
    return new Set();
  }
}

function readLastPageLocal(storage: Storage | null, token: string): number {
  if (!storage) return 0;
  try {
    const raw = storage.getItem(LAST_PAGE_KEY(token));
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function writeBookmarksLocal(storage: Storage | null, token: string, next: Set<number>): void {
  if (!storage) return;
  try {
    const arr = Array.from(next).sort((a, b) => a - b);
    storage.setItem(BOOKMARKS_KEY(token), JSON.stringify(arr));
  } catch {
    /* quota exceeded / modo privado — silencioso */
  }
}

function writeLastPageLocal(storage: Storage | null, token: string, index: number): void {
  if (!storage) return;
  try {
    storage.setItem(LAST_PAGE_KEY(token), String(index));
  } catch {
    /* silencioso */
  }
}

function cryptoUUID(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback: use getRandomValues (CSPRNG) instead of Math.random
  const bytes = new Uint8Array(16);
  (globalThis.crypto || window.crypto).getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

function getOrCreateFingerprint(storage: Storage | null): string {
  if (!storage) {
    return `session-${cryptoUUID()}`;
  }
  try {
    const existing = storage.getItem(FINGERPRINT_KEY);
    if (existing && existing.length >= 8) return existing;
    const uuid = cryptoUUID();
    storage.setItem(FINGERPRINT_KEY, uuid);
    return uuid;
  } catch {
    return `session-${cryptoUUID()}`;
  }
}

function isRemoteDisabled(storage: Storage | null): boolean {
  if (!storage) return true;
  try {
    return storage.getItem(REMOTE_DISABLED_KEY) === '1';
  } catch {
    return true;
  }
}

function disableRemote(storage: Storage | null, reason: string): void {
  if (storage) {
    try {
      storage.setItem(REMOTE_DISABLED_KEY, '1');
    } catch {
      /* noop */
    }
  }
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn('[magazine-reader-state] remote sync disabled:', reason);
  }
  notifyRemoteDisabled(reason);
}

function notifyRemoteDisabled(reason: string): void {
  if (typeof window === 'undefined') return;
  try {
    const ss = window.sessionStorage;
    if (ss.getItem(TOAST_SHOWN_KEY) === '1') return;
    ss.setItem(TOAST_SHOWN_KEY, '1');
  } catch {
    // sessionStorage indisponível — segue sem persistir
  }

  const isUnauthorized = /401|invalid_or_expired/i.test(reason);
  const isServiceDown = /503|sync_disabled/i.test(reason);

  const description = isUnauthorized
    ? 'Este link expirou. Seus marcadores continuam salvos neste dispositivo.'
    : isServiceDown
      ? 'Sincronização temporariamente indisponível. Marcadores salvos localmente.'
      : 'Falha ao sincronizar com o servidor. Marcadores salvos localmente.';

  toast.info('Modo local ativado', {
    id: TOAST_ID,
    description,
    duration: 6000,
  });
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('remote-timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

// ---------- Tipos ----------
export interface MagazineReaderState {
  bookmarks: Set<number>;
  lastPageIndex: number;
  hasBookmark: (index: number) => boolean;
  toggleBookmark: (index: number) => void;
  clearBookmarks: () => void;
  setLastPage: (index: number) => void;
  syncStatus: 'local-only' | 'synced' | 'syncing';
}

// ---------- Hook ----------
export function useMagazineReaderState(token: string | undefined): MagazineReaderState {
  const storage = useMemo(() => safeStorage(), []);
  const fingerprint = useMemo(() => getOrCreateFingerprint(storage), [storage]);

  const [bookmarks, setBookmarks] = useState<Set<number>>(() =>
    token ? readBookmarksLocal(storage, token) : new Set(),
  );
  const [lastPageIndex, setLastPageIndex] = useState<number>(() =>
    token ? readLastPageLocal(storage, token) : 0,
  );
  const [syncStatus, setSyncStatus] = useState<MagazineReaderState['syncStatus']>(() =>
    isRemoteDisabled(storage) ? 'local-only' : 'syncing',
  );

  const pendingRef = useRef<{ bookmarks: number[]; lastPageIndex: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteDisabledRef = useRef<boolean>(isRemoteDisabled(storage));
  const bookmarksRef = useRef<Set<number>>(bookmarks);
  const lastPageIndexRef = useRef<number>(lastPageIndex);
  bookmarksRef.current = bookmarks;
  lastPageIndexRef.current = lastPageIndex;
  const isMountedRef = useRef<boolean>(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  const safeSetSyncStatus = useCallback((s: MagazineReaderState['syncStatus']) => {
    if (isMountedRef.current) setSyncStatus(s);
  }, []);

  useEffect(() => {
    if (!token) {
      setBookmarks(new Set());
      setLastPageIndex(0);
      return;
    }
    setBookmarks(readBookmarksLocal(storage, token));
    setLastPageIndex(readLastPageLocal(storage, token));
  }, [token, storage]);

  useEffect(() => {
    if (!token || !storage) return;
    const bkKey = BOOKMARKS_KEY(token);
    const lpKey = LAST_PAGE_KEY(token);
    const onStorage = (e: StorageEvent) => {
      if (e.key === bkKey) setBookmarks(readBookmarksLocal(storage, token));
      else if (e.key === lpKey) setLastPageIndex(readLastPageLocal(storage, token));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [token, storage]);

  // FIX C1: fetch inicial via edge magazine-reader-state-read (nunca a tabela direto)
  useEffect(() => {
    if (!token) return;
    if (remoteDisabledRef.current) {
      safeSetSyncStatus('local-only');
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        safeSetSyncStatus('syncing');
        const url = `${READ_ENDPOINT}?token=${encodeURIComponent(token)}&fingerprint=${encodeURIComponent(fingerprint)}`;
        const res = await withTimeout(fetch(url, { method: 'GET' }), REMOTE_TIMEOUT_MS);

        if (cancelled) return;

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: `http_${res.status}` }));
          const reason = `${res.status}:${body?.error ?? 'unknown'}`;
          if (res.status === 401 || res.status === 503) {
            remoteDisabledRef.current = true;
            disableRemote(storage, reason);
          }
          safeSetSyncStatus('local-only');
          return;
        }

        const data = (await res.json()) as { bookmarks: number[]; lastPageIndex: number };
        const remoteBk = Array.isArray(data.bookmarks)
          ? data.bookmarks.filter((n) => Number.isFinite(n) && n >= 0)
          : [];
        const remoteLast =
          typeof data.lastPageIndex === 'number' && data.lastPageIndex >= 0 ? data.lastPageIndex : 0;

        setBookmarks((current) => {
          const union = new Set<number>(current);
          for (const n of remoteBk) union.add(n);
          if (union.size !== current.size) {
            writeBookmarksLocal(storage, token, union);
            return union;
          }
          return current;
        });

        setLastPageIndex((current) => {
          if (remoteLast > current) {
            writeLastPageLocal(storage, token, remoteLast);
            return remoteLast;
          }
          return current;
        });

        safeSetSyncStatus('synced');
      } catch (err) {
        if (cancelled) return;
        safeSetSyncStatus('local-only');
        if (typeof console !== 'undefined') {
          console.warn('[magazine-reader-state] initial fetch failed, going local-only:', err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, fingerprint, storage, safeSetSyncStatus]);

  // FIX C1: envia via edge magazine-reader-state-write (nunca upsert direto na tabela)
  const flushRemote = useCallback(async () => {
    if (!token || remoteDisabledRef.current) return;
    const payload = pendingRef.current;
    if (!payload) return;
    pendingRef.current = null;

    try {
      safeSetSyncStatus('syncing');
      const res = await withTimeout(
        fetch(WRITE_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            fingerprint,
            bookmarks: payload.bookmarks,
            lastPageIndex: payload.lastPageIndex,
          }),
        }),
        REMOTE_TIMEOUT_MS,
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `http_${res.status}` }));
        const reason = `write:${res.status}:${body?.error ?? 'unknown'}`;
        if (res.status === 401 || res.status === 503) {
          remoteDisabledRef.current = true;
          disableRemote(storage, reason);
        }
        safeSetSyncStatus('local-only');
        return;
      }

      safeSetSyncStatus('synced');
    } catch {
      safeSetSyncStatus('local-only');
    }
  }, [token, fingerprint, storage, safeSetSyncStatus]);

  const scheduleRemote = useCallback(
    (bkList: number[], lastIdx: number) => {
      if (remoteDisabledRef.current) return;
      pendingRef.current = { bookmarks: bkList, lastPageIndex: lastIdx };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void flushRemote();
      }, DEBOUNCE_MS);
    },
    [flushRemote],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      void flushRemote();
    };
  }, [flushRemote]);

  // ---------- API pública ----------
  const hasBookmark = useCallback((index: number) => bookmarks.has(index), [bookmarks]);

  const toggleBookmark = useCallback(
    (index: number) => {
      if (!token || !Number.isFinite(index) || index < 0) return;
      setBookmarks((current) => {
        const next = new Set(current);
        if (next.has(index)) next.delete(index);
        else if (next.size < MAX_BOOKMARKS) next.add(index);
        else return current;
        writeBookmarksLocal(storage, token, next);
        scheduleRemote(Array.from(next).sort((a, b) => a - b), lastPageIndexRef.current);
        return next;
      });
    },
    [token, storage, scheduleRemote],
  );

  const clearBookmarks = useCallback(() => {
    if (!token) return;
    setBookmarks(() => {
      const next = new Set<number>();
      writeBookmarksLocal(storage, token, next);
      scheduleRemote([], lastPageIndexRef.current);
      return next;
    });
  }, [token, storage, scheduleRemote]);

  const setLastPage = useCallback(
    (index: number) => {
      if (!token || !Number.isFinite(index) || index < 0) return;
      const safe = Math.floor(index);
      setLastPageIndex((current) => {
        if (current === safe) return current;
        writeLastPageLocal(storage, token, safe);
        scheduleRemote(
          Array.from(bookmarksRef.current).sort((a, b) => a - b),
          safe,
        );
        return safe;
      });
    },
    [token, storage, scheduleRemote],
  );

  return {
    bookmarks,
    lastPageIndex,
    hasBookmark,
    toggleBookmark,
    clearBookmarks,
    setLastPage,
    syncStatus,
  };
}
