/**
 * useWorkspaceNotifications — unreadCount fidelity in badge-render logs
 *
 * Verifies that the `unreadCount` field in the `[notifications:badge-render]`
 * log payload (and the mirrored `notificationsMetrics.lastBadgeRender.unreadCount`)
 * always equals `seed.filter(n => !n.is_read).length`, across both source paths:
 *
 *   - source: "cache"   → seeded directly into sessionStorage
 *   - source: "network" → seeded as the Supabase fetch response
 *
 * Cases exercised: 0 unread (all read), all unread, mixed (3/5), single-item
 * lists, and the empty list. Both surfaces (console log payload + metrics
 * snapshot) must agree.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const limitMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => {
  // Chain thenable: select/eq/order/range/gte/limit encadeáveis em qualquer ordem;
  // `await chain` resolve via limitMock (mecanismo de injeção dos testes).
  let lastData = [];
  const buildSelectChain = () => {
    let headCount = false;
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order", "range", "gte", "limit"]) {
      chain[m] = (...args: unknown[]) => {
        // O hook usa .select('id', { count:'exact', head:true }) só na query
        // de contagem de não-lidos. Detectamos isso p/ resolver com `count`.
        if (m === "select" && args[1] && (args[1] as { head?: boolean }).head) headCount = true;
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

const STABLE_USER = { id: "user-unread-count-1" };
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: STABLE_USER, rolesLoaded: true }),
}));

const CACHE_KEY = `workspace_notifications_cache:${STABLE_USER.id}`;

interface SeedRow {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  category: string;
  is_read: boolean;
  action_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

function makeSeed(readFlags: boolean[]): SeedRow[] {
  return readFlags.map((isRead, i) => ({
    id: `n${i + 1}`,
    user_id: STABLE_USER.id,
    title: `Title ${i + 1}`,
    message: `Body ${i + 1}`,
    type: "info",
    category: "general",
    is_read: isRead,
    action_url: null,
    metadata: {},
    created_at: new Date(Date.UTC(2024, 0, i + 1)).toISOString(),
  }));
}

function expectedUnread(seed: SeedRow[]): number {
  return seed.filter((n) => !n.is_read).length;
}

let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  sessionStorage.clear();
  localStorage.setItem("debug:notifications", "1");
  limitMock.mockReset();
  consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
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

// ─── Cache-path scenarios ────────────────────────────────────────────────────
const cacheScenarios: Array<{ name: string; flags: boolean[]; expected: number }> = [
  { name: "0 unread (all read)", flags: [true, true, true], expected: 0 },
  { name: "all unread", flags: [false, false, false, false], expected: 4 },
  { name: "mixed 3/5 unread", flags: [false, true, false, true, false], expected: 3 },
  { name: "single unread item", flags: [false], expected: 1 },
  { name: "empty list", flags: [], expected: 0 },
];

describe("useWorkspaceNotifications — unreadCount in cache-source badge-render logs", () => {
  for (const sc of cacheScenarios) {
    it(`logs unreadCount=${sc.expected} when sessionStorage contains ${sc.name}`, async () => {
      const seed = makeSeed(sc.flags);
      sessionStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ cachedAt: Date.now() - 5_000, notifications: seed })
      );
      // Background fetch must NOT change the unreadCount under test —
      // serve the same payload so the numbers stay stable.
      limitMock.mockResolvedValue({ data: seed, error: null });

      const { useWorkspaceNotifications, metrics } = await loadHookAndMetrics();
      const { result } = renderHook(() => useWorkspaceNotifications());

      // For empty seeds, notifications.length stays 0 — wait for the
      // hydration effect to flush instead of for a length change.
      await waitFor(() => {
        expect(metrics.snapshot().lastBadgeRender).not.toBeNull();
      });

      // Hook state mirrors the seed.
      expect(result.current.notifications.length).toBe(seed.length);
      expect(result.current.unreadCount).toBe(sc.expected);

      const cacheLogs = findBadgeRenderLogs().filter((p) => p?.source === "cache");
      expect(cacheLogs.length).toBeGreaterThanOrEqual(1);

      // Both surfaces (log + metrics) must report the SAME unreadCount.
      expect(cacheLogs[0].unreadCount).toBe(sc.expected);
      expect(cacheLogs[0].unreadCount).toBe(expectedUnread(seed));

      const snap = metrics.snapshot();
      expect(snap.lastBadgeRender?.source).toBe("cache");
      expect(snap.lastBadgeRender?.unreadCount).toBe(sc.expected);
    });
  }
});

// ─── Network-path scenarios ──────────────────────────────────────────────────
const networkScenarios: Array<{ name: string; flags: boolean[]; expected: number }> = [
  { name: "0 unread (all read)", flags: [true, true], expected: 0 },
  { name: "all unread", flags: [false, false, false], expected: 3 },
  { name: "mixed 2/4 unread", flags: [true, false, false, true], expected: 2 },
  { name: "single unread item", flags: [false], expected: 1 },
  { name: "empty list", flags: [], expected: 0 },
];

describe("useWorkspaceNotifications — unreadCount in network-source badge-render logs", () => {
  for (const sc of networkScenarios) {
    it(`logs unreadCount=${sc.expected} when the initial fetch returns ${sc.name}`, async () => {
      const seed = makeSeed(sc.flags);
      // No sessionStorage → forces the network branch.
      expect(sessionStorage.getItem(CACHE_KEY)).toBeNull();
      limitMock.mockResolvedValue({ data: seed, error: null });

      const { useWorkspaceNotifications, metrics } = await loadHookAndMetrics();
      const { result } = renderHook(() => useWorkspaceNotifications());

      await waitFor(() => {
        expect(metrics.snapshot().lastBadgeRender).not.toBeNull();
      });

      // Hook state mirrors the fetched payload.
      expect(result.current.notifications.length).toBe(seed.length);
      expect(result.current.unreadCount).toBe(sc.expected);

      const networkLogs = findBadgeRenderLogs().filter((p) => p?.source === "network");
      expect(networkLogs.length).toBeGreaterThanOrEqual(1);

      // Both surfaces (log + metrics) agree.
      expect(networkLogs[0].unreadCount).toBe(sc.expected);
      expect(networkLogs[0].unreadCount).toBe(expectedUnread(seed));

      const snap = metrics.snapshot();
      expect(snap.lastBadgeRender?.source).toBe("network");
      expect(snap.lastBadgeRender?.unreadCount).toBe(sc.expected);

      // The cache writeback after the fetch must preserve the same is_read
      // distribution (downstream renders must still derive the same count).
      const persistedRaw = sessionStorage.getItem(CACHE_KEY);
      if (seed.length > 0) {
        expect(persistedRaw).not.toBeNull();
        const persisted = JSON.parse(persistedRaw as string) as { notifications: SeedRow[] };
        expect(expectedUnread(persisted.notifications)).toBe(sc.expected);
      }
    });
  }
});

describe("useWorkspaceNotifications — unreadCount cross-source consistency", () => {
  it("reports the SAME unreadCount on cache and network paths for the same seed", async () => {
    const seed = makeSeed([false, true, false, true, false, true]); // 3 unread
    const expected = expectedUnread(seed);

    // Pass 1: network mount.
    limitMock.mockResolvedValue({ data: seed, error: null });
    let mods = await loadHookAndMetrics();
    const first = renderHook(() => mods.useWorkspaceNotifications());
    await waitFor(() => {
      expect(first.result.current.notifications.length).toBe(seed.length);
    });
    const networkUnread = mods.metrics.snapshot().lastBadgeRender?.unreadCount;
    expect(networkUnread).toBe(expected);
    first.unmount();

    // Pass 2: cache mount (sessionStorage was just written by pass 1, but we
    // re-seed explicitly to control cachedAt and isolate from the previous
    // module's state).
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ cachedAt: Date.now() - 3_000, notifications: seed })
    );
    mods = await loadHookAndMetrics();
    const second = renderHook(() => mods.useWorkspaceNotifications());
    await waitFor(() => {
      expect(mods.metrics.snapshot().lastBadgeRender?.source).toBe("cache");
    });
    const cacheUnread = mods.metrics.snapshot().lastBadgeRender?.unreadCount;
    expect(cacheUnread).toBe(expected);
    expect(cacheUnread).toBe(networkUnread);
    second.unmount();
  });
});
