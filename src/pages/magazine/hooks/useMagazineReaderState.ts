/**
 * useMagazineReaderState — estado unificado do leitor da revista pública.
 *
 * Persistência:
 *  1. localStorage-first (síncrono, offline-friendly, latência zero)
 *  2. Sync best-effort com BD Gold (tabela `magazine_reader_state`) — se
 *     disponível. Em qualquer erro (tabela inexistente, RLS bloqueia,
 *     rede offline) o sync é desativado silenciosamente para a sessão
 *     e o localStorage segue como único ponto de verdade.
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
import { supabase } from '@/integrations/supabase/client';

// ---------- Chaves ----------
const BOOKMARKS_KEY = (token: string) => `mag:bookmarks:${token}`;
const LAST_PAGE_KEY = (token: string) => `mag:last-page:${token}`;
const FINGERPRINT_KEY = 'mag:fingerprint';
const REMOTE_DISABLED_KEY = 'mag:remote-disabled'; // flag persistente entre reloads
const TOAST_SHOWN_KEY = 'mag:remote-toast-shown'; // sessionStorage — 1x por aba

// ---------- Constantes ----------
const REMOTE_TABLE = 'magazine_reader_state';
const DEBOUNCE_MS = 600;
const MAX_BOOKMARKS = 500;
const REMOTE_TIMEOUT_MS = 4000;
const TOAST_ID = 'magazine-reader-state-remote-disabled';

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

function getOrCreateFingerprint(storage: Storage | null): string {
  if (!storage) {
    // fallback efêmero — sem persistência, mas coerente na sessão
    return `session-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  }
  try {
    const existing = storage.getItem(FINGERPRINT_KEY);
    if (existing && existing.length >= 8) return existing;
    const uuid =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    storage.setItem(FINGERPRINT_KEY, uuid);
    return uuid;
  } catch {
    return `session-${Math.random().toString(36).slice(2)}`;
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
  if (!storage) return;
  try {
    storage.setItem(REMOTE_DISABLED_KEY, '1');
  } catch {
    /* noop */
  }
  if (typeof console !== 'undefined' && typeof console.info === 'function') {
    // Log informativo (não é erro — é degradação esperada quando a tabela
    // ainda não foi promovida ao Gold ou quando RLS bloqueia o token).
    console.info('[magazine-reader-state] remote sync disabled:', reason);
  }
  notifyRemoteDisabled(reason);
}

/**
 * Feedback visual one-shot quando o sync remoto é desativado por RLS/permission/
 * tabela ausente. Guardado por `sessionStorage` — não repete no mesmo tab e
 * não atrapalha o leitor (o localStorage continua funcionando).
 */
function notifyRemoteDisabled(reason: string): void {
  if (typeof window === 'undefined') return;
  try {
    const ss = window.sessionStorage;
    if (ss.getItem(TOAST_SHOWN_KEY) === '1') return;
    ss.setItem(TOAST_SHOWN_KEY, '1');
  } catch {
    // sessionStorage indisponível — segue sem persistir; toast pode aparecer
    // 1x por render, mas o `id` do sonner deduplica dentro da mesma sessão.
  }

  const isPermission = /42501|PGRST301|permission denied/i.test(reason);
  const isMissing = /42P01|does not exist|Not Acceptable/i.test(reason);

  const description = isPermission
    ? 'Sem permissão para sincronizar (RLS). Seus marcadores continuam salvos neste dispositivo.'
    : isMissing
      ? 'Sincronização entre dispositivos ainda não está ativa. Marcadores salvos localmente.'
      : 'Falha ao sincronizar com o servidor. Marcadores salvos localmente.';

  toast.info('Modo local ativado', {
    id: TOAST_ID,
    description,
    duration: 6000,
  });
}

// Promise com timeout — evita que o botão de bookmark fique dependente
// de uma requisição pendurada por 30s se o BD estiver lento.
function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('remote-timeout')), ms);
    Promise.resolve(p).then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
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
  /**
   * `local-only`  → sync remoto desativado (offline, RLS, tabela ausente)
   * `syncing`     → tentativa em curso
   * `synced`      → última operação remota bem-sucedida
   */
  syncStatus: 'local-only' | 'syncing' | 'synced';
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

  // Buffers p/ debounce remoto
  const pendingRef = useRef<{ bookmarks: number[]; lastPageIndex: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteDisabledRef = useRef<boolean>(isRemoteDisabled(storage));

  // Re-hidrata local quando o token mudar (troca de revista)
  useEffect(() => {
    if (!token) {
      setBookmarks(new Set());
      setLastPageIndex(0);
      return;
    }
    setBookmarks(readBookmarksLocal(storage, token));
    setLastPageIndex(readLastPageLocal(storage, token));
  }, [token, storage]);

  // Sync entre abas: outra aba mudou os marcadores/última página
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

  // Fetch inicial do remoto + merge (union de bookmarks, max de lastPage)
  useEffect(() => {
    if (!token) return;
    if (remoteDisabledRef.current) {
      setSyncStatus('local-only');
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        setSyncStatus('syncing');
        const query = supabase
          .from(REMOTE_TABLE as never)
          .select('bookmarks,last_page_index')
          .eq('magazine_token', token)
          .eq('viewer_fingerprint', fingerprint)
          .maybeSingle();

        const { data, error } = (await withTimeout(query, REMOTE_TIMEOUT_MS)) as {
          data: { bookmarks: number[] | null; last_page_index: number | null } | null;
          error: { code?: string; message?: string } | null;
        };

        if (cancelled) return;

        if (error) {
          // 42P01 = tabela inexistente | 42501 = permission denied | PGRST* = PostgREST
          const code = error.code ?? '';
          const msg = error.message ?? '';
          if (
            code === '42P01' ||
            code === '42501' ||
            code === 'PGRST301' ||
            /permission denied|does not exist|Not Acceptable/i.test(msg)
          ) {
            remoteDisabledRef.current = true;
            disableRemote(storage, `${code || 'unknown'}: ${msg}`);
            setSyncStatus('local-only');
            return;
          }
          // Outros erros: mantém local-only nesta sessão, sem persistir flag
          setSyncStatus('local-only');
          return;
        }

        if (data) {
          const remoteBk = Array.isArray(data.bookmarks)
            ? data.bookmarks.filter((n) => Number.isFinite(n) && n >= 0)
            : [];
          const remoteLast =
            typeof data.last_page_index === 'number' && data.last_page_index >= 0
              ? data.last_page_index
              : 0;

          setBookmarks((current) => {
            const union = new Set<number>(current);
            for (const n of remoteBk) union.add(n);
            // Se a fusão mudou algo, persiste local (mantém consistência)
            if (union.size !== current.size) {
              writeBookmarksLocal(storage, token, union);
              return union;
            }
            return current;
          });

          setLastPageIndex((current) => {
            // Se o remoto está à frente, adota; senão mantém local (usuário
            // pode ter avançado offline).
            if (remoteLast > current) {
              writeLastPageLocal(storage, token, remoteLast);
              return remoteLast;
            }
            return current;
          });
        }

        setSyncStatus('synced');
      } catch (err) {
        if (cancelled) return;
        // Timeout, offline, ou outro — degradar para local-only nesta sessão
        // (sem persistir a flag; próxima sessão tenta de novo).
        setSyncStatus('local-only');
        if (typeof console !== 'undefined') {
          console.info('[magazine-reader-state] initial fetch failed, going local-only:', err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, fingerprint, storage]);

  // Envia buffer pendente para o remoto (debounced)
  const flushRemote = useCallback(async () => {
    if (!token || remoteDisabledRef.current) return;
    const payload = pendingRef.current;
    if (!payload) return;
    pendingRef.current = null;

    try {
      setSyncStatus('syncing');
      const upsert = supabase.from(REMOTE_TABLE as never).upsert(
        {
          magazine_token: token,
          viewer_fingerprint: fingerprint,
          bookmarks: payload.bookmarks,
          last_page_index: payload.lastPageIndex,
        } as never,
        { onConflict: 'magazine_token,viewer_fingerprint' },
      );
      const { error } = (await withTimeout(upsert, REMOTE_TIMEOUT_MS)) as {
        error: { code?: string; message?: string } | null;
      };
      if (error) {
        const code = error.code ?? '';
        const msg = error.message ?? '';
        if (
          code === '42P01' ||
          code === '42501' ||
          code === 'PGRST301' ||
          /permission denied|does not exist/i.test(msg)
        ) {
          remoteDisabledRef.current = true;
          disableRemote(storage, `write:${code || 'unknown'}:${msg}`);
        }
        setSyncStatus('local-only');
        return;
      }
      setSyncStatus('synced');
    } catch {
      setSyncStatus('local-only');
    }
  }, [token, fingerprint, storage]);

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

  // Flush ao desmontar / trocar de token — evita perder writes pendentes
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      // Best-effort: dispara flush final (fire-and-forget)
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
        else return current; // limite de segurança — ignora silenciosamente
        writeBookmarksLocal(storage, token, next);
        scheduleRemote(Array.from(next).sort((a, b) => a - b), lastPageIndex);
        return next;
      });
    },
    [token, storage, scheduleRemote, lastPageIndex],
  );

  const clearBookmarks = useCallback(() => {
    if (!token) return;
    setBookmarks(() => {
      const next = new Set<number>();
      writeBookmarksLocal(storage, token, next);
      scheduleRemote([], lastPageIndex);
      return next;
    });
  }, [token, storage, scheduleRemote, lastPageIndex]);

  const setLastPage = useCallback(
    (index: number) => {
      if (!token || !Number.isFinite(index) || index < 0) return;
      const safe = Math.floor(index);
      setLastPageIndex((current) => {
        if (current === safe) return current;
        writeLastPageLocal(storage, token, safe);
        scheduleRemote(Array.from(bookmarks).sort((a, b) => a - b), safe);
        return safe;
      });
    },
    [token, storage, scheduleRemote, bookmarks],
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
