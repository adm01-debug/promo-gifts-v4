/**
 * NotificationDrawer — debounce timer cleanup on unmount
 *
 * Regression: a queued debounced prefetch must NOT fire after the bell
 * unmounts (e.g. user navigates away mid-hover). The cleanup effect inside
 * NotificationBell clears the pending setTimeout; if it ever regresses, a
 * stray `prefetch()` call would race against route teardown and warn about
 * state updates on unmounted components.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";

const prefetchMock = vi.fn(() => Promise.resolve());

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

function renderBell() {
  return render(
    <MemoryRouter>
      <TooltipProvider>
        <NotificationBell />
      </TooltipProvider>
    </MemoryRouter>
  );
}

describe("NotificationDrawer — debounce cleanup on unmount", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    prefetchMock.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("does NOT fire prefetch when the bell unmounts before the debounce settles", () => {
    const { unmount } = renderBell();
    const bell = screen.getByRole("button", { name: /notificações/i });

    // Queue a debounced prefetch, then unmount before the 200ms threshold
    fireEvent.mouseEnter(bell);
    vi.advanceTimersByTime(100);
    expect(prefetchMock).not.toHaveBeenCalled();

    unmount();

    // Even after the original timer's deadline + a generous safety margin,
    // prefetch must remain untouched — the cleanup cleared the pending timer.
    vi.advanceTimersByTime(1_000);
    expect(prefetchMock).not.toHaveBeenCalled();
  });

  it("calls clearTimeout on the pending timer during unmount", () => {
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");

    const { unmount } = renderBell();
    const bell = screen.getByRole("button", { name: /notificações/i });

    fireEvent.mouseEnter(bell);
    fireEvent.focus(bell); // 2nd event should also call clearTimeout (debounce reset)
    const callsBeforeUnmount = clearSpy.mock.calls.length;

    unmount();

    // Unmount must invoke at least one additional clearTimeout for the pending timer
    expect(clearSpy.mock.calls.length).toBeGreaterThan(callsBeforeUnmount);

    clearSpy.mockRestore();
  });

  it("does not fire prefetch after a burst of events when unmounted mid-window", () => {
    const { unmount } = renderBell();
    const bell = screen.getByRole("button", { name: /notificações/i });

    for (let i = 0; i < 5; i++) {
      fireEvent.mouseEnter(bell);
      vi.advanceTimersByTime(20);
    }
    expect(prefetchMock).not.toHaveBeenCalled();

    unmount();
    vi.advanceTimersByTime(2_000);

    expect(prefetchMock).not.toHaveBeenCalled();
  });

  it("does not warn about state updates on unmounted component after late timer flush", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { unmount } = renderBell();
    const bell = screen.getByRole("button", { name: /notificações/i });

    fireEvent.mouseEnter(bell);
    unmount();
    vi.advanceTimersByTime(1_000);

    // No "Can't perform a React state update on an unmounted component" leak
    const offenders = errorSpy.mock.calls.filter((args) =>
      String(args[0] ?? "").toLowerCase().includes("unmounted component")
    );
    expect(offenders).toHaveLength(0);

    errorSpy.mockRestore();
  });
});
