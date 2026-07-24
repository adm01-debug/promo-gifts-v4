import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "m1",
                  product_name: "Caneca Personalizada",
                  product_sku: "CAN-001",
                  client_name: "João Silva",
                  technique_name: "Serigrafia",
                  location_name: "Frontal",
                  colors_count: 3,
                  logo_width_cm: 10,
                  logo_height_cm: 5,
                  mockup_url: "https://example.com/mockup.png",
                  layout_url: null,
                  created_at: "2024-06-15T14:30:00Z",
                },
              ],
              error: null,
              count: 1,
            }),
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={qc}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{ui}</BrowserRouter>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

describe("MockupHistoryPage", () => {
  it("renders the page title", async () => {
    const { default: Page } = await import("@/pages/mockups/MockupHistoryPage");
    renderWithProviders(<Page />);
    expect(screen.getByText("Histórico de Mockups")).toBeInTheDocument();
  }, 15000);

  it("renders page description", async () => {
    const { default: Page } = await import("@/pages/mockups/MockupHistoryPage");
    renderWithProviders(<Page />);
    expect(screen.getByText("Todos os mockups gerados por você")).toBeInTheDocument();
  });

  it("renders search input", async () => {
    const { default: Page } = await import("@/pages/mockups/MockupHistoryPage");
    renderWithProviders(<Page />);
    // The search filters on product_name/product_sku/technique_name only — client_name
    // is not a real column (lives in area_config JSONB), so it is intentionally excluded
    // from the .or() filter to avoid a PostgREST 400 (see BUG-400 fix in the page).
    expect(screen.getByPlaceholderText("Buscar por produto, SKU ou técnica...")).toBeInTheDocument();
  });

  it("renders table headers", async () => {
    const { default: Page } = await import("@/pages/mockups/MockupHistoryPage");
    renderWithProviders(<Page />);
    expect(screen.getByText("Preview")).toBeInTheDocument();
    expect(screen.getByText("Produto")).toBeInTheDocument();
    expect(screen.getByText("Cliente")).toBeInTheDocument();
    expect(screen.getByText("Técnica")).toBeInTheDocument();
    expect(screen.getByText("Posição")).toBeInTheDocument();
    expect(screen.getByText("Dimensões")).toBeInTheDocument();
  });

  it("renders total mockups card", async () => {
    const { default: Page } = await import("@/pages/mockups/MockupHistoryPage");
    renderWithProviders(<Page />);
    expect(screen.getByText("Total de Mockups")).toBeInTheDocument();
  });

  it("renders Mockups Gerados section", async () => {
    const { default: Page } = await import("@/pages/mockups/MockupHistoryPage");
    renderWithProviders(<Page />);
    expect(screen.getByText("Mockups Gerados")).toBeInTheDocument();
  });
});
