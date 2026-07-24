/**
 * useWorkspaceNotifications — cross-mount cache persistence (deterministic).
 *
 * Same contract as the original cache-persistence test, but Date.now,
 * performance.now, and timers are all mocked via `installDeterministicClock`
 * so cacheAgeMs / elapsedMs / networkMs are reproducible to the millisecond
 * and the suite cannot flake on slow CI.
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

const STABLE_USER = { id: "user-cache-persistence-1" };
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: STABLE_USER, rolesLoaded: true }),
}));

const CACHE_KEY = `workspace_notifications_cache:${STABLE_USER.id}`;
const CACHE_TTL_MS = 60_000;
/** Absolute epoch start the clock will be pinned to in every test. */
const EPOCH = 1_700_000_000_000;

const SEED = [
  {
    id: "n1", user_id: STABLE_USER.id, title: "First", message: "Hello",
    type: "info", category: "general", is_read: false, action_url: null,
    metadata: { foo: "bar" }, created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "n2", user_id: STABLE_USER.id, title: "Second", message: "World",
    type: "warning", category: "system", is_read: true, action_url: "/somewhere",
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

describe("useWorkspaceNotifications — deterministic cross-mount persistence", () => {
  it("Mount #1 writes cachedAt=Date.now(); Mount #2 hydrates with exact cacheAgeMs", async () => {
    expect(sessionStorage.getItem(CACHE_KEY)).toBeNull();
    limitMock.mockResolvedValue({ data: SEED, error: null });

    const { useWorkspaceNotifications, metrics } = await loadHookAndMetrics();

    // ── Mount #1 (cold cache) ───────────────────────────────────────────────
    const t0 = clock.now();
    const first = renderHook(() => useWorkspaceNotifications());
    // Let the initial fetch resolve (microtasks only — no real wall time).
    await waitFor(() => {
      expect(first.result.current.notifications.length).toBe(SEED.length);
    });

    // Cache must be persisted with cachedAt EXACTLY equal to the mocked clock.
    const persistedRaw = sessionStorage.getItem(CACHE_KEY);
    expect(persistedRaw).not.toBeNull();
    const persisted = JSON.parse(persistedRaw as string) as {
      cachedAt: number;
      notifications: typeof SEED;
    };
    expect(persisted.cachedAt).toBe(t0);
    expect(persisted.notifications).toHaveLength(SEED.length);

    expect(metrics.snapshot().lastBadgeRender?.source).toBe("network");

    first.unmount();
    metrics.reset();
    consoleSpy.mockClear();

    // Advance the deterministic clock by exactly 25ms — no real setTimeout.
    clock.advance(25);

    // ── Mount #2 (warm cache, exactly 25ms later) ──────────────────────────
    const second = renderHook(() => useWorkspaceNotifications());
    await waitFor(() => {
      expect(second.result.current.notifications.length).toBe(SEED.length);
    });

    const cacheLogs = findBadgeRenderLogs().filter((p) => p?.source === "cache");
    expect(cacheLogs.length).toBeGreaterThanOrEqual(1);

    // cacheAgeMs is now PROVABLY 25 (no jitter possible).
    expect(cacheLogs[0].cacheAgeMs).toBe(25);
    expect(cacheLogs[0].unreadCount).toBe(1);

    const snap = metrics.snapshot();
    expect(snap.lastBadgeRender?.source).toBe("cache");
    expect(snap.lastBadgeRender?.cacheAgeMs).toBe(25);
    expect(snap.lastBadgeRender?.networkMs).toBeNull();

    second.unmount();
  });

  it("Mount at EXACTLY CACHE_TTL_MS+1 falls back to network (boundary is deterministic)", async () => {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        cachedAt: clock.now() - (CACHE_TTL_MS + 1),
        notifications: SEED,
      })
    );
    limitMock.mockResolvedValue({ data: SEED, error: null });

    const { useWorkspaceNotifications, metrics } = await loadHookAndMetrics();
    const { result } = renderHook(() => useWorkspaceNotifications());

    await waitFor(() => {
      expect(result.current.notifications.length).toBe(SEED.length);
    });

    const cacheLogs = findBadgeRenderLogs().filter((p) => p?.source === "cache");
    const networkLogs = findBadgeRenderLogs().filter((p) => p?.source === "network");
    expect(cacheLogs.length).toBe(0);
    expect(networkLogs.length).toBeGreaterThanOrEqual(1);

    // The fresh write-back must use the EXACT mocked Date.now().
    const refreshed = JSON.parse(
      sessionStorage.getItem(CACHE_KEY) as string
    ) as { cachedAt: number };
    expect(refreshed.cachedAt).toBe(clock.now());

    expect(metrics.snapshot().lastBadgeRender?.source).toBe("network");
  });
});
