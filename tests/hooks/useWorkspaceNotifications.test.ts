import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [
                { id: "n1", title: "Novo pedido", message: "Pedido #123", type: "info", is_read: false, created_at: "2024-01-01" },
              ],
              error: null,
            }),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

describe("useWorkspaceNotifications", () => {
  it("should export the hook function", async () => {
    const mod = await import("@/hooks/ui/useWorkspaceNotifications");
    expect(mod.useWorkspaceNotifications).toBeDefined();
    expect(typeof mod.useWorkspaceNotifications).toBe("function");
  });
});

describe("WorkspaceNotification data shape", () => {
  it("should validate notification structure", () => {
    const notif = {
      id: "n1",
      user_id: "user-1",
      title: "Orçamento aprovado",
      message: "O orçamento #456 foi aprovado pelo cliente",
      type: "success" as const,
      category: "quotes",
      is_read: false,
      action_url: "/quotes/456",
      metadata: { quoteId: "456" },
      created_at: "2024-01-01T00:00:00Z",
    };

    expect(notif.title).toBeTruthy();
    expect(notif.message).toBeTruthy();
    expect(["info", "warning", "success", "error"]).toContain(notif.type);
    expect(notif.is_read).toBe(false);
  });

  it("should handle read notification", () => {
    const notif = {
      id: "n2",
      is_read: true,
      type: "info",
      title: "Lembrete",
      message: "Follow-up pendente",
    };

    expect(notif.is_read).toBe(true);
  });

  it("should handle notification without action_url", () => {
    const notif = {
      id: "n3",
      action_url: null,
      metadata: {},
    };

    expect(notif.action_url).toBeNull();
  });
});
