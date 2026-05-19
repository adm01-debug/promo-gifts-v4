/**
 * Tests for AdvancedPriceSearchPage (913 lines)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../render-helpers";
import React from "react";

vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="main-layout">{children}</div>,
}));

vi.mock("@/hooks/productss", () => ({
  useProducts: vi.fn().mockReturnValue({
    products: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/hooks/useTecnicasUnificadas", () => ({
  useCustomizationPricing: vi.fn().mockReturnValue({
    data: null,
    loading: false,
  }),
}));

vi.mock("@/lib/external-db", () => ({
  fetchPromobrindProducts: vi.fn().mockResolvedValue([]),
}));

describe("AdvancedPriceSearchPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", async () => {
    const { default: AdvancedPriceSearchPage } = await import("@/pages/AdvancedPriceSearchPage");
    renderWithProviders(<AdvancedPriceSearchPage />);
    expect(screen.getByTestId("main-layout")).toBeInTheDocument();
  });
});
