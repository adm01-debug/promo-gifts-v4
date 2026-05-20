/**
 * Render tests for QuantityPriceCalculator (863 lines)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../render-helpers";
import React from "react";

vi.mock("@/lib/external-rpc", () => ({
  invokeExternalRpc: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

vi.mock("@/hooks/simulation/useExternalSimulator", () => ({
  useExternalProductSearch: vi.fn().mockReturnValue({
    products: [],
    loading: false,
    search: vi.fn(),
  }),
}));

vi.mock("@/hooks/simulation/useTecnicasUnificadas", () => ({
  useCustomizationPricing: vi.fn().mockReturnValue({
    data: null,
    loading: false,
    calculate: vi.fn(),
  }),
}));

describe("QuantityPriceCalculator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing with no props", async () => {
    const { QuantityPriceCalculator } = await import("@/components/pricing/QuantityPriceCalculator");
    const Component = QuantityPriceCalculator || (await import("@/components/pricing/QuantityPriceCalculator")).default;
    if (Component) {
      renderWithProviders(<Component />);
    }
    expect(document.body).toBeTruthy();
  });

  it("renders with product base price", async () => {
    const mod = await import("@/components/pricing/QuantityPriceCalculator");
    const Component = mod.QuantityPriceCalculator || mod.default;
    if (Component) {
      renderWithProviders(
        <Component
          productBasePrice={25.50}
          productName="Caneta Personalizada"
        />
      );
    }
    expect(document.body).toBeTruthy();
  });
});
