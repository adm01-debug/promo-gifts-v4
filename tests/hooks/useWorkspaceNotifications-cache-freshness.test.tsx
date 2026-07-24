/**
 * useWorkspaceNotifications — cache freshness window (deterministic).
 *
 * Same contract as the original cache-freshness test, but Date.now,
 * performance.now and timers are mocked via `installDeterministicClock`
 * so cacheAgeMs / TTL boundary checks are reproducible to the millisecond.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { installDeterministicClock, type DeterministicClock } from "../utils/deterministicTime";

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

const STABLE_USER = { id: "user-cache-freshness-1" };
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: STABLE_USER, rolesLoaded: true }),
}));

const CACHE_KEY = `workspace_notifications_cache:${STABLE_USER.id}`;
const CACHE_TTL_MS = 60_000;
const EPOCH = 1_700_000_000_000;

const SEED = [
  {
    id: "n1", user_id: STABLE_USER.id, title: "t1", message: "m1",
    type: "info", category: "general", is_read: false, action_url: null,
    metadata: {}, created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "n2", user_id: STABLE_USER.id, title: "t2", message: "m2",
    type: "info", category: "general", is_read: true, action_url: null,
    metadata: {}, created_at: "2024-01-02T00:00:00Z",
  },
];

let consoleSpy: ReturnType<typeof vi.spyOn>;
let clock: DeterministicClock;

beforeEach(() => {
  sessionStorage.clear();
  localStorage.setItem("debug:notifications", "1");
  limitMock.mockReset();
  consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  clock = installDeterministicClock(EPOCH);
});

afterEach(() => {
  clock.uninstall();
  sessionStorage.clear();
  localStorage.removeItem("debug:notifications");
  consoleSpy.mockRestore();
  vi.restoreAllMocks();
});

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

describe("useWorkspaceNotifications — deterministic cache freshness", () => {
  it("logs source: cache with cacheAgeMs EXACTLY equal to seeded age (10s)", async () => {
    const FRESH_AGE_MS = 10_000;
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ cachedAt: clock.now() - FRESH_AGE_MS, notifications: SEED })
    );
    limitMock.mockResolvedValue({ data: SEED, error: null });

    const { useWorkspaceNotifications, metrics } = await loadHookAndMetrics();
    const { result } = renderHook(() => useWorkspaceNotifications());

    await waitFor(() => {
      expect(result.current.notifications.length).toBe(SEED.length);
    });

    const cacheLogs = findBadgeRenderLogs().filter((p) => p?.source === "cache");
    expect(cacheLogs.length).toBeGreaterThanOrEqual(1);

    // EXACT equality is now possible because Date.now() is frozen.
    expect(cacheLogs[0].cacheAgeMs).toBe(FRESH_AGE_MS);
    expect(cacheLogs[0].unreadCount).toBe(1);

    await waitFor(() => {
      expect(limitMock).toHaveBeenCalled();
    });
    const networkLogs = findBadgeRenderLogs().filter((p) => p?.source === "network");
    expect(networkLogs.length).toBe(0);

    expect(metrics.snapshot().lastBadgeRender?.cacheAgeMs).toBe(FRESH_AGE_MS);
  });

  it("falls back to source: network when cache age = TTL+5000 (deterministic)", async () => {
    const STALE_AGE_MS = CACHE_TTL_MS + 5_000;
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ cachedAt: clock.now() - STALE_AGE_MS, notifications: SEED })
    );
    limitMock.mockResolvedValue({ data: SEED, error: null });

    const { useWorkspaceNotifications, metrics } = await loadHookAndMetrics();
    const { result } = renderHook(() => useWorkspaceNotifications());

    await waitFor(() => {
      expect(result.current.notifications.length).toBe(SEED.length);
    });

    const networkLogs = findBadgeRenderLogs().filter((p) => p?.source === "network");
    const cacheLogs = findBadgeRenderLogs().filter((p) => p?.source === "cache");
    expect(networkLogs.length).toBeGreaterThanOrEqual(1);
    expect(cacheLogs.length).toBe(0);

    expect("cacheAgeMs" in networkLogs[0]).toBe(false);
    expect(networkLogs[0].unreadCount).toBe(1);

    const snap = metrics.snapshot();
    expect(snap.lastBadgeRender?.source).toBe("network");
    expect(snap.lastBadgeRender?.cacheAgeMs).toBeNull();

    // Refreshed entry uses EXACTLY the mocked Date.now().
    const refreshed = JSON.parse(
      sessionStorage.getItem(CACHE_KEY) as string
    ) as { cachedAt: number };
    expect(refreshed.cachedAt).toBe(clock.now());
  });

  it("treats cache age = TTL+1 as stale (boundary is exact, no flake possible)", async () => {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ cachedAt: clock.now() - (CACHE_TTL_MS + 1), notifications: SEED })
    );
    limitMock.mockResolvedValue({ data: SEED, error: null });

    const { useWorkspaceNotifications } = await loadHookAndMetrics();
    const { result } = renderHook(() => useWorkspaceNotifications());

    await waitFor(() => {
      expect(result.current.notifications.length).toBe(SEED.length);
    });

    expect(findBadgeRenderLogs().filter((p) => p?.source === "cache").length).toBe(0);
    expect(findBadgeRenderLogs().filter((p) => p?.source === "network").length).toBeGreaterThanOrEqual(1);
  });
});
