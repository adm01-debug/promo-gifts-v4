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
  type: 'info' | 'warning' | 'success' | 'error';
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
  const { user } = useAuth();
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
  const badgeSourceRef = useRef<'pending' | 'cache' | 'network'>('pending');
  const markAllInFlightRef = useRef(false);
  const clearAllInFlightRef = useRef(false);
  const didInitialFetchRef = useRef(false);

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
      if (!user) return;

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
        const items = (data ?? []) as WorkspaceNotification[];
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
          const unread = items.filter((n) => !n.is_read).length;
          debugLog('badge-render', {
            source: 'network',
            elapsedMs: Number(elapsedMs.toFixed(2)),
            target: '<16ms',
            hit: elapsedMs < 16,
            unreadCount: unread,
            networkMs,
          });
          notificationsMetrics.recordBadgeRender({
            source: 'network',
            elapsedMs: Number(elapsedMs.toFixed(2)),
            cacheAgeMs: null,
            networkMs,
            unreadCount: unread,
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
    [user], // FIX: removido notifications.length - agora usa notificationsLengthRef
  );

  // Fetch notifications when filters or page changes
  useEffect(() => {
    if (!user) return;

    // Use a small delay for search to avoid too many requests if not handled by caller
    // but the Drawer already has a 400ms debounce.
    const source: FetchSource = didInitialFetchRef.current ? 'filter-change' : 'initial';
    didInitialFetchRef.current = true;
    fetchNotifications({ source });
  }, [user, page, search, category, unreadOnly, dateRange.from, dateRange.to, fetchNotifications]);

  // Polling every 30s - agora estavel: fetchNotifications nao recria com notifications.length
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      fetchNotifications({ silent: true, source: 'polling' });
    }, 30_000);
    return () => clearInterval(interval);
  }, [user, fetchNotifications]);

  // Real-time synchronization
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('workspace_notifications_realtime')
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchNotifications]);

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
