/**
 * NotificationDrawer — trigger→prefetch end-to-end timing
 *
 * Verifies that the bell records a TriggerToFetchTiming sample after every
 * resolved prefetch, that the sample stays well within the 5s TTL window,
 * and that it correctly attributes coalesced events from a hover burst.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  notificationsMetrics,
  TRIGGER_TO_FETCH_TTL_MS,
} from "@/lib/notifications-metrics";

const prefetchMock = vi.fn(() => Promise.resolve());

vi.mock("@/hooks/ui/useNotifications", () => ({
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
  const passthrough = (Tag: keyof React.JSX.IntrinsicElements) =>
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
    motion: new Proxy({}, { get: (_t, p: string) => passthrough(p as keyof React.JSX.IntrinsicElements) }),
    m: new Proxy({}, { get: (_t, p: string) => passthrough(p as keyof React.JSX.IntrinsicElements) }),
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

/** Flush microtasks so the `.finally()` after `prefetch()` runs. */
async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("NotificationDrawer — trigger→prefetch end-to-end timing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    prefetchMock.mockClear();
    prefetchMock.mockImplementation(() => Promise.resolve());
    notificationsMetrics.reset();
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    notificationsMetrics.reset();
  });

  it("records a timing sample after a single hover→prefetch cycle (well within TTL)", async () => {
    renderBell({ prefetchDebounceMs: 100 });
    const bell = screen.getByRole("button", { name: /notificações/i });

    fireEvent.mouseEnter(bell);
    await act(async () => { vi.advanceTimersByTime(100); });
    await flushPromises();

    const snap = notificationsMetrics.snapshot();
    expect(snap.lastTriggerToFetch).not.toBeNull();
    expect(snap.lastTriggerToFetch!.source).toBe("hover");
    expect(snap.lastTriggerToFetch!.coalescedTriggers).toBe(1);
    expect(snap.lastTriggerToFetch!.totalMs).toBeLessThan(TRIGGER_TO_FETCH_TTL_MS);
    expect(snap.lastTriggerToFetch!.withinTtl).toBe(true);
    expect(snap.triggerToFetchTtlBreaches).toBe(0);
  });

  it("attributes coalesced count from a hover burst to ONE sample", async () => {
    renderBell({ prefetchDebounceMs: 200 });
    const bell = screen.getByRole("button", { name: /notificações/i });

    for (let i = 0; i < 8; i++) {
      fireEvent.mouseEnter(bell);
      vi.advanceTimersByTime(20); // 8 * 20 = 160ms — still inside the 200ms window
    }
    await act(async () => { vi.advanceTimersByTime(200); });
    await flushPromises();

    const snap = notificationsMetrics.snapshot();
    expect(snap.triggerToFetch).toHaveLength(1);
    expect(snap.lastTriggerToFetch!.coalescedTriggers).toBe(8);
    expect(snap.lastTriggerToFetch!.source).toBe("hover");
    expect(prefetchMock).toHaveBeenCalledTimes(1);
  });

  it("debounceMs is roughly equal to the configured delay (proves it measures FROM first event)", async () => {
    renderBell({ prefetchDebounceMs: 300 });
    const bell = screen.getByRole("button", { name: /notificações/i });

    fireEvent.mouseEnter(bell);
    vi.advanceTimersByTime(100);
    fireEvent.mouseEnter(bell); // resets timer; first event was 100ms ago
    await act(async () => { vi.advanceTimersByTime(300); });
    await flushPromises();

    const snap = notificationsMetrics.snapshot();
    // First event → resolution should be ~100 + 300 = 400ms.
    // Use a generous lower bound (>=350) since fake timers + microtask drift
    // can shave a few ms.
    expect(snap.lastTriggerToFetch!.debounceMs).toBeGreaterThanOrEqual(350);
    expect(snap.lastTriggerToFetch!.totalMs).toBeLessThan(TRIGGER_TO_FETCH_TTL_MS);
  });

  it("a fresh burst after the first prefetch produces a NEW sample with coalescedTriggers reset", async () => {
    renderBell({ prefetchDebounceMs: 100 });
    const bell = screen.getByRole("button", { name: /notificações/i });

    fireEvent.mouseEnter(bell);
    fireEvent.mouseEnter(bell);
    await act(async () => { vi.advanceTimersByTime(100); });
    await flushPromises();

    fireEvent.mouseEnter(bell);
    await act(async () => { vi.advanceTimersByTime(100); });
    await flushPromises();

    const snap = notificationsMetrics.snapshot();
    expect(snap.triggerToFetch).toHaveLength(2);
    // History is most-recent-first.
    expect(snap.triggerToFetch[0].coalescedTriggers).toBe(1);
    expect(snap.triggerToFetch[1].coalescedTriggers).toBe(2);
  });

  it("flags a TTL breach when the prefetch promise hangs past the 5s window", async () => {
    // Simulate a slow network: the prefetch resolves only after we manually flush.
    let resolvePrefetch: () => void = () => {};
    prefetchMock.mockImplementation(
      () => new Promise<void>((res) => { resolvePrefetch = res; })
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    renderBell({ prefetchDebounceMs: 100 });
    const bell = screen.getByRole("button", { name: /notificações/i });

    fireEvent.mouseEnter(bell);
    await act(async () => { vi.advanceTimersByTime(100); });
    // Now the prefetch is in-flight. Advance well past the TTL window.
    await act(async () => { vi.advanceTimersByTime(TRIGGER_TO_FETCH_TTL_MS + 500); });
    resolvePrefetch();
    await flushPromises();

    const snap = notificationsMetrics.snapshot();
    expect(snap.triggerToFetchTtlBreaches).toBe(1);
    expect(snap.lastTriggerToFetch!.withinTtl).toBe(false);
    expect(snap.lastTriggerToFetch!.totalMs).toBeGreaterThanOrEqual(TRIGGER_TO_FETCH_TTL_MS);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("trigger→fetch exceeded TTL window"),
    );
    warnSpy.mockRestore();
  });
});
