/**
 * NotificationDrawer — trigger/fetch counter increments
 *
 * Verifies that `notificationsMetrics`:
 *   - increments `triggers` (and the per-source `byTrigger.hover` bucket) on
 *     every hover event, BEFORE the debounce fires.
 *   - increments `fetches` (and `byFetch.prefetch`) exactly once when the
 *     debounced prefetch network call resolves, regardless of how many
 *     hover events were coalesced.
 *   - keeps `ratio` (= fetches / triggers) consistent with the counters.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { notificationsMetrics } from "@/lib/notifications-metrics";

// Mock prefetch with a controllable promise so we can assert that `fetches`
// increments AFTER the network call (not on debounce-timer fire).
let resolvePrefetch: (() => void) | null = null;
const prefetchMock = vi.fn(() => {
  // Each prefetch call should also bump the FetchSource counter the way the
  // real hook does. The bell only calls recordTrigger; the hook is responsible
  // for recording the fetch when the network round-trip starts/ends.
  return new Promise<void>((res) => {
    resolvePrefetch = () => {
      notificationsMetrics.recordFetch("prefetch");
      res();
    };
  });
});

vi.mock("@/hooks/ui", () => ({
  useNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    isRefetching: false,
    isMutationRehydrating: false,
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    clearAll: vi.fn(),
    refresh: vi.fn(),
    prefetch: prefetchMock,
    page: 1,
    totalCount: 0,
    search: "",
    category: "all",
    unreadOnly: false,
    dateRange: { from: undefined, to: undefined },
    setPage: vi.fn(),
    setSearch: vi.fn(),
    setCategory: vi.fn(),
    setUnreadOnly: vi.fn(),
    setDateRange: vi.fn(),
    undoMarkAsRead: vi.fn(),
    push: {},
  }),
}));

vi.mock("@/components/a11y/AriaLive", () => ({
  useAriaLive: () => ({ announce: vi.fn() }),
  AriaLive: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock("framer-motion", () => {
  const passthrough = (Tag: keyof JSX.IntrinsicElements) =>
    React.forwardRef<HTMLElement, Record<string, unknown>>(function M(props, ref) {
      const { children, ...rest } = props as { children?: React.ReactNode };
      const clean: Record<string, unknown> = {};
      for (const k of Object.keys(rest)) {
        if (!/^(initial|animate|exit|transition|whileHover|whileTap|variants|layout)/.test(k)) {
          clean[k] = (rest as Record<string, unknown>)[k];
        }
      }
      return React.createElement(Tag, { ref, ...clean }, children);
    });
  return {
    motion: new Proxy({}, { get: (_t, p: string) => passthrough(p as keyof JSX.IntrinsicElements) }),
    m: new Proxy({}, { get: (_t, p: string) => passthrough(p as keyof JSX.IntrinsicElements) }),
    LazyMotion: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    domMax: {},
    domAnimation: {},
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  };
});

import { NotificationBell } from "@/components/notifications/NotificationDrawer";

function renderBell(props: { prefetchDebounceMs?: number } = {}) {
  return render(
    <MemoryRouter>
      <TooltipProvider>
        <NotificationBell {...props} />
      </TooltipProvider>
    </MemoryRouter>
  );
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("NotificationDrawer — trigger/fetch counters", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    prefetchMock.mockClear();
    resolvePrefetch = null;
    notificationsMetrics.reset();
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    notificationsMetrics.reset();
  });

  it("increments `triggers` on hover BEFORE the debounce fires (no fetches yet)", () => {
    renderBell({ prefetchDebounceMs: 200 });
    const bell = screen.getByRole("button", { name: /notificações/i });

    expect(notificationsMetrics.snapshot()).toMatchObject({
      triggers: 0,
      fetches: 0,
      byTrigger: { hover: 0, focus: 0, "drawer-open": 0 },
      byFetch: { prefetch: 0, initial: 0, polling: 0, mutation: 0 },
    });

    fireEvent.mouseEnter(bell);

    const snap = notificationsMetrics.snapshot();
    expect(snap.triggers).toBe(1);
    expect(snap.byTrigger.hover).toBe(1);
    expect(snap.byTrigger.focus).toBe(0);
    // Fetch must NOT have happened yet — debounce timer is still pending.
    expect(snap.fetches).toBe(0);
    expect(snap.byFetch.prefetch).toBe(0);
    expect(prefetchMock).not.toHaveBeenCalled();
  });

  it("increments `fetches` exactly once when the prefetch network call resolves", async () => {
    renderBell({ prefetchDebounceMs: 200 });
    const bell = screen.getByRole("button", { name: /notificações/i });

    fireEvent.mouseEnter(bell);

    // Fire the debounce timer → invokes prefetch() (still pending).
    await act(async () => { vi.advanceTimersByTime(200); });
    expect(prefetchMock).toHaveBeenCalledTimes(1);

    // Network in-flight: fetches counter should still be 0.
    expect(notificationsMetrics.snapshot().fetches).toBe(0);
    expect(notificationsMetrics.snapshot().byFetch.prefetch).toBe(0);

    // Resolve the network call → recordFetch("prefetch") fires inside resolver.
    resolvePrefetch!();
    await flushMicrotasks();

    const snap = notificationsMetrics.snapshot();
    expect(snap.fetches).toBe(1);
    expect(snap.byFetch.prefetch).toBe(1);
    expect(snap.triggers).toBe(1);
    expect(snap.ratio).toBe(1); // 1 fetch / 1 trigger
  });

  it("coalesces a hover burst: many triggers, ONE fetch, ratio drops accordingly", async () => {
    renderBell({ prefetchDebounceMs: 200 });
    const bell = screen.getByRole("button", { name: /notificações/i });

    // 5 rapid hovers within the debounce window.
    for (let i = 0; i < 5; i++) {
      fireEvent.mouseEnter(bell);
      vi.advanceTimersByTime(20); // 5 * 20 = 100ms — inside the 200ms window
    }

    // After the burst: triggers = 5, fetches = 0, prefetch not yet called.
    let snap = notificationsMetrics.snapshot();
    expect(snap.triggers).toBe(5);
    expect(snap.byTrigger.hover).toBe(5);
    expect(snap.fetches).toBe(0);
    expect(prefetchMock).not.toHaveBeenCalled();

    // Cross the debounce threshold and resolve.
    await act(async () => { vi.advanceTimersByTime(200); });
    expect(prefetchMock).toHaveBeenCalledTimes(1);
    resolvePrefetch!();
    await flushMicrotasks();

    snap = notificationsMetrics.snapshot();
    expect(snap.triggers).toBe(5);
    expect(snap.fetches).toBe(1);
    expect(snap.byFetch.prefetch).toBe(1);
    expect(snap.ratio).toBe(0.2); // 1 / 5
  });

  it("keeps trigger/fetch counters consistent across two independent burst cycles", async () => {
    renderBell({ prefetchDebounceMs: 100 });
    const bell = screen.getByRole("button", { name: /notificações/i });

    // Cycle 1: 3 hovers → 1 fetch.
    fireEvent.mouseEnter(bell);
    fireEvent.mouseEnter(bell);
    fireEvent.mouseEnter(bell);
    await act(async () => { vi.advanceTimersByTime(100); });
    resolvePrefetch!();
    await flushMicrotasks();

    expect(notificationsMetrics.snapshot()).toMatchObject({
      triggers: 3,
      fetches: 1,
      byTrigger: { hover: 3 },
      byFetch: { prefetch: 1 },
    });

    // Cycle 2: 2 hovers → 1 more fetch.
    fireEvent.mouseEnter(bell);
    fireEvent.mouseEnter(bell);
    await act(async () => { vi.advanceTimersByTime(100); });
    resolvePrefetch!();
    await flushMicrotasks();

    const snap = notificationsMetrics.snapshot();
    expect(snap.triggers).toBe(5);
    expect(snap.fetches).toBe(2);
    expect(snap.byTrigger.hover).toBe(5);
    expect(snap.byFetch.prefetch).toBe(2);
    expect(snap.ratio).toBe(0.4); // 2 / 5
  });
});
