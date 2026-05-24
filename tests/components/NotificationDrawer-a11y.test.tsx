/**
 * NotificationDrawer — keyboard & screen-reader prefetch coverage
 *
 * Validates that the debounced prefetch is reachable through every input
 * modality a non-mouse user might use, AND that the bell exposes proper
 * ARIA semantics for assistive tech.
 *
 * Covered:
 *   - Tab focus (keyboard navigation) → focus event → prefetch
 *   - Programmatic .focus() (screen reader / focus trap) → prefetch
 *   - Touch tap (mobile, no hover) → touchstart → prefetch
 *   - aria-label reflects unreadCount for screen readers
 *   - aria-haspopup / aria-expanded toggle correctly
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";

const prefetchMock = vi.fn(() => Promise.resolve());

let mockUnreadCount = 0;
vi.mock("@/hooks/ui", () => ({
  useNotifications: () => ({
    notifications: [],
    unreadCount: mockUnreadCount,
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

describe("NotificationDrawer — keyboard & screen-reader prefetch coverage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    prefetchMock.mockClear();
    mockUnreadCount = 0;
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("triggers prefetch when the bell receives keyboard focus (Tab navigation)", () => {
    renderBell();
    const bell = screen.getByRole("button", { name: /notificações/i });

    // Tab landing on the bell fires a native focus event
    fireEvent.focus(bell);
    vi.advanceTimersByTime(200);

    expect(prefetchMock).toHaveBeenCalledTimes(1);
  });

  it("triggers prefetch when focused programmatically (screen reader navigation)", () => {
    renderBell();
    const bell = screen.getByRole("button", { name: /notificações/i }) as HTMLButtonElement;

    // Screen readers and focus traps invoke .focus() directly
    bell.focus();
    vi.advanceTimersByTime(200);

    expect(prefetchMock).toHaveBeenCalledTimes(1);
  });

  it("triggers prefetch on touchstart for touch-only devices (no hover capability)", () => {
    renderBell();
    const bell = screen.getByRole("button", { name: /notificações/i });

    fireEvent.touchStart(bell);
    vi.advanceTimersByTime(200);

    expect(prefetchMock).toHaveBeenCalledTimes(1);
  });

  it("coalesces a focus → hover → touch sequence into a single prefetch", () => {
    renderBell();
    const bell = screen.getByRole("button", { name: /notificações/i });

    fireEvent.focus(bell);
    vi.advanceTimersByTime(50);
    fireEvent.mouseEnter(bell);
    vi.advanceTimersByTime(50);
    fireEvent.touchStart(bell);

    expect(prefetchMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(prefetchMock).toHaveBeenCalledTimes(1);
  });

  it("exposes proper ARIA semantics: role=button, aria-haspopup=dialog, aria-expanded=false", () => {
    renderBell();
    const bell = screen.getByRole("button", { name: /notificações/i });

    expect(bell.getAttribute("aria-haspopup")).toBe("dialog");
    expect(bell.getAttribute("aria-expanded")).toBe("false");
  });

  it("aria-label includes the unread count so screen readers announce '3 não lidas'", () => {
    mockUnreadCount = 3;
    renderBell();
    const bell = screen.getByRole("button", { name: /3 não lidas/i });

    expect(bell.getAttribute("aria-label")).toBe("Notificações, 3 não lidas");
  });

  it("aria-label uses singular form for exactly one unread notification", () => {
    mockUnreadCount = 1;
    renderBell();
    const bell = screen.getByRole("button", { name: /1 não lida$/i });

    expect(bell.getAttribute("aria-label")).toBe("Notificações, 1 não lida");
  });

  it("aria-label falls back to plain 'Notificações' when there are zero unread", () => {
    mockUnreadCount = 0;
    renderBell();
    const bell = screen.getByRole("button", { name: /notificações/i });

    expect(bell.getAttribute("aria-label")).toBe("Notificações");
  });
});
