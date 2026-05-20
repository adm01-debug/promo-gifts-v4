import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../components/render-helpers";
import React from "react";

vi.mock("@/hooks/products/useVideoVariantLinks", () => ({
  useVideoVariantLinks: () => ({
    data: [
      {
        id: "link-1",
        product_id: "PROD-001",
        variant_id: "VAR-001",
        variant_name: "Azul Royal",
        variant_color_hex: "#0000FF",
        video_id: "https://youtube.com/watch?v=abc123",
        supplier_code: "SUP-01",
        created_at: "2024-06-15T10:00:00Z",
      },
    ],
    isLoading: false,
    createLink: { mutate: vi.fn(), isPending: false },
    deleteLink: { mutate: vi.fn() },
  }),
}));

describe("AdminVideoVariantsPage", () => {
  it("renders the page title", async () => {
    const { default: Page } = await import("@/pages/admin/AdminVideoVariantsPage");
    renderWithProviders(<Page />);
    expect(screen.getByText("Vídeos por Variante")).toBeInTheDocument();
  }, 15000);

  it("renders Novo Vínculo button", async () => {
    const { default: Page } = await import("@/pages/admin/AdminVideoVariantsPage");
    renderWithProviders(<Page />);
    expect(screen.getByText("Novo Vínculo")).toBeInTheDocument();
  });

  it("renders video link data", async () => {
    const { default: Page } = await import("@/pages/admin/AdminVideoVariantsPage");
    renderWithProviders(<Page />);
    expect(screen.getByText("PROD-001")).toBeInTheDocument();
    expect(screen.getByText("Azul Royal")).toBeInTheDocument();
  });
});
