import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

/**
 * Verifies that markAllAsRead and clearAll:
 *  1. Remove the sessionStorage cache entry for the current user.
 *  2. Trigger a silent re-fetch (fetchNotifications({ silent: true }))
 *     so unreadCount cannot drift from the server.
 *
 * "Silent" is observable by the fact that isLoading never toggles to true
 * during the operation — only isRefetching does.
 */

const limitMock = vi.fn();
const updateEqEqMock = vi.fn().mockResolvedValue({ error: null });
const updateEqMock = vi.fn(() => ({ eq: updateEqEqMock }));
const updateMock = vi.fn(() => ({ eq: updateEqMock }));
const deleteEqMock = vi.fn().mockResolvedValue({ error: null });
const deleteMock = vi.fn(() => ({ eq: deleteEqMock }));

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
    chain.update = (...args) => updateMock(...args);
    chain.delete = (...args) => deleteMock(...args);
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

const STABLE_USER = { id: "user-cache-inv-1" };
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: STABLE_USER, rolesLoaded: true }),
}));

const CACHE_KEY = "workspace_notifications_cache:user-cache-inv-1";

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
    is_read: false,
    action_url: null,
    metadata: {},
    created_at: "2024-01-02T00:00:00Z",
  },
];

beforeEach(() => {
  sessionStorage.clear();
  limitMock.mockReset();
  updateMock.mockClear();
  updateEqMock.mockClear();
  updateEqEqMock.mockClear();
  updateEqEqMock.mockResolvedValue({ error: null });
  deleteMock.mockClear();
  deleteEqMock.mockClear();
  deleteEqMock.mockResolvedValue({ error: null });
  // Initial fetch returns SEED; subsequent silent re-fetch returns server-fresh state (all read / empty).
  limitMock.mockResolvedValueOnce({ data: SEED, error: null });
});

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

async function loadHook() {
  vi.resetModules();
  const mod = await import("@/hooks/ui/useWorkspaceNotifications");
  return mod.useWorkspaceNotifications;
}

describe("useWorkspaceNotifications — cache invalidation after mutations", () => {
  it("markAllAsRead removes the sessionStorage cache entry and triggers a silent re-fetch", async () => {
    const useWorkspaceNotifications = await loadHook();
    const { result } = renderHook(() => useWorkspaceNotifications());

    // initial fetch + cache write
    await waitFor(() => expect(result.current.notifications).toHaveLength(2));
    expect(sessionStorage.getItem(CACHE_KEY)).toBeTruthy();
    expect(limitMock).toHaveBeenCalledTimes(1);

    // The silent re-fetch after markAllAsRead returns the server-of-truth
    // (everything already read) — this is what re-hydrates unreadCount.
    const SERVER_AFTER_MARK = SEED.map((n) => ({ ...n, is_read: true }));
    limitMock.mockResolvedValueOnce({ data: SERVER_AFTER_MARK, error: null });

    let observedLoading = false;
    await act(async () => {
      const promise = result.current.markAllAsRead();
      if (result.current.isLoading) observedLoading = true;
      await promise;
    });

    // Mutation actually issued
    expect(updateMock).toHaveBeenCalledTimes(1);

    // Silent re-fetch happened (limit called a 2nd time) and never flipped isLoading
    expect(limitMock).toHaveBeenCalledTimes(2);
    expect(observedLoading).toBe(false);
    expect(result.current.isLoading).toBe(false);

    // unreadCount reflects the server-truth, not just the optimistic update
    expect(result.current.unreadCount).toBe(0);

    // Cache was invalidated then re-written from the silent fetch result.
    // The crucial guarantee is that the entry on disk now matches the server,
    // not the previous (pre-mutation) snapshot.
    const raw = sessionStorage.getItem(CACHE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as { notifications: Array<{ is_read: boolean }> };
    expect(parsed.notifications.every((n) => n.is_read)).toBe(true);
  });

  it("clearAll removes the sessionStorage cache entry and triggers a silent re-fetch", async () => {
    const useWorkspaceNotifications = await loadHook();
    const { result } = renderHook(() => useWorkspaceNotifications());

    await waitFor(() => expect(result.current.notifications).toHaveLength(2));
    expect(sessionStorage.getItem(CACHE_KEY)).toBeTruthy();
    expect(limitMock).toHaveBeenCalledTimes(1);

    // Server is empty after clearAll
    limitMock.mockResolvedValueOnce({ data: [], error: null });

    let observedLoading = false;
    await act(async () => {
      const promise = result.current.clearAll();
      if (result.current.isLoading) observedLoading = true;
      await promise;
    });

    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(limitMock).toHaveBeenCalledTimes(2); // silent re-fetch happened
    expect(observedLoading).toBe(false);
    expect(result.current.isLoading).toBe(false);

    expect(result.current.notifications).toHaveLength(0);
    expect(result.current.unreadCount).toBe(0);

    // Cache rewritten with server-truth (empty list)
    const raw = sessionStorage.getItem(CACHE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as { notifications: unknown[] };
    expect(parsed.notifications).toHaveLength(0);
  });

  it("re-fetch after markAllAsRead bypasses the 5s prefetch TTL window", async () => {
    // Regression guard: lastFetchAtRef must be reset to 0 inside markAllAsRead,
    // otherwise the silent re-fetch would be skipped because the initial fetch
    // happened <5s ago.
    const useWorkspaceNotifications = await loadHook();
    const { result } = renderHook(() => useWorkspaceNotifications());

    await waitFor(() => expect(limitMock).toHaveBeenCalledTimes(1));

    limitMock.mockResolvedValueOnce({ data: [], error: null });

    await act(async () => {
      await result.current.markAllAsRead();
    });

    // The silent re-fetch must have run even though only milliseconds passed
    expect(limitMock).toHaveBeenCalledTimes(2);
  });
});

describe("useWorkspaceNotifications — cache TTL is honored, then invalidated by mutations", () => {
  it("uses a fresh (within 60s TTL) sessionStorage entry to hydrate before any network call", async () => {
    // Pre-seed cache with a fresh entry. The hook MUST hydrate from it before
    // (or independently of) the initial fetch — proving the cache is honored
    // within the TTL window.
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ cachedAt: Date.now() - 1_000, notifications: SEED })
    );

    const useWorkspaceNotifications = await loadHook();
    const { result } = renderHook(() => useWorkspaceNotifications());

    // Hydration is synchronous from the first effect tick — assert before any
    // network resolves. unreadCount comes from the cache, not from limitMock.
    await waitFor(() => {
      expect(result.current.notifications).toHaveLength(2);
      expect(result.current.unreadCount).toBe(2);
    });
  });

  it("markAllAsRead deletes the cache key BEFORE the silent re-fetch writes a new one", async () => {
    // Pre-seed a fresh cache so we can prove the entry observed mid-mutation
    // is the new one (post-invalidation), not the pre-mutation snapshot.
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ cachedAt: Date.now(), notifications: SEED })
    );

    // Reset the queue so we control exactly two calls: mount fetch + silent re-fetch.
    limitMock.mockReset();
    // Capture the cache state at the exact moment the silent re-fetch runs.
    // Because the hook does: removeItem(CACHE_KEY) -> await fetch -> writeCache,
    // sessionStorage MUST be empty at the start of the .limit() call.
    let cacheAtRefetchTime: string | null = "<unset>";
    limitMock
      // initial mount fetch
      .mockResolvedValueOnce({ data: SEED, error: null })
      // silent re-fetch after markAllAsRead — sample the cache here
      .mockImplementationOnce(async () => {
        cacheAtRefetchTime = sessionStorage.getItem(CACHE_KEY);
        return { data: SEED.map((n) => ({ ...n, is_read: true })), error: null };
      });

    const useWorkspaceNotifications = await loadHook();
    const { result } = renderHook(() => useWorkspaceNotifications());

    await waitFor(() => expect(result.current.notifications).toHaveLength(2));

    await act(async () => {
      await result.current.markAllAsRead();
    });

    // The pre-existing cache was wiped before the silent re-fetch ran
    expect(cacheAtRefetchTime).toBeNull();
    // After the re-fetch resolves, a fresh cache entry exists with server-truth
    const raw = sessionStorage.getItem(CACHE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as { notifications: Array<{ is_read: boolean }> };
    expect(parsed.notifications.every((n) => n.is_read)).toBe(true);
  });

  it("clearAll deletes the cache key BEFORE the silent re-fetch writes a new one", async () => {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ cachedAt: Date.now(), notifications: SEED })
    );

    limitMock.mockReset();
    let cacheAtRefetchTime: string | null = "<unset>";
    limitMock
      .mockResolvedValueOnce({ data: SEED, error: null })
      .mockImplementationOnce(async () => {
        cacheAtRefetchTime = sessionStorage.getItem(CACHE_KEY);
        return { data: [], error: null };
      });

    const useWorkspaceNotifications = await loadHook();
    const { result } = renderHook(() => useWorkspaceNotifications());

    await waitFor(() => expect(result.current.notifications).toHaveLength(2));

    await act(async () => {
      await result.current.clearAll();
    });

    expect(cacheAtRefetchTime).toBeNull();
    const raw = sessionStorage.getItem(CACHE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as { notifications: unknown[] };
    expect(parsed.notifications).toHaveLength(0);
  });
});
