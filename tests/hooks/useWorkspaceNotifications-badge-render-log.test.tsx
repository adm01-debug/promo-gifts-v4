import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

/**
 * Verifies that `useWorkspaceNotifications` emits the `badge-render` debug log
 * with the correct `source` token:
 *
 *   - `source: "cache"` on the FIRST render when sessionStorage already holds
 *     a fresh entry for the current user (hydration path).
 *   - `source: "network"` on the FIRST render when there is no cache, after
 *     the initial Supabase fetch resolves.
 *
 * We assert on two surfaces simultaneously to stay resilient to log format
 * tweaks:
 *   1. `console.log` calls (the `debugLog` helper output).
 *   2. `notificationsMetrics.recordBadgeRender` invocations (programmatic).
 */

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

const STABLE_USER = { id: "user-badge-render-1" };
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: STABLE_USER, rolesLoaded: true }),
}));

const CACHE_KEY = `workspace_notifications_cache:${STABLE_USER.id}`;

const SEED = [
  {
    id: "n1",
    user_id: STABLE_USER.id,
    title: "t1",
    message: "m1",
    type: "info",
    category: "general",
    is_read: false,
    action_url: null,
    metadata: {},
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "n2",
    user_id: STABLE_USER.id,
    title: "t2",
    message: "m2",
    type: "info",
    category: "general",
    is_read: true,
    action_url: null,
    metadata: {},
    created_at: "2024-01-02T00:00:00Z",
  },
];

let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  sessionStorage.clear();
  localStorage.setItem("debug:notifications", "1"); // force `debugLog` ON
  limitMock.mockReset();
  consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  sessionStorage.clear();
  localStorage.removeItem("debug:notifications");
  consoleSpy.mockRestore();
  vi.restoreAllMocks();
});

/** Find every `[notifications:badge-render]` log entry and return its payload. */
function findBadgeRenderLogs() {
  return consoleSpy.mock.calls
    .filter((args) => typeof args[0] === "string" && (args[0] as string).includes("notifications.badge-render"))
    .map((args) => args[1] as Record<string, unknown>);
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

describe("useWorkspaceNotifications — badge-render logging", () => {
  it('logs source: "cache" when sessionStorage already has a fresh entry', async () => {
    // Seed the cache BEFORE mounting so the hydration path runs first.
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ cachedAt: Date.now(), notifications: SEED })
    );
    // Background fetch should still happen, but it must NOT overwrite the
    // first badge source which was already set to "cache".
    limitMock.mockResolvedValue({ data: SEED, error: null });

    const { useWorkspaceNotifications, metrics } = await loadHookAndMetrics();
    const { result } = renderHook(() => useWorkspaceNotifications());

    // Cache hydration is synchronous (runs in the first effect tick).
    await waitFor(() => {
      expect(result.current.notifications.length).toBe(SEED.length);
    });

    const cacheLogs = findBadgeRenderLogs().filter((p) => p.source === "cache");
    expect(cacheLogs.length).toBeGreaterThanOrEqual(1);

    const cachePayload = cacheLogs[0];
    expect(cachePayload.source).toBe("cache");
    expect(typeof cachePayload.elapsedMs).toBe("number");
    expect(typeof cachePayload.cacheAgeMs).toBe("number");
    expect(cachePayload.unreadCount).toBe(1); // SEED has 1 unread
    expect("networkMs" in cachePayload).toBe(false);

    // Programmatic surface mirrors the log.
    const snap = metrics.snapshot();
    expect(snap.lastBadgeRender).not.toBeNull();
    expect(snap.lastBadgeRender?.source).toBe("cache");
    expect(snap.lastBadgeRender?.cacheAgeMs).not.toBeNull();
    expect(snap.lastBadgeRender?.networkMs).toBeNull();

    // No "network" badge-render should be emitted because the source ref was
    // already pinned to "cache" by the hydration path.
    await waitFor(() => {
      expect(limitMock).toHaveBeenCalled();
    });
    const networkLogs = findBadgeRenderLogs().filter((p) => p.source === "network");
    expect(networkLogs.length).toBe(0);
  });

  it('logs source: "network" after the initial fetch when sessionStorage is empty', async () => {
    expect(sessionStorage.getItem(CACHE_KEY)).toBeNull();
    limitMock.mockResolvedValue({ data: SEED, error: null });

    const { useWorkspaceNotifications, metrics } = await loadHookAndMetrics();
    const { result } = renderHook(() => useWorkspaceNotifications());

    await waitFor(() => {
      expect(result.current.notifications.length).toBe(SEED.length);
    });

    const networkLogs = findBadgeRenderLogs().filter((p) => p.source === "network");
    expect(networkLogs.length).toBeGreaterThanOrEqual(1);

    const networkPayload = networkLogs[0];
    expect(networkPayload.source).toBe("network");
    expect(typeof networkPayload.elapsedMs).toBe("number");
    expect(typeof networkPayload.networkMs).toBe("number");
    expect(networkPayload.unreadCount).toBe(1);
    expect("cacheAgeMs" in networkPayload).toBe(false);

    // Programmatic surface mirrors the log.
    const snap = metrics.snapshot();
    expect(snap.lastBadgeRender?.source).toBe("network");
    expect(snap.lastBadgeRender?.networkMs).not.toBeNull();
    expect(snap.lastBadgeRender?.cacheAgeMs).toBeNull();
    expect(snap.lastBadgeRender?.unreadCount).toBe(1);

    // Cache should now be populated for the next mount.
    expect(sessionStorage.getItem(CACHE_KEY)).not.toBeNull();
  });
});
