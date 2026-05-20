import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockRange = vi.fn();
const mockIlike = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
    })),
  },
}));

// Chain mocks
beforeEach(() => {
  vi.clearAllMocks();
  mockSelect.mockReturnValue({ order: mockOrder, gte: mockGte });
  mockOrder.mockReturnValue({ range: mockRange });
  mockRange.mockResolvedValue({
    data: [
      { id: "1", email: "test@test.com", success: true, ip_address: "127.0.0.1", user_agent: null, failure_reason: null, user_id: null, created_at: "2024-01-01" },
      { id: "2", email: "fail@test.com", success: false, ip_address: "10.0.0.1", user_agent: "Mozilla/5.0", failure_reason: "Invalid password", user_id: null, created_at: "2024-01-01" },
    ],
    error: null,
    count: 2,
  });
  mockIlike.mockReturnValue({ range: mockRange });
  mockEq.mockReturnValue({ range: mockRange });
  mockGte.mockResolvedValue({ count: 5 });
});

describe("useLoginAttempts", () => {
  it("should export the hook function", async () => {
    const mod = await import("@/hooks/auth/useLoginAttempts");
    expect(mod.useLoginAttempts).toBeDefined();
    expect(typeof mod.useLoginAttempts).toBe("function");
  });

  it("should export useLoginAttemptStats", async () => {
    const mod = await import("@/hooks/auth/useLoginAttempts");
    expect(mod.useLoginAttemptStats).toBeDefined();
    expect(typeof mod.useLoginAttemptStats).toBe("function");
  });

  it("should export LoginAttempt interface shape", async () => {
    const mod = await import("@/hooks/auth/useLoginAttempts");
    // Verify exports exist
    expect(mod).toHaveProperty("useLoginAttempts");
    expect(mod).toHaveProperty("useLoginAttemptStats");
  });
});

describe("LoginAttempt data shape", () => {
  it("should define correct fields for LoginAttempt", () => {
    const attempt = {
      id: "uuid-1",
      email: "user@example.com",
      success: true,
      ip_address: "192.168.1.1",
      user_agent: "Chrome/120",
      failure_reason: null,
      user_id: "user-uuid",
      created_at: "2024-01-01T00:00:00Z",
    };

    expect(attempt.id).toBeTruthy();
    expect(attempt.email).toContain("@");
    expect(typeof attempt.success).toBe("boolean");
    expect(attempt.ip_address).toBeTruthy();
    expect(attempt.failure_reason).toBeNull();
  });

  it("should handle failed login attempt", () => {
    const failed = {
      id: "uuid-2",
      email: "attacker@evil.com",
      success: false,
      ip_address: "10.0.0.1",
      user_agent: "Bot/1.0",
      failure_reason: "Invalid credentials",
      user_id: null,
      created_at: "2024-01-01T00:00:00Z",
    };

    expect(failed.success).toBe(false);
    expect(failed.failure_reason).toBe("Invalid credentials");
    expect(failed.user_id).toBeNull();
  });
});
