/**
 * Tests for ColumnSelector component — covers:
 * - minWidth field added to ColumnOption
 * - getAvailableOptions(screenWidth) filters options by screen width
 * - screenWidth state tracks window resize events
 * - Clamping effect: calls onChange when value > maxAvailable
 * - Returns null when available.length <= 1
 * - localStorage persistence on click
 * - Accessibility: keyboard navigation and focus
 * - Resilience: handling invalid localStorage values
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, act } from "@testing-library/react";
import { renderWithProviders } from "../render-helpers";
import React from "react";

// Framer-motion can be heavy; stub it so tests focus on logic
vi.mock("framer-motion", () => {
  const motionStub = {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
      React.createElement("div", props, children),
  };
  return {
    motion: motionStub,
    m: motionStub,
    LazyMotion: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    domMax: {},
    domAnimation: {},
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

function resizeWindowTo(width: number) {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
  fireEvent(window, new Event("resize"));
}

describe("ColumnSelector", () => {
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Default to wide screen so all options are available
    resizeWindowTo(1600);
  });

  afterEach(() => {
    resizeWindowTo(1600);
  });

  // ── Availability filtering ─────────────────────────────────────

  it("shows all 5 options on a 1600px screen", async () => {
    const { ColumnSelector } = await import("@/components/products/ColumnSelector");
    resizeWindowTo(1600);
    renderWithProviders(<ColumnSelector value={5} onChange={onChange} />);

    // All 5 aria-labels should be visible
    expect(screen.getByLabelText("3 colunas")).toBeInTheDocument();
    expect(screen.getByLabelText("4 colunas")).toBeInTheDocument();
    expect(screen.getByLabelText("5 colunas")).toBeInTheDocument();
    expect(screen.getByLabelText("6 colunas")).toBeInTheDocument();
    expect(screen.getByLabelText("8 colunas")).toBeInTheDocument();
  });

  it("hides options whose minWidth exceeds screen width", async () => {
    const { ColumnSelector } = await import("@/components/products/ColumnSelector");
    // 899px → only 3 (minWidth=0) and 4 (minWidth=640) available; 5 (minWidth=900) excluded
    resizeWindowTo(899);
    renderWithProviders(<ColumnSelector value={3} onChange={onChange} />);

    expect(screen.getByLabelText("3 colunas")).toBeInTheDocument();
    expect(screen.getByLabelText("4 colunas")).toBeInTheDocument();
    expect(screen.queryByLabelText("5 colunas")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("6 colunas")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("8 colunas")).not.toBeInTheDocument();
  });

  it("shows only 3-col option on a 400px screen (mobile)", async () => {
    const { ColumnSelector } = await import("@/components/products/ColumnSelector");
    resizeWindowTo(400);
    // With only 1 option available the component returns null
    const { container } = renderWithProviders(<ColumnSelector value={3} onChange={onChange} />);
    expect(container.firstChild).toBeNull();
  });

  // ── Null return when <= 1 option ──────────────────────────────

  it("returns null when screen width is below 768px (only 3-col option)", async () => {
    const { ColumnSelector } = await import("@/components/products/ColumnSelector");
    resizeWindowTo(600);
    const { container } = renderWithProviders(<ColumnSelector value={3} onChange={onChange} />);
    expect(container.firstChild).toBeNull();
  });

  // ── Clamping effect ───────────────────────────────────────────

  it("calls onChange with maxAvailable when value exceeds it", async () => {
    const { ColumnSelector } = await import("@/components/products/ColumnSelector");
    // 899px → max available is 4 (5 requires minWidth=900); but value=8 (too high)
    resizeWindowTo(899);
    renderWithProviders(<ColumnSelector value={8} onChange={onChange} />);

    // The clamping useEffect fires on mount
    expect(onChange).toHaveBeenCalledWith(4);
  });

  // ── localStorage persistence on click ────────────────────────

  it("persists selected column to localStorage when a button is clicked", async () => {
    const { ColumnSelector } = await import("@/components/products/ColumnSelector");
    resizeWindowTo(1600);
    renderWithProviders(<ColumnSelector value={3} onChange={onChange} />);

    const btn = screen.getByLabelText("8 colunas");
    fireEvent.click(btn);

    expect(onChange).toHaveBeenCalledWith(8);
    expect(localStorage.getItem("product-grid-columns")).toBe("8");
  });

  // ── Active visual state ───────────────────────────────────────

  it("marks the active button for the currently selected value", async () => {
    const { ColumnSelector } = await import("@/components/products/ColumnSelector");
    resizeWindowTo(1200); // 3, 4, 5 available
    renderWithProviders(<ColumnSelector value={4} onChange={onChange} />);

    const activeBtn = screen.getByLabelText("4 colunas");
    expect(activeBtn).toHaveAttribute("aria-checked", "true");
    expect(activeBtn).toHaveClass("text-primary-foreground");

    const inactiveBtn = screen.getByLabelText("3 colunas");
    expect(inactiveBtn).toHaveAttribute("aria-checked", "false");
  });

  // ── Accessibility ───────────────────────────────────────────

  it("supports keyboard navigation with Enter and Space", async () => {
    const { ColumnSelector } = await import("@/components/products/ColumnSelector");
    resizeWindowTo(1600);
    renderWithProviders(<ColumnSelector value={3} onChange={onChange} />);

    const btn = screen.getByLabelText("5 colunas");
    
    fireEvent.keyDown(btn, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(5);
    
    fireEvent.keyDown(btn, { key: " " });
    expect(onChange).toHaveBeenCalledWith(5);
    expect(localStorage.getItem("product-grid-columns")).toBe("5");
  });

  it("has correct ARIA roles and labels", async () => {
    const { ColumnSelector } = await import("@/components/products/ColumnSelector");
    renderWithProviders(<ColumnSelector value={3} onChange={onChange} />);
    
    expect(screen.getByRole("radiogroup")).toHaveAttribute("aria-label", "Número de colunas");
    const radios = screen.getAllByRole("radio");
    expect(radios.length).toBeGreaterThan(1);
    radios.forEach(radio => {
      expect(radio.getAttribute("aria-label")).toMatch(/colunas/);
    });
  });
});

// ── getDefaultColumns unit tests ──────────────────────────────────

describe("getDefaultColumns", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns persisted value from localStorage when valid", async () => {
    localStorage.setItem("product-grid-columns", "6");
    const { getDefaultColumns } = await import("@/components/products/ColumnSelector");
    expect(getDefaultColumns()).toBe(6);
  });

  it("ignores invalid persisted values and falls back to screen-based default", async () => {
    localStorage.setItem("product-grid-columns", "invalid");
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1400 });
    const { getDefaultColumns } = await import("@/components/products/ColumnSelector");
    expect(getDefaultColumns()).toBe(5);
  });
});