/**
 * Tests for ProductSparkline — covers the PR text label changes:
 *
 * Changed labels:
 *   - Tooltip day header: "Vendas no fornecedor · Dia N" → "Mercado · Dia N"
 *   - Tooltip metric label: "Vendas no fornecedor 30d" → "Saídas 30d"
 *
 * Removed section:
 *   - Source legend div with "Proxy: unidades depletadas no estoque do fornecedor..."
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "../render-helpers";
import React from "react";

// ── Mock useSparklineData with real data so the component renders ──

const mockSparklineData = {
  totalQty: 150,
  totalReplenished: 20,
  availableStock: 300,
  dailyQty: [5, 3, 8, 10, 4, 7, 9, 6, 3, 12, 5, 8, 4, 6, 11, 9, 3, 7, 5, 10, 8, 6, 4, 9, 11, 5, 7, 3, 8, 6],
};

vi.mock("@/hooks/intelligence", () => ({
  useSparklineData: vi.fn(() => mockSparklineData),
}));

describe("ProductSparkline — PR label changes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the sparkline SVG when real data is available", async () => {
    const { ProductSparkline } = await import("@/components/products/ProductSparkline");
    renderWithProviders(<ProductSparkline productId="test-product" />);

    // SVG should be in the document
    const svg = document.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("does NOT show old 'Vendas no fornecedor' tooltip text (renamed label)", async () => {
    const { ProductSparkline } = await import("@/components/products/ProductSparkline");
    renderWithProviders(<ProductSparkline productId="test-product" />);

    // Hover over the sparkline container to reveal the tooltip
    const container = document.querySelector(".group\\/spark");
    if (container) {
      fireEvent.mouseEnter(container);
      fireEvent.mouseMove(container, { clientX: 50, clientY: 10 });
    }

    // Old label must not appear anywhere in the DOM
    expect(screen.queryByText(/Vendas no fornecedor 30d/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Vendas no fornecedor · Dia/i)).not.toBeInTheDocument();
  });

  it("shows 'Saídas 30d' in tooltip metrics grid (new label)", async () => {
    const { ProductSparkline } = await import("@/components/products/ProductSparkline");
    renderWithProviders(<ProductSparkline productId="test-product" />);

    // Hover to trigger tooltip
    const container = document.querySelector(".group\\/spark");
    if (container) {
      fireEvent.mouseEnter(container);
      fireEvent.mouseMove(container, { clientX: 50, clientY: 10 });
    }

    // New label should be visible
    expect(screen.getByText("Saídas 30d")).toBeInTheDocument();
  });

  it("shows 'Mercado · Dia N' header in tooltip (new label)", async () => {
    const { ProductSparkline } = await import("@/components/products/ProductSparkline");
    renderWithProviders(<ProductSparkline productId="test-product" />);

    const container = document.querySelector(".group\\/spark");
    if (container) {
      fireEvent.mouseEnter(container);
      fireEvent.mouseMove(container, { clientX: 50, clientY: 10 });
    }

    // The tooltip header should contain "Mercado · Dia"
    const mercadoText = screen.queryByText(/Mercado · Dia \d+/i);
    expect(mercadoText).toBeInTheDocument();
  });

  it("does NOT contain the removed source legend proxy disclaimer", async () => {
    const { ProductSparkline } = await import("@/components/products/ProductSparkline");
    renderWithProviders(<ProductSparkline productId="test-product" />);

    // This text was in the removed source-legend div
    expect(
      screen.queryByText(/Proxy: unidades depletadas no estoque do fornecedor/i)
    ).not.toBeInTheDocument();

    // Also check partial strings that formed the disclaimer
    expect(screen.queryByText(/não representa vendas da Promo Brindes/i)).not.toBeInTheDocument();
  });

  it("hides tooltip content when mouse leaves", async () => {
    const { ProductSparkline } = await import("@/components/products/ProductSparkline");
    renderWithProviders(<ProductSparkline productId="test-product" />);

    const container = document.querySelector(".group\\/spark");
    if (container) {
      // Show tooltip
      fireEvent.mouseEnter(container);
      fireEvent.mouseMove(container, { clientX: 50, clientY: 10 });

      // Then hide
      fireEvent.mouseLeave(container);
    }

    // After mouse leaves, tooltip data should not be visible
    expect(screen.queryByText("Saídas 30d")).not.toBeInTheDocument();
  });

  it("returns null when product has no real data (no render)", async () => {
    const { useSparklineData } = await import("@/hooks/intelligence");
    vi.mocked(useSparklineData).mockReturnValueOnce(null);

    const { ProductSparkline } = await import("@/components/products/ProductSparkline");
    const { container } = renderWithProviders(<ProductSparkline productId="empty-product" />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when totalQty is 0 (all-zero data treated as no data)", async () => {
    const { useSparklineData } = await import("@/hooks/intelligence");
    vi.mocked(useSparklineData).mockReturnValueOnce({
      totalQty: 0,
      totalReplenished: 0,
      availableStock: 0,
      dailyQty: new Array(30).fill(0),
    });

    const { ProductSparkline } = await import("@/components/products/ProductSparkline");
    const { container } = renderWithProviders(<ProductSparkline productId="zero-product" />);
    expect(container.firstChild).toBeNull();
  });
});