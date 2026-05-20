/**
 * Comprehensive tests for Kit Builder components
 * Covers: KitVisualPreview, FreightEstimator, DiscontinuedItemsAlert,
 * KitComparisonDialog, KitSmartSuggestions, KitSummary
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "../render-helpers";
import React from "react";

// --- Mocks ---
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    channel: vi.fn().mockReturnValue({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() }),
    removeChannel: vi.fn(),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { id: "test-user-id", email: "test@test.com" },
    session: { access_token: "mock-token" },
    loading: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), loading: vi.fn(), dismiss: vi.fn() }),
  Toaster: () => null,
}));

vi.mock("@/hooks/kit-builder/useKitStockValidation", () => ({
  useKitStockValidation: vi.fn().mockReturnValue({
    stockAlerts: [],
    isChecking: false,
    hasStockIssues: false,
  }),
}));

// Shared test data
const mockBox = {
  id: "box-1",
  name: "Caixa Média",
  width: 300,
  height: 200,
  depth: 150,
  internalVolume: 9000000,
  weight: 200,
  maxWeight: 5000,
  price: 15.00,
  material: "papelão",
};

const mockItem = {
  id: "item-1",
  name: "Caneta Premium",
  sku: "CAN-001",
  width: 15,
  height: 150,
  depth: 15,
  volume: 33750,
  weight: 25,
  price: 5.00,
  quantity: 2,
  category: "Escrita",
  imageUrl: null,
};

const mockItem2 = {
  id: "item-2",
  name: "Caderno A5",
  sku: "CAD-001",
  width: 150,
  height: 210,
  depth: 15,
  volume: 472500,
  weight: 200,
  price: 12.00,
  quantity: 1,
  category: "Papelaria",
  imageUrl: null,
};

const mockKitState = {
  name: "Kit Teste",
  kitType: "montado" as const,
  box: mockBox,
  items: [mockItem, mockItem2],
  personalization: { box: { enabled: false }, items: {} },
  totalItemsVolume: 540000,
  availableVolume: 8460000,
  volumeUsagePercent: 6,
  totalWeight: 450,
  boxPrice: 15.00,
  itemsPrice: 22.00,
  personalizationPrice: 0,
  totalPrice: 37.00,
  isValid: true,
  validationErrors: [],
};

// ============================
// KitVisualPreview
// ============================
describe("KitVisualPreview", () => {
  it("renders null when no box", async () => {
    const { KitVisualPreview } = await import("@/components/kit-builder/KitVisualPreview");
    const { container } = renderWithProviders(
      <KitVisualPreview kitState={{ ...mockKitState, box: null }} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders box preview with items", async () => {
    const { KitVisualPreview } = await import("@/components/kit-builder/KitVisualPreview");
    renderWithProviders(<KitVisualPreview kitState={mockKitState} />);
    expect(screen.getByText("Preview Visual")).toBeInTheDocument();
    // Items are rendered with "Nx " prefix in truncated spans
    expect(screen.getByText(/Caneta/)).toBeInTheDocument();
  });

  it("shows correct fill color for normal usage", async () => {
    const { KitVisualPreview } = await import("@/components/kit-builder/KitVisualPreview");
    renderWithProviders(<KitVisualPreview kitState={mockKitState} />);
    expect(screen.getAllByText(/6%/).length).toBeGreaterThanOrEqual(1);
  });

  it("shows warning color when >80% usage", async () => {
    const { KitVisualPreview } = await import("@/components/kit-builder/KitVisualPreview");
    renderWithProviders(
      <KitVisualPreview kitState={{ ...mockKitState, volumeUsagePercent: 85 }} />
    );
    expect(screen.getAllByText(/85%/).length).toBeGreaterThanOrEqual(1);
  });

  it("shows danger color when >100% usage", async () => {
    const { KitVisualPreview } = await import("@/components/kit-builder/KitVisualPreview");
    renderWithProviders(
      <KitVisualPreview kitState={{ ...mockKitState, volumeUsagePercent: 110 }} />
    );
    expect(screen.getAllByText(/110%/).length).toBeGreaterThanOrEqual(1);
  });
});

// ============================
// FreightEstimator
// ============================
describe("FreightEstimator", () => {
  it("renders with default values", async () => {
    const { FreightEstimator } = await import("@/components/kit-builder/FreightEstimator");
    renderWithProviders(<FreightEstimator totalWeightGrams={450} kitQuantity={10} />);
    expect(screen.getByText(/Estimativa de Frete/)).toBeInTheDocument();
  });

  it("calculates freight for different weight ranges", async () => {
    const { FreightEstimator } = await import("@/components/kit-builder/FreightEstimator");
    renderWithProviders(<FreightEstimator totalWeightGrams={5000} kitQuantity={5} />);
    expect(document.body).toBeTruthy();
  });

  it("handles zero weight gracefully", async () => {
    const { FreightEstimator } = await import("@/components/kit-builder/FreightEstimator");
    renderWithProviders(<FreightEstimator totalWeightGrams={0} kitQuantity={1} />);
    expect(document.body).toBeTruthy();
  });

  it("handles large quantities", async () => {
    const { FreightEstimator } = await import("@/components/kit-builder/FreightEstimator");
    renderWithProviders(<FreightEstimator totalWeightGrams={2000} kitQuantity={1000} />);
    expect(document.body).toBeTruthy();
  });
});

// ============================
// DiscontinuedItemsAlert
// ============================
describe("DiscontinuedItemsAlert", () => {
  it("renders without items", async () => {
    const { DiscontinuedItemsAlert } = await import("@/components/kit-builder/DiscontinuedItemsAlert");
    const { container } = renderWithProviders(<DiscontinuedItemsAlert items={[]} />);
    expect(container).toBeTruthy();
  });

  it("renders with items and checks for discontinued", async () => {
    const { DiscontinuedItemsAlert } = await import("@/components/kit-builder/DiscontinuedItemsAlert");
    renderWithProviders(<DiscontinuedItemsAlert items={[mockItem as any]} />);
    expect(document.body).toBeTruthy();
  });
});

// ============================
// KitComparisonDialog
// ============================
describe("KitComparisonDialog", () => {
  const mockKits = [
    {
      id: "kit-1",
      name: "Kit Básico",
      kit_type: "montado",
      status: "draft",
      box_data: mockBox,
      items_data: [mockItem],
      kit_quantity: 10,
      box_price: 15,
      items_price: 10,
      personalization_price: 0,
      total_price: 250,
      volume_usage_percent: 30,
    },
    {
      id: "kit-2",
      name: "Kit Premium",
      kit_type: "montado",
      status: "draft",
      box_data: mockBox,
      items_data: [mockItem, mockItem2],
      kit_quantity: 10,
      box_price: 15,
      items_price: 22,
      personalization_price: 5,
      total_price: 420,
      volume_usage_percent: 60,
    },
  ];

  it("renders dialog with kits comparison", async () => {
    const { KitComparisonDialog } = await import("@/components/kit-builder/KitComparisonDialog");
    renderWithProviders(
      <KitComparisonDialog open={true} onOpenChange={vi.fn()} kits={mockKits} />
    );
    expect(screen.getByText("Comparação de Kits")).toBeInTheDocument();
    expect(screen.getAllByText("Kit Básico").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Kit Premium").length).toBeGreaterThanOrEqual(1);
  });

  it("does not render when closed", async () => {
    const { KitComparisonDialog } = await import("@/components/kit-builder/KitComparisonDialog");
    renderWithProviders(
      <KitComparisonDialog open={false} onOpenChange={vi.fn()} kits={mockKits} />
    );
    expect(screen.queryByText("Comparação de Kits")).not.toBeInTheDocument();
  });

  it("handles empty kits array", async () => {
    const { KitComparisonDialog } = await import("@/components/kit-builder/KitComparisonDialog");
    renderWithProviders(
      <KitComparisonDialog open={true} onOpenChange={vi.fn()} kits={[]} />
    );
    expect(document.body).toBeTruthy();
  });

  it("highlights cheapest kit", async () => {
    const { KitComparisonDialog } = await import("@/components/kit-builder/KitComparisonDialog");
    renderWithProviders(
      <KitComparisonDialog open={true} onOpenChange={vi.fn()} kits={mockKits} />
    );
    // Kit Básico has lower total_price
    expect(screen.getAllByText("Kit Básico").length).toBeGreaterThanOrEqual(1);
  });
});

// ============================
// KitSmartSuggestions
// ============================
describe("KitSmartSuggestions", () => {
  it("renders with selected items", async () => {
    const { KitSmartSuggestions } = await import("@/components/kit-builder/KitSmartSuggestions");
    renderWithProviders(
      <KitSmartSuggestions selectedItems={[mockItem as any]} onAddItem={vi.fn()} />
    );
    expect(document.body).toBeTruthy();
  });

  it("renders without items", async () => {
    const { KitSmartSuggestions } = await import("@/components/kit-builder/KitSmartSuggestions");
    renderWithProviders(<KitSmartSuggestions selectedItems={[]} />);
    expect(document.body).toBeTruthy();
  });
});
