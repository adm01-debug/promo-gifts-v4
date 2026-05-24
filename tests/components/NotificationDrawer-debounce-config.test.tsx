/**
 * NotificationDrawer — configurable prefetch debounce delay
 *
 * Verifies that `prefetchDebounceMs` controls the trailing-edge window:
 *   - default (200ms) when prop is omitted
 *   - custom short delay (50ms) fires faster
 *   - custom long delay (500ms) takes longer
 *   - delay=0 fires on the next macrotask
 *   - prop changes are picked up live without remounting (delayRef sync)
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
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  };
});

import { NotificationBell, DEFAULT_PREFETCH_DEBOUNCE_MS } from "@/components/notifications/NotificationDrawer";

function renderBell(props: { prefetchDebounceMs?: number } = {}) {
  return render(
    <MemoryRouter>
      <TooltipProvider>
        <NotificationBell {...props} />
      </TooltipProvider>
    </MemoryRouter>
  );
}

describe("NotificationDrawer — configurable prefetch debounce delay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    prefetchMock.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("exports a sane default constant (200ms)", () => {
    expect(DEFAULT_PREFETCH_DEBOUNCE_MS).toBe(200);
  });

  it("uses the default 200ms when prop is omitted", () => {
    renderBell();
    const bell = screen.getByRole("button", { name: /notificações/i });

    fireEvent.mouseEnter(bell);
    vi.advanceTimersByTime(199);
    expect(prefetchMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(prefetchMock).toHaveBeenCalledTimes(1);
  });

  it("fires faster with a shorter custom delay (50ms)", () => {
    renderBell({ prefetchDebounceMs: 50 });
    const bell = screen.getByRole("button", { name: /notificações/i });

    fireEvent.mouseEnter(bell);
    vi.advanceTimersByTime(49);
    expect(prefetchMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(prefetchMock).toHaveBeenCalledTimes(1);
  });

  it("waits longer with a larger custom delay (500ms)", () => {
    renderBell({ prefetchDebounceMs: 500 });
    const bell = screen.getByRole("button", { name: /notificações/i });

    fireEvent.mouseEnter(bell);

    // Default would have fired by 200ms — the 500ms config must NOT have
    vi.advanceTimersByTime(200);
    expect(prefetchMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(299);
    expect(prefetchMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(prefetchMock).toHaveBeenCalledTimes(1);
  });

  it("with delay=0, fires on the next macrotask", () => {
    renderBell({ prefetchDebounceMs: 0 });
    const bell = screen.getByRole("button", { name: /notificações/i });

    fireEvent.mouseEnter(bell);
    expect(prefetchMock).not.toHaveBeenCalled(); // setTimeout(fn, 0) is still async

    vi.advanceTimersByTime(0);
    expect(prefetchMock).toHaveBeenCalledTimes(1);
  });

  it("still coalesces a burst of events with a custom delay (100ms)", () => {
    renderBell({ prefetchDebounceMs: 100 });
    const bell = screen.getByRole("button", { name: /notificações/i });

    for (let i = 0; i < 5; i++) {
      fireEvent.mouseEnter(bell);
      vi.advanceTimersByTime(20); // 5 * 20ms = 100ms but each resets the timer
    }

    expect(prefetchMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(prefetchMock).toHaveBeenCalledTimes(1);
  });

  it("picks up prop changes live without remounting (delayRef sync)", () => {
    const { rerender } = render(
      <MemoryRouter>
        <TooltipProvider>
          <NotificationBell prefetchDebounceMs={500} />
        </TooltipProvider>
      </MemoryRouter>
    );
    const bell = screen.getByRole("button", { name: /notificações/i });

    // Switch to a much shorter delay before any event fires
    rerender(
      <MemoryRouter>
        <TooltipProvider>
          <NotificationBell prefetchDebounceMs={50} />
        </TooltipProvider>
      </MemoryRouter>
    );

    fireEvent.mouseEnter(bell);
    vi.advanceTimersByTime(50);
    expect(prefetchMock).toHaveBeenCalledTimes(1);
  });
});
