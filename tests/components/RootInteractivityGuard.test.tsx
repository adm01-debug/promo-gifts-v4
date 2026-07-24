import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { RootInteractivityGuard } from "@/components/system/RootInteractivityGuard";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("style");
  document.body.removeAttribute("style");
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("RootInteractivityGuard", () => {
  function mockElementFromPoint(el: Element) {
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: vi.fn().mockReturnValue(el),
    });
  }

  it("restores a stuck pointer-events:none on the root when the user clicks", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<RootInteractivityGuard />);

    // Simulate the app being frozen: body inert, no overlay open.
    document.body.style.pointerEvents = "none";

    act(() => {
      window.dispatchEvent(new Event("pointerdown"));
    });

    expect(getComputedStyle(document.body).pointerEvents).not.toBe("none");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("root pointer-events:none"),
    );
  });

  it("does NOT restore while a modal overlay is genuinely open", () => {
    render(<RootInteractivityGuard />);

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("data-state", "open");
    document.body.appendChild(dialog);
    document.body.style.pointerEvents = "none";

    act(() => {
      window.dispatchEvent(new Event("pointerdown"));
    });

    // Lock is legitimate (a real modal is open) → left untouched.
    expect(document.body.style.pointerEvents).toBe("none");
  });

  it("neutralizes a persistent invisible full-screen ghost overlay", () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const ghost = document.createElement("div");
    ghost.style.position = "fixed";
    ghost.style.inset = "0";
    ghost.style.opacity = "0";
    ghost.style.zIndex = "100";
    ghost.getBoundingClientRect = () =>
      ({
        width: window.innerWidth,
        height: window.innerHeight,
        top: 0,
        left: 0,
        right: window.innerWidth,
        bottom: window.innerHeight,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    document.body.appendChild(ghost);
    mockElementFromPoint(ghost);

    render(<RootInteractivityGuard />);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(ghost.style.pointerEvents).toBe("none");
    expect(ghost.getAttribute("data-interactivity-ghost")).toBe("true");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("ghost overlay neutralized"),
    );
  });

  it("does not neutralize an invisible element that belongs to an open overlay", () => {
    vi.useFakeTimers();
    const overlay = document.createElement("div");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("data-state", "open");
    overlay.style.opacity = "0";
    overlay.getBoundingClientRect = () =>
      ({
        width: window.innerWidth,
        height: window.innerHeight,
        top: 0,
        left: 0,
        right: window.innerWidth,
        bottom: window.innerHeight,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    document.body.appendChild(overlay);
    mockElementFromPoint(overlay);

    render(<RootInteractivityGuard />);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(overlay.style.pointerEvents).toBe("");
    expect(overlay.hasAttribute("data-interactivity-ghost")).toBe(false);
  });
});
