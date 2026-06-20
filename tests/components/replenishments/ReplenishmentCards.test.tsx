/**
 * Tests for ReplenishmentGridCard — covers the PR text label change:
 *   "Vendas no Fornecedor 30d" → "Saídas 90d"
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../render-helpers";
import React from "react";

// ── Mocks for heavy child components ────────────────────────────

vi.mock("@/components/products/ProductSparkline", () => ({
  ProductSparkline: () => <div data-testid="sparkline-stub" />,
}));

vi.mock("@/components/products/ReplenishmentBadge", () => ({
  ReplenishmentBadge: () => null,
}));

vi.mock("@/components/common/SelectionCheckbox", () => ({
  SelectionCheckbox: () => null,
}));

vi.mock("@/components/inventory/StockBadge", () => ({
  StockBadge: ({ status }: { status: string }) => (
    <span data-testid="stock-badge">
      {status === "in-stock"
        ? "Em estoque"
        : status === "low-stock"
          ? "Estoque baixo"
          : "Sem estoque"}
    </span>
  ),
  getStockStatus: () => "in-stock",
}));

// ── Test fixtures ────────────────────────────────────────────────

const baseProduct = {
  product_id: "rp-1",
  id: "rp-1",
  name: "Garrafa de Alumínio",
  product_name: "Garrafa de Alumínio",
  price: 29.9,
  stock_quantity: 500,
  stock_status: "in-stock" as const,
  replenished_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  category_id: "cat-garrafas",
  category_name: "Garrafas",
  supplier_name: "FornecedorY",
  images: [],
  og_image_url: null,
};

const baseCardProps = {
  product: baseProduct as any,
  onClick: vi.fn(),
  selectionMode: false,
  isSelected: false,
  onToggleSelect: vi.fn(),
};

describe("ReplenishmentGridCard — label changes (PR)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 'Saídas 90d' label (updated text)", async () => {
    const { ReplenishmentGridCard } = await import("@/components/replenishments/ReplenishmentCards");
    renderWithProviders(<ReplenishmentGridCard {...baseCardProps} />);
    expect(screen.getByText("Saídas 90d")).toBeInTheDocument();
  });

  it("does NOT render the old 'Vendas no Fornecedor 30d' label", async () => {
    const { ReplenishmentGridCard } = await import("@/components/replenishments/ReplenishmentCards");
    renderWithProviders(<ReplenishmentGridCard {...baseCardProps} />);
    expect(screen.queryByText(/Vendas no Fornecedor 30d/i)).not.toBeInTheDocument();
  });

  it("renders the ProductSparkline for the product", async () => {
    const { ReplenishmentGridCard } = await import("@/components/replenishments/ReplenishmentCards");
    renderWithProviders(<ReplenishmentGridCard {...baseCardProps} />);
    expect(screen.getByTestId("sparkline-stub")).toBeInTheDocument();
  });

  it("renders product name", async () => {
    const { ReplenishmentGridCard } = await import("@/components/replenishments/ReplenishmentCards");
    renderWithProviders(<ReplenishmentGridCard {...baseCardProps} />);
    expect(screen.getByText("Garrafa de Alumínio")).toBeInTheDocument();
  });

  it("renders category name when present", async () => {
    const { ReplenishmentGridCard } = await import("@/components/replenishments/ReplenishmentCards");
    renderWithProviders(<ReplenishmentGridCard {...baseCardProps} />);
    expect(screen.getByText("Garrafas")).toBeInTheDocument();
  });

  it("does not render category badge when category_name is absent", async () => {
    const { ReplenishmentGridCard } = await import("@/components/replenishments/ReplenishmentCards");
    const productNoCat = { ...baseProduct, category_name: undefined };
    renderWithProviders(
      <ReplenishmentGridCard {...baseCardProps} product={productNoCat as any} />
    );
    expect(screen.queryByText("Garrafas")).not.toBeInTheDocument();
  });

  it("renders 'Em estoque' stock label for in-stock status", async () => {
    const { ReplenishmentGridCard } = await import("@/components/replenishments/ReplenishmentCards");
    renderWithProviders(<ReplenishmentGridCard {...baseCardProps} />);
    expect(screen.getByText("Em estoque")).toBeInTheDocument();
  });

  it("renders 'Estoque baixo' for low-stock status", async () => {
    const { ReplenishmentGridCard } = await import("@/components/replenishments/ReplenishmentCards");
    const lowStockProduct = { ...baseProduct, stock_status: "low-stock" as const };
    renderWithProviders(
      <ReplenishmentGridCard {...baseCardProps} product={lowStockProduct as any} />
    );
    expect(screen.getByText("Estoque baixo")).toBeInTheDocument();
  });

  // Regression: label stays at "Saídas 90d" regardless of stock status
  it("always shows 'Saídas 90d' for out-of-stock products too", async () => {
    const { ReplenishmentGridCard } = await import("@/components/replenishments/ReplenishmentCards");
    const oos = { ...baseProduct, stock_status: "out-of-stock" as const };
    renderWithProviders(
      <ReplenishmentGridCard {...baseCardProps} product={oos as any} />
    );
    expect(screen.getByText("Saídas 90d")).toBeInTheDocument();
  });
});