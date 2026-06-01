/**
 * Tests for GlobalCommandBar (644 lines)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: vi.fn().mockReturnValue({
    theme: "dark",
    actualTheme: "dark",
    setTheme: vi.fn(),
    toggleTheme: vi.fn(),
  }),
}));

describe("GlobalCommandBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports GlobalCommandBar component", async () => {
    const mod = await import("@/components/command/GlobalCommandBar");
    expect(mod.GlobalCommandBar).toBeDefined();
    expect(["function", "object"].includes(typeof mod.GlobalCommandBar)).toBe(true);
  });

  it("exports useCommandBar hook", async () => {
    const { useCommandBar } = await import("@/components/command/GlobalCommandBar");
    expect(typeof useCommandBar).toBe("function");
  });
});
