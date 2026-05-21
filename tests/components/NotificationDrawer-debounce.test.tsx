/**
 * NotificationDrawer — bell hover/focus debounce
 *
 * Verifies that rapid hover/focus events on the bell trigger collapse to a
 * single `prefetch()` call via a 200ms trailing-edge debounce.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";

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
    push: {},
  }),
}));

vi.mock("@/components/a11y/AriaLive", () => ({
  useAriaLive: () => ({ announce: vi.fn() }),
  AriaLive: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

// framer-motion: render children plainly, drop animation props
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

describe("NotificationDrawer — bell hover/focus debounce (200ms)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    prefetchMock.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("coalesces a burst of rapid hover events into a single prefetch call", () => {
    renderBell();
    const bell = screen.getByLabelText("Notificações");

    // Fire 10 mouseEnter events back-to-back, well under the 200ms window
    for (let i = 0; i < 10; i++) {
      fireEvent.mouseEnter(bell);
      vi.advanceTimersByTime(10); // 10 * 10ms = 100ms total — still inside window
    }

    // Nothing should have fired yet (trailing edge not reached)
    expect(prefetchMock).not.toHaveBeenCalled();

    // Cross the 200ms threshold from the last event
    vi.advanceTimersByTime(200);

    expect(prefetchMock).toHaveBeenCalledTimes(1);
  });

  it("coalesces mixed hover + focus events into a single prefetch call", () => {
    renderBell();
    const bell = screen.getByLabelText("Notificações");

    fireEvent.mouseEnter(bell);
    vi.advanceTimersByTime(50);
    fireEvent.focus(bell);
    vi.advanceTimersByTime(50);
    fireEvent.mouseEnter(bell);
    vi.advanceTimersByTime(50);
    fireEvent.focus(bell);

    expect(prefetchMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(prefetchMock).toHaveBeenCalledTimes(1);
  });

  it("fires exactly once at the trailing edge, 200ms after the LAST event", () => {
    renderBell();
    const bell = screen.getByLabelText("Notificações");

    fireEvent.mouseEnter(bell);
    vi.advanceTimersByTime(199); // just before threshold from 1st event
    expect(prefetchMock).not.toHaveBeenCalled();

    fireEvent.mouseEnter(bell); // resets the timer
    vi.advanceTimersByTime(199); // still not enough from 2nd event
    expect(prefetchMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1); // exactly 200ms from last event
    expect(prefetchMock).toHaveBeenCalledTimes(1);
  });

  it("allows a second prefetch after the debounce window has elapsed", () => {
    renderBell();
    const bell = screen.getByLabelText("Notificações");

    fireEvent.mouseEnter(bell);
    vi.advanceTimersByTime(200);
    expect(prefetchMock).toHaveBeenCalledTimes(1);

    // New burst after the first prefetch settled
    fireEvent.mouseEnter(bell);
    fireEvent.mouseEnter(bell);
    vi.advanceTimersByTime(200);
    expect(prefetchMock).toHaveBeenCalledTimes(2);
  });
});
