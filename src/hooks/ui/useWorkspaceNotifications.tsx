import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { untypedFrom } from '@/lib/supabase-untyped';
import { useAuth } from '@/contexts/AuthContext';
import { notificationsMetrics, type FetchSource } from '@/lib/notifications-metrics';
import { createClientLogger } from '@/lib/telemetry/structuredLogger';

import { logger } from '@/lib/logger';
export interface WorkspaceNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'error' | 'info' | 'success' | 'warning';
  category: string;
  is_read: boolean;
  action_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

const CACHE_PREFIX = 'workspace_notifications_cache:';
const CACHE_TTL_MS = 60_000; // 60s
const PREFETCH_MIN_INTERVAL_MS = 5_000; // 5s

interface CacheEntry {
  cachedAt: number;
  notifications: WorkspaceNotification[];
}

function readCache(userId: string): CacheEntry | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(userId: string, notifications: WorkspaceNotification[]) {
  try {
    const entry: CacheEntry = { cachedAt: Date.now(), notifications };
    sessionStorage.setItem(CACHE_PREFIX + userId, JSON.stringify(entry));
  } catch {
    // ignore quota / serialization issues
  }
}

function isDebugEnabled(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    if (window.localStorage?.getItem('debug:notifications') === '1') return true;
    return Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);
  } catch {
    return false;
  }
}

function debugLog(event: string, payload: Record<string, unknown>) {
  if (!isDebugEnabled()) return;
  const log = createClientLogger(`notifications.${event}`);
  log.info('event', payload);
}

export function useWorkspaceNotifications() {
  // BUG-NOTIF-403 FIX: importar rolesLoaded para evitar race condition.
  // Sem rolesLoaded, o hook disparava HEAD requests em workspace_notifications
  // antes do JWT estar validado, causando "Falha ao carregar Buscar: HEAD ...".
  // rolesLoaded=true garante que fetchUserData() completou e o JWT está válido.
  // Espelha o fix de BUG-DAR-401 em DiscountApprovalHeaderBadge (2026-06-18).
  const { user, rolesLoaded } = useAuth();
  const [notifications, setNotifications] = useState<WorkspaceNotification[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [isMutationRehydrating, setIsMutationRehydrating] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [page, setPage] = useState(1);
  const limit = 20;
  const lastFetchAtRef = useRef<number>(0);
  const hydratedRef = useRef<string | null>(null);
  const mountAtRef = useRef<number>(
    typeof performance !== 'undefined' ? performance.now() : Date.now(),
  );
  const badgeSourceRef = useRef<'cache' | 'network' | 'pending'>('pending');
  const markAllInFlightRef = useRef(false);
  const clearAllInFlightRef = useRef(false);
  const didInitialFetchRef = useRef(false);
  // BUG-NOTIF-HEAD-ABORT FIX (2026-06-23): AbortController dedicado para a HEAD
  // request de unread count. Garante que chamadas concorrentes de fetchNotifications
  // cancelem corretamente a HEAD anterior antes de disparar uma nova.
  const headAbortRef = useRef<AbortController | null>(null);

  // BUG-REALTIME-DEBOUNCE FIX (2026-06-22): coalesce rapid Realtime events into a
  // single fetch. n8n bulk-imports (e.g., 50 notifications in < 1s) fire 50 Realtime
  // callbacks which previously triggered 50 simultaneous HEAD requests visible in
  // the browser console as "Falha ao carregar Buscar: HEAD ..." flood.
  // A 500ms debounce window collapses all events into 1 fetch without perceptible delay.
  const realtimeDebouncerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // BUG-NOTIF-403 FIX: ref para acessar rolesLoaded dentro de fetchNotifications
  // sem adicioná-lo ao useCallback dep array (evita recriar fetchNotifications
  // e re-introduzir BUG-08). O ref é mantido sincronizado via useEffect abaixo.
  const rolesLoadedRef = useRef(rolesLoaded);
  useEffect(() => {
    rolesLoadedRef.current = rolesLoaded;
  }, [rolesLoaded]);

  /**
   * BUG-08 FIX: remover notifications.length das deps de fetchNotifications.
   *
   * PROBLEMA ORIGINAL: fetchNotifications tinha [user, notifications.length] nas
   * dependencias. A cada fetch bem-sucedido, notifications era atualizado ->
   * fetchNotifications recriado -> o useEffect de polling ([user, fetchNotifications])
   * cancelava e recriava o setInterval -> timer de 30s RESETADO A CADA FETCH -> o
   * sino nunca exibia novas notificacoes por polling.
   *
   * SOLUCAO: usar ref (notificationsLengthRef) para ler notifications.length dentro
   * do callback sem precisalo nas deps. O ref e mantido sincronizado via useEffect.
   */
  const notificationsLengthRef = useRef(0);
  useEffect(() => {
    notificationsLengthRef.current = notifications.length;
  }, [notifications]);

  // Hydrate from sessionStorage immediately on user change
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      hydratedRef.current = null;
      badgeSourceRef.current = 'pending';
      return;
    }
    if (hydratedRef.current === user.id) return;
    hydratedRef.current = user.id;
    const cached = readCache(user.id);
    if (cached) {
      setNotifications(cached.notifications);
      setUnreadCount(cached.notifications.filter((n) => !n.is_read).length);
      const elapsedMs =
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) - mountAtRef.current;
      badgeSourceRef.current = 'cache';
      const cacheAgeMs = Date.now() - cached.cachedAt;
      const unread = cached.notifications.filter((n) => !n.is_read).length;
      debugLog('badge-render', {
        source: 'cache',
        elapsedMs: Number(elapsedMs.toFixed(2)),
        target: '<16ms',
        hit: elapsedMs < 16,
        unreadCount: unread,
        cacheAgeMs,
      });
      notificationsMetrics.recordBadgeRender({
        source: 'cache',
        elapsedMs: Number(elapsedMs.toFixed(2)),
        cacheAgeMs,
        networkMs: null,
        unreadCount: unread,
        hit: elapsedMs < 16,
      });
    }
  }, [user]);

  // BUG-08 FIX: deps agora so [user] - sem notifications.length
  // BUG-NOTIF-403: rolesLoadedRef.current guardeia o fetch interno
  const fetchNotifications = useCallback(
    async (
      opts: {
        silent?: boolean;
        source?: FetchSource;
        page?: number;
        search?: string;
        category?: string;
        unreadOnly?: boolean;
        startDate?: string;
        endDate?: string;
      } = {},
    ) => {
      // BUG-NOTIF-403 FIX: usar ref para acessar rolesLoaded sem adicioná-lo
      // ao dep array (preserva fix BUG-08 que removeu notifications.length).
      if (!user || !rolesLoadedRef.current) return;

      const targetPage = opts.page ?? page;
      const targetSearch = opts.search ?? search;
      const targetCategory = opts.category ?? category;
      const targetUnreadOnly = opts.unreadOnly ?? unreadOnly;
      const targetStartDate = opts.startDate ?? dateRange.from?.toISOString();
      const targetEndDate = opts.endDate ?? dateRange.to?.toISOString();
      const offset = (targetPage - 1) * limit;

      const hasData = notificationsLengthRef.current > 0;
      const silent = opts.silent ?? hasData;

      if (silent) setIsRefetching(true);
      else setIsLoading(true);

      notificationsMetrics.recordFetch(opts.source ?? 'initial');
      const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      try {
        let query = untypedFrom('workspace_notifications')
          .select('*', { count: 'exact' })
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (targetCategory && targetCategory !== 'all') {
          query = query.eq('category', targetCategory);
        }

        if (targetUnreadOnly) {
          query = query.eq('is_read', false);
        }

        if (targetStartDate) {
          query = query.gte('created_at', targetStartDate);
        }

        if (targetEndDate) {
          query = query.lte('created_at', targetEndDate);
        }

        if (targetSearch) {
          query = query.ilike('title', `%${targetSearch}%`); // Simplified for frontend ilike search
        }

        const { data, error, count } = await query;

        if (error) throw error;
        const items = (data || []) as WorkspaceNotification[];
        setNotifications(items);
        setTotalCount(count ?? 0);

        // BUG-NOTIF-HEAD-ABORT FIX (2026-06-23): HEAD request para unread count agora usa
        // AbortController dedicado. Cancela HEAD anterior se fetchNotifications for chamada
        // novamente antes da HEAD completar (evita "Falha ao carregar Buscar: HEAD").
        // O AbortController é reiniciado a cada chamada via headAbortRef.
        if (headAbortRef.current) {
          headAbortRef.current.abort();
        }
        headAbortRef.current = new AbortController();
        const headSignal = headAbortRef.current.signal;

        try {
          const { count: unread, error: unreadErr } = await untypedFrom('workspace_notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('is_read', false)
            .abortSignal(headSignal);
          if (!headSignal.aborted) {
            setUnreadCount(unreadErr ? items.filter((n) => !n.is_read).length : (unread ?? 0));
          }
        } catch (headErr) {
          // AbortError = cancelamento intencional por nova chamada concorrente.
          // NetworkError = fallback: derivar contagem dos itens ja carregados.
          const isAbort = headErr instanceof Error && headErr.name === 'AbortError';
          if (!isAbort) {
            setUnreadCount(items.filter((n) => !n.is_read).length);
          }
        } finally {
          // Limpar ref se ainda aponta para este controller (não foi substituído)
          if (headAbortRef.current?.signal === headSignal) {
            headAbortRef.current = null;
          }
        }

        lastFetchAtRef.current = Date.now();
        writeCache(user.id, items);
        if (badgeSourceRef.current !== 'cache') {
          const elapsedMs =
            (typeof performance !== 'undefined' ? performance.now() : Date.now()) -
            mountAtRef.current;
          badgeSourceRef.current = 'network';
          const networkMs = Number(
            ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0).toFixed(2),
          );
          const unreadFiltered = items.filter((n) => !n.is_read).length;
          debugLog('badge-render', {
            source: 'network',
            elapsedMs: Number(elapsedMs.toFixed(2)),
            target: '<16ms',
            hit: elapsedMs < 16,
            unreadCount: unreadFiltered,
            networkMs,
          });
          notificationsMetrics.recordBadgeRender({
            source: 'network',
            elapsedMs: Number(elapsedMs.toFixed(2)),
            cacheAgeMs: null,
            networkMs,
            unreadCount: unreadFiltered,
            hit: elapsedMs < 16,
          });
        } else {
          debugLog('background-refresh', {
            silent,
            networkMs: Number(
              ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0).toFixed(
                2,
              ),
            ),
            unreadCount: items.filter((n) => !n.is_read).length,
          });
        }
      } catch (err) {
        logger.error('Error fetching notifications:', err);
      } finally {
        if (silent) setIsRefetching(false);
        else setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user], // FIX BUG-08: removido notifications.length — usa notificationsLengthRef
            // FIX BUG-NOTIF-403: rolesLoaded acessado via rolesLoadedRef — não nas deps
  );

  // Fetch notifications when filters or page changes
  // BUG-NOTIF-403 FIX: adicionado rolesLoaded ao guard e às deps.
  // Sem rolesLoaded, o effect disparava com JWT inválido antes de
  // onAuthStateChange(INITIAL_SESSION) ser validado por getUser().
  useEffect(() => {
    if (!user || !rolesLoaded) return;

    // Use a small delay for search to avoid too many requests if not handled by caller
    // but the Drawer already has a 400ms debounce.
    const source: FetchSource = didInitialFetchRef.current ? 'filter-change' : 'initial';
    didInitialFetchRef.current = true;
    fetchNotifications({ source });
  }, [user, rolesLoaded, page, search, category, unreadOnly, dateRange.from, dateRange.to, fetchNotifications]);

  // Polling every 60s - estavel: fetchNotifications nao recria com notifications.length.
  // BUG-NOTIF-403 FIX: adicionado rolesLoaded ao guard e às deps.
  // POLL-INTERVAL FIX (2026-06-22): aumentado de 30s → 60s.
  // Justificativa: Realtime subscription já cobre atualizações em tempo real.
  // O polling é fallback apenas para quando o canal Realtime cai (CHANNEL_ERROR /
  // TIMED_OUT). 60s é suficiente para o fallback sem dobrar a carga no DB.
  // Beneício: com 2 instâncias do hook (Header + Drawer), reduz de 4 para 2
  // requisições HEAD por minuto por sessão autenticada.
  useEffect(() => {
    if (!user || !rolesLoaded) return;
    const interval = setInterval(() => {
      fetchNotifications({ silent: true, source: 'polling' });
    }, 60_000);
    return () => clearInterval(interval);
  }, [user, rolesLoaded, fetchNotifications]);

  // Real-time synchronization
  // BUG-NOTIF-403 FIX: adicionado rolesLoaded ao guard e às deps.
  // BUG-REALTIME-DEBOUNCE FIX (2026-06-22): adicionado debounce de 500ms ao callback.
  useEffect(() => {
    if (!user || !rolesLoaded) return;

    const channel = supabase
      // BUG-RT-CHANNEL FIX: topico unico por montagem. O sino monta em TODA pagina (Header)
      // e coexiste com o Drawer de notificacoes -> 2 instancias simultaneas do hook. Com nome
      // estatico, supabase.channel('workspace_notifications_realtime') devolvia o canal JA
      // inscrito e o .on('postgres_changes') caia APOS subscribe() -> "cannot add postgres_changes
      // callbacks ... after subscribe()" (mesmo crash de render do canal de quotes na QuoteViewPage).
      .channel(`workspace_notifications_realtime:${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'workspace_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          debugLog('realtime-event', { event: payload.eventType, payload });

          // BUG-REALTIME-DEBOUNCE FIX: debounce 500ms to coalesce rapid burst events.
          // n8n bulk-imports (e.g., 50 notifications in < 1s) previously triggered 50
          // simultaneous HEAD requests, flooding the console. With debounce, all events
          // within the 500ms window collapse into a single fetch. The 500ms delay is
          // imperceptible to the user but eliminates the request flood completely.
          if (realtimeDebouncerRef.current) {
            clearTimeout(realtimeDebouncerRef.current);
          }
          realtimeDebouncerRef.current = setTimeout(() => {
            fetchNotifications({ silent: true, source: 'mutation' });
            realtimeDebouncerRef.current = null;
          }, 500);
        },
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.warn('[useWorkspaceNotifications] realtime channel error — polling interval maintains freshness', { status, err });
          fetchNotifications({ silent: true, source: 'mutation' });
        }
      });

    return () => {
      // Cancel any pending debounced fetch to avoid state update after unmount
      // (would trigger "Can't perform a React state update on an unmounted component").
      if (realtimeDebouncerRef.current) {
        clearTimeout(realtimeDebouncerRef.current);
        realtimeDebouncerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [user, rolesLoaded, fetchNotifications]);

  // Cleanup on unmount: cancelar HEAD em flight + emitir metricas
  useEffect(() => {
    return () => {
      // BUG-NOTIF-HEAD-ABORT FIX: cancelar HEAD em voo ao desmontar o hook
      if (headAbortRef.current) {
        headAbortRef.current.abort();
        headAbortRef.current = null;
      }
      notificationsMetrics.logBadgeBudgetSummary('hook-unmount');
    };
  }, []);

  const prefetch = useCallback(async () => {
    if (!user) return;
    if (Date.now() - lastFetchAtRef.current < PREFETCH_MIN_INTERVAL_MS) return;
    await fetchNotifications({ silent: true, source: 'prefetch' });
  }, [user, fetchNotifications]);

  const markAsRead = useCallback(
    async (id: string) => {
      if (!user) return;
      const { error } = await supabase
        .from('workspace_notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) return;
      setNotifications((prev) => {
        const next = prev.map((n) => (n.id === id ? { ...n, is_read: true } : n));
        writeCache(user.id, next);
        return next;
      });
      setUnreadCount((prev) => Math.max(0, prev - 1));
    },
    [user],
  );

  const undoMarkAsRead = useCallback(
    async (id: string) => {
      if (!user) return;
      const { error } = await supabase
        .from('workspace_notifications')
        .update({ is_read: false })
        .eq('id', id);

      if (error) return;
      setNotifications((prev) => {
        const next = prev.map((n) => (n.id === id ? { ...n, is_read: false } : n));
        writeCache(user.id, next);
        return next;
      });
      setUnreadCount((prev) => prev + 1);
    },
    [user],
  );

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    if (markAllInFlightRef.current) return;
    markAllInFlightRef.current = true;
    setIsMutationRehydrating(true);
    try {
      const { error } = await supabase
        .from('workspace_notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) return;
      setNotifications((prev) => {
        const next = prev.map((n) => ({ ...n, is_read: true }));
        writeCache(user.id, next);
        return next;
      });
      setUnreadCount(0);
      try {
        sessionStorage.removeItem(CACHE_PREFIX + user.id);
      } catch {
        /* ignore */
      }
      lastFetchAtRef.current = 0;
      await fetchNotifications({ silent: true, source: 'mutation' });
    } finally {
      markAllInFlightRef.current = false;
      setIsMutationRehydrating(false);
    }
  }, [user, fetchNotifications]);

  const clearAll = useCallback(async () => {
    if (!user) return;
    if (clearAllInFlightRef.current) return;
    clearAllInFlightRef.current = true;
    setIsMutationRehydrating(true);
    try {
      const { error } = await supabase
        .from('workspace_notifications')
        .delete()
        .eq('user_id', user.id);

      if (error) return;
      setNotifications([]);
      setUnreadCount(0);
      writeCache(user.id, []);
      try {
        sessionStorage.removeItem(CACHE_PREFIX + user.id);
      } catch {
        /* ignore */
      }
      lastFetchAtRef.current = 0;
      await fetchNotifications({ silent: true, source: 'mutation' });
    } finally {
      clearAllInFlightRef.current = false;
      setIsMutationRehydrating(false);
    }
  }, [user, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    totalCount,
    isLoading,
    isRefetching,
    isMutationRehydrating,
    page,
    search,
    category,
    unreadOnly,
    dateRange,
    setPage,
    setSearch,
    setCategory,
    setUnreadOnly,
    setDateRange,
    markAsRead,
    undoMarkAsRead,
    markAllAsRead,
    clearAll,
    refresh: fetchNotifications,
    prefetch,
  };
}
