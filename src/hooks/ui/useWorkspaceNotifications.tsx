import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { notificationsMetrics, type FetchSource } from "@/lib/notifications-metrics";

export interface WorkspaceNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "error";
  category: string;
  is_read: boolean;
  action_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

const CACHE_PREFIX = "workspace_notifications_cache:";
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
    if (typeof window === "undefined") return false;
    if (window.localStorage?.getItem("debug:notifications") === "1") return true;
    return Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);
  } catch {
    return false;
  }
}

function debugLog(event: string, payload: Record<string, unknown>) {
  if (!isDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.log(
    `%c[notifications:${event}]`,
    "color:#7c3aed;font-weight:600",
    payload
  );
}

export function useWorkspaceNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<WorkspaceNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  // True only while a markAllAsRead/clearAll mutation + its silent re-hydration are in flight.
  // Distinct from isRefetching, which also turns true for polling and prefetch.
  const [isMutationRehydrating, setIsMutationRehydrating] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastFetchAtRef = useRef<number>(0);
  const hydratedRef = useRef<string | null>(null);
  const mountAtRef = useRef<number>(typeof performance !== "undefined" ? performance.now() : Date.now());
  const badgeSourceRef = useRef<"pending" | "cache" | "network">("pending");
  // In-flight guards: prevent duplicate fetchNotifications when the user
  // double-clicks markAllAsRead/clearAll before the first call resolves.
  const markAllInFlightRef = useRef(false);
  const clearAllInFlightRef = useRef(false);

  // Hydrate from sessionStorage immediately on user change
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      hydratedRef.current = null;
      badgeSourceRef.current = "pending";
      return;
    }
    if (hydratedRef.current === user.id) return;
    hydratedRef.current = user.id;
    const cached = readCache(user.id);
    if (cached) {
      setNotifications(cached.notifications);
      setUnreadCount(cached.notifications.filter((n) => !n.is_read).length);
      const elapsedMs =
        (typeof performance !== "undefined" ? performance.now() : Date.now()) -
        mountAtRef.current;
      badgeSourceRef.current = "cache";
      const cacheAgeMs = Date.now() - cached.cachedAt;
      const unread = cached.notifications.filter((n) => !n.is_read).length;
      debugLog("badge-render", {
        source: "cache",
        elapsedMs: Number(elapsedMs.toFixed(2)),
        target: "<16ms",
        hit: elapsedMs < 16,
        unreadCount: unread,
        cacheAgeMs,
      });
      notificationsMetrics.recordBadgeRender({
        source: "cache",
        elapsedMs: Number(elapsedMs.toFixed(2)),
        cacheAgeMs,
        networkMs: null,
        unreadCount: unread,
        hit: elapsedMs < 16,
      });
    }
  }, [user]);

  const fetchNotifications = useCallback(
    async (opts: { silent?: boolean; source?: FetchSource } = {}) => {
      if (!user) return;
      const hasData = notifications.length > 0;
      const silent = opts.silent ?? hasData;

      if (silent) setIsRefetching(true);
      else setIsLoading(true);

      notificationsMetrics.recordFetch(opts.source ?? "initial");
      const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
      try {
        const { data, error } = await supabase
          .from("workspace_notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;
        const items = (data || []) as WorkspaceNotification[];
        setNotifications(items);
        setUnreadCount(items.filter((n) => !n.is_read).length);
        lastFetchAtRef.current = Date.now();
        writeCache(user.id, items);
        if (badgeSourceRef.current !== "cache") {
          const elapsedMs =
            (typeof performance !== "undefined" ? performance.now() : Date.now()) -
            mountAtRef.current;
          badgeSourceRef.current = "network";
          const networkMs = Number(
            ((typeof performance !== "undefined" ? performance.now() : Date.now()) - t0).toFixed(2)
          );
          const unread = items.filter((n) => !n.is_read).length;
          debugLog("badge-render", {
            source: "network",
            elapsedMs: Number(elapsedMs.toFixed(2)),
            target: "<16ms",
            hit: elapsedMs < 16,
            unreadCount: unread,
            networkMs,
          });
          notificationsMetrics.recordBadgeRender({
            source: "network",
            elapsedMs: Number(elapsedMs.toFixed(2)),
            cacheAgeMs: null,
            networkMs,
            unreadCount: unread,
            hit: elapsedMs < 16,
          });
        } else {
          debugLog("background-refresh", {
            silent,
            networkMs: Number(
              ((typeof performance !== "undefined" ? performance.now() : Date.now()) - t0).toFixed(2)
            ),
            unreadCount: items.filter((n) => !n.is_read).length,
          });
        }
      } catch (err) {
        console.error("Error fetching notifications:", err);
      } finally {
        if (silent) setIsRefetching(false);
        else setIsLoading(false);
      }
    },
    [user, notifications.length]
  );

  // Initial fetch (always, but in background if cache hydrated)
  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  // Polling every 30s (silent)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      fetchNotifications({ silent: true, source: "polling" });
    }, 30_000);
    return () => clearInterval(interval);
  }, [user, fetchNotifications]);

  // Final summary on unmount: emits ONE consolidated `[notifications-metrics:badge-budget-summary]`
  // line with hits/misses/hitRate so QA can eyeball the bell's <16ms budget without
  // scrolling through every individual badge-render log. No-op if debug is OFF.
  useEffect(() => {
    return () => {
      notificationsMetrics.logBadgeBudgetSummary("hook-unmount");
    };
  }, []);

  // Idempotent prefetch: only re-fetches if last fetch >5s ago
  const prefetch = useCallback(async () => {
    if (!user) return;
    if (Date.now() - lastFetchAtRef.current < PREFETCH_MIN_INTERVAL_MS) return;
    await fetchNotifications({ silent: true, source: "prefetch" });
  }, [user, fetchNotifications]);

  const markAsRead = useCallback(
    async (id: string) => {
      if (!user) return;
      const { error } = await supabase
        .from("workspace_notifications")
        .update({ is_read: true })
        .eq("id", id);

      if (error) return;
      setNotifications((prev) => {
        const next = prev.map((n) => (n.id === id ? { ...n, is_read: true } : n));
        writeCache(user.id, next);
        return next;
      });
      setUnreadCount((prev) => Math.max(0, prev - 1));
    },
    [user]
  );

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    if (markAllInFlightRef.current) return; // dedupe rapid double-clicks
    markAllInFlightRef.current = true;
    setIsMutationRehydrating(true);
    try {
      const { error } = await supabase
        .from("workspace_notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) return;
      // Optimistic local update
      setNotifications((prev) => {
        const next = prev.map((n) => ({ ...n, is_read: true }));
        writeCache(user.id, next);
        return next;
      });
      setUnreadCount(0);
      try {
        sessionStorage.removeItem(CACHE_PREFIX + user.id);
      } catch {
        // ignore
      }
      lastFetchAtRef.current = 0;
      await fetchNotifications({ silent: true, source: "mutation" });
    } finally {
      markAllInFlightRef.current = false;
      setIsMutationRehydrating(false);
    }
  }, [user, fetchNotifications]);

  const clearAll = useCallback(async () => {
    if (!user) return;
    if (clearAllInFlightRef.current) return; // dedupe rapid double-clicks
    clearAllInFlightRef.current = true;
    setIsMutationRehydrating(true);
    try {
      const { error } = await supabase
        .from("workspace_notifications")
        .delete()
        .eq("user_id", user.id);

      if (error) return;
      setNotifications([]);
      setUnreadCount(0);
      writeCache(user.id, []);
      try {
        sessionStorage.removeItem(CACHE_PREFIX + user.id);
      } catch {
        // ignore
      }
      lastFetchAtRef.current = 0;
      await fetchNotifications({ silent: true, source: "mutation" });
    } finally {
      clearAllInFlightRef.current = false;
      setIsMutationRehydrating(false);
    }
  }, [user, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    isRefetching,
    isMutationRehydrating,
    markAsRead,
    markAllAsRead,
    clearAll,
    refresh: fetchNotifications,
    prefetch,
  };
}
