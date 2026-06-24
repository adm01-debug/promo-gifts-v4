import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// Track every call to .limit() so we can count actual fetches (initial + prefetch + polling)
const limitMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => {
  let lastData = [];
  const buildSelectChain = () => {
    let headCount = false;
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order", "range", "gte"]) {
      chain[m] = (...args: unknown[]) => {
        if (m === "select" && args[1] && (args[1] as { head?: boolean }).head) headCount = true;
        return chain;
      };
    }
    chain.limit = (...args: unknown[]) => limitMock(...args);
    chain.update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    chain.delete = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
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

const STABLE_USER = { id: "user-prefetch-1" };
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: STABLE_USER, rolesLoaded: true }),
}));

const CACHE_KEY = "workspace_notifications_cache:user-prefetch-1";

const SAMPLE_NOTIFICATIONS = [
  {
    id: "n1",
    user_id: "user-prefetch-1",
    title: "Cached title",
    message: "Cached message",
    type: "info",
    category: "general",
    is_read: false,
    action_url: null,
    metadata: {},
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "n2",
    user_id: "user-prefetch-1",
    title: "Cached title 2",
    message: "Cached message 2",
    type: "success",
    category: "general",
    is_read: true,
    action_url: null,
    metadata: {},
    created_at: "2024-01-02T00:00:00Z",
  },
];

beforeEach(() => {
  sessionStorage.clear();
  limitMock.mockReset();
  limitMock.mockResolvedValue({ data: [], error: null });
});

afterEach(() => {
  sessionStorage.clear();
});

async function loadHook() {
  vi.resetModules();
  const mod = await import("@/hooks/ui/useWorkspaceNotifications");
  return mod.useWorkspaceNotifications;
}

describe("useWorkspaceNotifications — prefetch TTL idempotency", () => {
  it("does not refetch when prefetch is called within 5s of last fetch", async () => {
    const useWorkspaceNotifications = await loadHook();
    const { result } = renderHook(() => useWorkspaceNotifications());

    // Wait for the initial mount fetch
    await waitFor(() => expect(limitMock).toHaveBeenCalledTimes(1));

    // Immediate prefetch should be a no-op (within 5s window)
    await act(async () => {
      await result.current.prefetch();
    });
    expect(limitMock).toHaveBeenCalledTimes(1);

    // Multiple back-to-back prefetches should also remain idempotent
    await act(async () => {
      await result.current.prefetch();
      await result.current.prefetch();
      await result.current.prefetch();
    });
    expect(limitMock).toHaveBeenCalledTimes(1);
  });

  it("refetches when prefetch is called after the 5s TTL window", async () => {
    const useWorkspaceNotifications = await loadHook();
    const { result } = renderHook(() => useWorkspaceNotifications());

    await waitFor(() => expect(limitMock).toHaveBeenCalledTimes(1));

    // Move Date.now forward past the 5s threshold
    const realNow = Date.now;
    const baseTime = realNow();
    vi.spyOn(Date, "now").mockImplementation(() => baseTime + 6_000);

    await act(async () => {
      await result.current.prefetch();
    });

    expect(limitMock).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });

  it("never toggles isLoading=true during a silent prefetch", async () => {
    const useWorkspaceNotifications = await loadHook();
    const { result } = renderHook(() => useWorkspaceNotifications());

    await waitFor(() => expect(limitMock).toHaveBeenCalledTimes(1));
    expect(result.current.isLoading).toBe(false);

    const baseTime = Date.now();
    vi.spyOn(Date, "now").mockImplementation(() => baseTime + 6_000);

    let observedLoadingDuringPrefetch = false;
    await act(async () => {
      const promise = result.current.prefetch();
      if (result.current.isLoading) observedLoadingDuringPrefetch = true;
      await promise;
    });

    expect(observedLoadingDuringPrefetch).toBe(false);
    expect(result.current.isLoading).toBe(false);
    vi.restoreAllMocks();
  });
});

describe("useWorkspaceNotifications — sessionStorage hydration", () => {
  it("hydrates notifications + unreadCount from a fresh cache entry, preventing the empty/skeleton state", async () => {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ cachedAt: Date.now(), notifications: SAMPLE_NOTIFICATIONS })
    );

    const useWorkspaceNotifications = await loadHook();
    const { result } = renderHook(() => useWorkspaceNotifications());

    // Cache must populate state synchronously on the first effect tick —
    // the drawer's skeleton condition (`isLoading && notifications.length === 0`)
    // can never become true once hydration has run.
    await waitFor(() => {
      expect(result.current.notifications).toHaveLength(2);
      expect(result.current.unreadCount).toBe(1);
    });

    // With cache hydrated, the drawer's skeleton expression resolves to false
    expect(result.current.isLoading && result.current.notifications.length === 0).toBe(false);
  });

  it("ignores cache entries older than the 60s TTL", async () => {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        cachedAt: Date.now() - 120_000, // 2 minutes old
        notifications: SAMPLE_NOTIFICATIONS,
      })
    );

    const useWorkspaceNotifications = await loadHook();
    const { result } = renderHook(() => useWorkspaceNotifications());

    // Stale cache must NOT pre-populate the list
    expect(result.current.notifications).toHaveLength(0);
  });

  it("writes a fresh cache entry after a successful fetch", async () => {
    limitMock.mockResolvedValueOnce({ data: SAMPLE_NOTIFICATIONS, error: null });

    const useWorkspaceNotifications = await loadHook();
    const { result } = renderHook(() => useWorkspaceNotifications());

    await waitFor(() => expect(result.current.notifications).toHaveLength(2));

    const raw = sessionStorage.getItem(CACHE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as { cachedAt: number; notifications: unknown[] };
    expect(parsed.notifications).toHaveLength(2);
    expect(typeof parsed.cachedAt).toBe("number");
  });
});
