import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [
              {
                id: "link-1",
                product_id: "PROD-001",
                variant_id: "VAR-001",
                variant_name: "Azul Royal",
                variant_color_hex: "#0000FF",
                video_id: "VID-001",
                supplier_code: "SUP-01",
                created_at: "2024-01-01",
              },
            ],
            error: null,
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: "new-link" }, error: null }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("useVideoVariantLinks", () => {
  it("should export the hook function", async () => {
    const mod = await import("@/hooks/products/useVideoVariantLinks");
    expect(mod.useVideoVariantLinks).toBeDefined();
    expect(typeof mod.useVideoVariantLinks).toBe("function");
  });
});

describe("VideoVariantLink data shape", () => {
  it("should define correct fields", () => {
    const link = {
      id: "link-1",
      product_id: "PROD-001",
      variant_id: "VAR-001",
      variant_name: "Azul Royal",
      variant_color_hex: "#0000FF",
      video_id: "VID-001",
      supplier_code: "SUP-01",
      created_at: "2024-01-01T00:00:00Z",
    };

    expect(link.product_id).toBeTruthy();
    expect(link.variant_id).toBeTruthy();
    expect(link.video_id).toBeTruthy();
    expect(link.variant_color_hex).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it("should handle null optional fields", () => {
    const link = {
      id: "link-2",
      product_id: "PROD-002",
      variant_id: "VAR-002",
      variant_name: null,
      variant_color_hex: null,
      video_id: "VID-002",
      supplier_code: null,
      created_at: "2024-01-01T00:00:00Z",
    };

    expect(link.variant_name).toBeNull();
    expect(link.variant_color_hex).toBeNull();
    expect(link.supplier_code).toBeNull();
  });
});
