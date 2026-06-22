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

        // Also fetch unread count separately to keep badge sync
        const { count: unread } = await untypedFrom('workspace_notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false);

        setUnreadCount(unread ?? 0);
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

  // Polling every 30s - agora estavel: fetchNotifications nao recria com notifications.length
  // BUG-NOTIF-403 FIX: adicionado rolesLoaded ao guard e às deps.
  useEffect(() => {
    if (!user || !rolesLoaded) return;
    const interval = setInterval(() => {
      fetchNotifications({ silent: true, source: 'polling' });
    }, 30_000);
    return () => clearInterval(interval);
  }, [user, rolesLoaded, fetchNotifications]);

  // Real-time synchronization
  // BUG-NOTIF-403 FIX: adicionado rolesLoaded ao guard e às deps.
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

          // Re-fetch everything to ensure consistent state (including badge)
          // Use silent fetch to avoid UI flicker
          fetchNotifications({ silent: true, source: 'mutation' });
        },
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.warn('[useWorkspaceNotifications] realtime channel error — polling interval maintains freshness', { status, err });
          fetchNotifications({ silent: true, source: 'mutation' });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, rolesLoaded, fetchNotifications]);

  // Final summary on unmount
  useEffect(() => {
    return () => {
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
