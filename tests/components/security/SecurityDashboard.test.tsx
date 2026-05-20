/**
 * Tests for SecurityDashboard (680 lines)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";

vi.mock("@/hooks/auth/use2FA", () => ({
  use2FA: vi.fn().mockReturnValue({
    is2FAEnabled: false,
    isLoading: false,
    enable2FA: vi.fn(),
    disable2FA: vi.fn(),
    verify2FA: vi.fn(),
    qrCodeUrl: null,
    secret: null,
  }),
}));

vi.mock("@/hooks/admin/useAllowedIPs", () => ({
  useAllowedIPs: vi.fn().mockReturnValue({
    allowedIPs: [],
    isLoading: false,
    addIP: vi.fn(),
    removeIP: vi.fn(),
  }),
}));

describe("SecurityDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports SecurityDashboard component", async () => {
    const mod = await import("@/components/security/SecurityDashboard");
    expect(mod.SecurityDashboard).toBeDefined();
    expect(typeof mod.SecurityDashboard).toBe("function");
  }, 15000);
});
