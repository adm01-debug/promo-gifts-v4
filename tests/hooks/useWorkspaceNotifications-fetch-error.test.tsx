/**
 * useWorkspaceNotifications — initial fetch error path
 *
 * Verifies the badge-render logging contract when the initial Supabase fetch
 * fails AND the sessionStorage cache is empty:
 *
 *   - NO `source: "cache"`   badge-render log is emitted (cache was empty).
 *   - NO `source: "network"` badge-render log is emitted either, because the
 *     hook only records a network badge-render on the SUCCESS branch (after
 *     items land in state). On `throw`, the catch swallows the error and only
 *     `console.error` fires.
 *   - `recordFetch("initial")` STILL ran (the trigger/fetch ratio counts the
 *     attempt, not the outcome) — this is the "error-specific token" surface
 *     the system exposes today: an attempted fetch with no badge-render.
 *   - `lastBadgeRender` on the metrics snapshot stays `null`.
 *
 * Two failure modes are covered: (1) Supabase resolves with `{ data: null,
 * error }` (the documented PostgrestError shape) and (2) the underlying
 * `.limit()` promise rejects outright.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const limitMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => {
  let lastData = [];
  const buildSelectChain = () => {
    let headCount = false;
    const chain = {};
    for (const m of ["select", "eq", "order", "range", "gte", "limit"]) {
      chain[m] = (...args) => {
        if (m === "select" && args[1] && args[1].head) headCount = true;
        if (m === "limit") return limitMock(...args);
        return chain;
      };
    }
    chain.then = async (resolve, reject) => {
      try {
        if (headCount) { resolve({ count: lastData.filter((n) => !n.is_read).length, error: null }); return; }
        const base = await limitMock();
        lastData = (base && base.data) || [];
        resolve({ ...base, count: lastData.length });
      } catch (e) { reject(e); }
    };
    return chain;
  };
  return {
    supabase: {
      from: vi.fn(() => buildSelectChain()),
      channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
      removeChannel: vi.fn(),
    },
  };
});

const STABLE_USER = { id: "user-fetch-error-1" };
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: STABLE_USER, rolesLoaded: true }),
}));

const CACHE_KEY = `workspace_notifications_cache:${STABLE_USER.id}`;

let consoleLogSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  sessionStorage.clear();
  localStorage.setItem("debug:notifications", "1");
  limitMock.mockReset();
  consoleLogSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  sessionStorage.clear();
  localStorage.removeItem("debug:notifications");
  consoleLogSpy.mockRestore();
  consoleErrorSpy.mockRestore();
  vi.restoreAllMocks();
});

function findBadgeRenderLogs() {
  return consoleLogSpy.mock.calls
    .filter((args) => typeof args[0] === "string" && (args[0] as string).includes("notifications.badge-render"))
    .map((args) => args[1] as Record<string, unknown>);
}

function findErrorLogs() {
  return consoleErrorSpy.mock.calls.filter(
    (args) => typeof args[0] === "string" && args[0].includes("Error fetching notifications")
  );
}

async function loadHookAndMetrics() {
  vi.resetModules();
  const hookMod = await import("@/hooks/ui/useWorkspaceNotifications");
  const metricsMod = await import("@/lib/notifications-metrics");
  metricsMod.notificationsMetrics.reset();
  return {
    useWorkspaceNotifications: hookMod.useWorkspaceNotifications,
    metrics: metricsMod.notificationsMetrics,
  };
}

describe("useWorkspaceNotifications — initial fetch error path", () => {
  it('emits NO badge-render logs (no "cache", no "network") when initial fetch returns { data: null, error }', async () => {
    expect(sessionStorage.getItem(CACHE_KEY)).toBeNull();
    limitMock.mockResolvedValue({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });

    const { useWorkspaceNotifications, metrics } = await loadHookAndMetrics();
    const { result } = renderHook(() => useWorkspaceNotifications());

    // Wait for the initial fetch to settle (limit() invoked + caught).
    await waitFor(() => {
      expect(limitMock).toHaveBeenCalled();
    });
    // Give the catch block a tick to run console.error.
    await waitFor(() => {
      expect(findErrorLogs().length).toBeGreaterThanOrEqual(1);
    });

    // Hook stayed empty — no items committed to state.
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);

    // Crucial assertions: NEITHER source was logged.
    const cacheLogs = findBadgeRenderLogs().filter((p) => p?.source === "cache");
    const networkLogs = findBadgeRenderLogs().filter((p) => p?.source === "network");
    expect(cacheLogs.length).toBe(0);
    expect(networkLogs.length).toBe(0);

    // Programmatic surface: lastBadgeRender stays null.
    const snap = metrics.snapshot();
    expect(snap.lastBadgeRender).toBeNull();
    expect(snap.badgeRenders).toEqual([]);
    expect(snap.badgeBudget.total).toBe(0);

    // The fetch attempt itself WAS counted (ratio surface, not badge surface).
    expect(snap.fetches).toBeGreaterThanOrEqual(1);
    expect(snap.byFetch.initial).toBeGreaterThanOrEqual(1);

    // Cache must NOT be written on failure (writeCache only runs on success).
    expect(sessionStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it('emits NO badge-render logs when the initial fetch promise REJECTS', async () => {
    expect(sessionStorage.getItem(CACHE_KEY)).toBeNull();
    limitMock.mockRejectedValue(new Error("network down"));

    const { useWorkspaceNotifications, metrics } = await loadHookAndMetrics();
    const { result } = renderHook(() => useWorkspaceNotifications());

    await waitFor(() => {
      expect(limitMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(findErrorLogs().length).toBeGreaterThanOrEqual(1);
    });

    expect(result.current.notifications).toEqual([]);

    const cacheLogs = findBadgeRenderLogs().filter((p) => p?.source === "cache");
    const networkLogs = findBadgeRenderLogs().filter((p) => p?.source === "network");
    expect(cacheLogs.length).toBe(0);
    expect(networkLogs.length).toBe(0);

    const snap = metrics.snapshot();
    expect(snap.lastBadgeRender).toBeNull();
    expect(snap.fetches).toBeGreaterThanOrEqual(1);
    expect(snap.byFetch.initial).toBeGreaterThanOrEqual(1);
    expect(sessionStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it('still logs source: "cache" (and only "cache") when cache is fresh AND the network fetch fails', async () => {
    // Pre-seed a fresh cache entry (10s old).
    const SEED = [
      {
        id: "n1",
        user_id: STABLE_USER.id,
        title: "t",
        message: "m",
        type: "info",
        category: "general",
        is_read: false,
        action_url: null,
        metadata: {},
        created_at: "2024-01-01T00:00:00Z",
      },
    ];
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ cachedAt: Date.now() - 10_000, notifications: SEED })
    );
    // Background fetch fails.
    limitMock.mockResolvedValue({
      data: null,
      error: { message: "boom", code: "500" },
    });

    const { useWorkspaceNotifications, metrics } = await loadHookAndMetrics();
    const { result } = renderHook(() => useWorkspaceNotifications());

    await waitFor(() => {
      expect(result.current.notifications.length).toBe(SEED.length);
    });
    await waitFor(() => {
      expect(findErrorLogs().length).toBeGreaterThanOrEqual(1);
    });

    const cacheLogs = findBadgeRenderLogs().filter((p) => p?.source === "cache");
    const networkLogs = findBadgeRenderLogs().filter((p) => p?.source === "network");
    expect(cacheLogs.length).toBeGreaterThanOrEqual(1);
    expect(networkLogs.length).toBe(0);

    expect(metrics.snapshot().lastBadgeRender?.source).toBe("cache");
  });
});
