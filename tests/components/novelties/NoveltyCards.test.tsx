/**
 * Tests for NoveltyGridCard — covers rendering of product info fields.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "../render-helpers";
import React from "react";

// ── Mocks for heavy child components ────────────────────────────

vi.mock("@/components/products/NoveltyBadge", () => ({
  NoveltyBadge: () => null,
}));

vi.mock("@/components/products/ProductStatusBadge", () => ({
  ProductStatusBadge: () => null,
}));

// ── Test fixtures ────────────────────────────────────────────────

const baseProduct = {
  product_id: "np-1",
  id: "np-1",
  product_name: "Copo Personalizado",
  name: "Copo Personalizado",
  product_image: null,
  product_sku: "COP-001",
  base_price: 12.99,
  price: 12.99,
  stock_quantity: 80,
  stock_status: "in-stock" as const,
  detected_at: new Date(Date.now() - 10 * 86400000).toISOString(),
  category_name: "Copos",
  supplier_name: "FornecedorX",
  days_remaining: 0,
  images: [],
  og_image_url: null,
};

const baseCardProps = {
  product: baseProduct as any,
  selectionMode: false,
  isSelected: false,
  onSelect: vi.fn(),
};

describe("NoveltyGridCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders product name", async () => {
    const { NoveltyGridCard } = await import("@/components/novelties/NoveltyCards");
    renderWithProviders(<NoveltyGridCard {...baseCardProps} />);
    expect(screen.getByText("Copo Personalizado")).toBeInTheDocument();
  });

  it("renders SKU when present", async () => {
    const { NoveltyGridCard } = await import("@/components/novelties/NoveltyCards");
    renderWithProviders(<NoveltyGridCard {...baseCardProps} />);
    expect(screen.getByText("COP-001")).toBeInTheDocument();
  });

  it("renders price in BRL format", async () => {
    const { NoveltyGridCard } = await import("@/components/novelties/NoveltyCards");
    renderWithProviders(<NoveltyGridCard {...baseCardProps} />);
    // pt-BR Intl.NumberFormat uses narrow no-break space (U+202F) between
    // currency symbol and number — use regex to match any whitespace variant
    expect(screen.getByText(/R\$.*12,99/)).toBeInTheDocument();
  });

  it("hides SKU element when product_sku is null", async () => {
    const { NoveltyGridCard } = await import("@/components/novelties/NoveltyCards");
    const productNoSku = { ...baseProduct, product_sku: null };
    renderWithProviders(<NoveltyGridCard {...baseCardProps} product={productNoSku as any} />);
    expect(document.querySelector('[aria-label^="Código do produto"]')).not.toBeInTheDocument();
  });

  it("calls onSelect with product_id when clicked", async () => {
    const onSelect = vi.fn();
    const { NoveltyGridCard } = await import("@/components/novelties/NoveltyCards");
    renderWithProviders(<NoveltyGridCard {...baseCardProps} onSelect={onSelect} />);
    const article = document.querySelector('[data-testid="novelty-grid-card"]')!;
    fireEvent.click(article);
    expect(onSelect).toHaveBeenCalledWith("np-1");
  });

  it("does not render old 'Vendas no Fornecedor' label", async () => {
    const { NoveltyGridCard } = await import("@/components/novelties/NoveltyCards");
    renderWithProviders(<NoveltyGridCard {...baseCardProps} />);
    expect(screen.queryByText(/Vendas no Fornecedor/i)).not.toBeInTheDocument();
  });

  it("shows selection indicator when isSelected=true and selectionMode=true", async () => {
    const { NoveltyGridCard } = await import("@/components/novelties/NoveltyCards");
    renderWithProviders(
      <NoveltyGridCard {...baseCardProps} selectionMode={true} isSelected={true} />
    );
    // Selection checkmark SVG path should be present
    const checkPath = document.querySelector("path[d='M2 6L5 9L10 3']");
    expect(checkPath).toBeInTheDocument();
  });

  it("has aria-label containing product name for screen readers", async () => {
    const { NoveltyGridCard } = await import("@/components/novelties/NoveltyCards");
    renderWithProviders(<NoveltyGridCard {...baseCardProps} />);
    const article = document.querySelector('[data-testid="novelty-grid-card"]')!;
    expect(article.getAttribute("aria-label")).toContain("Copo Personalizado");
  });

  it("calls onSelect via Enter keydown for keyboard navigation", async () => {
    const onSelect = vi.fn();
    const { NoveltyGridCard } = await import("@/components/novelties/NoveltyCards");
    renderWithProviders(<NoveltyGridCard {...baseCardProps} onSelect={onSelect} />);
    const article = document.querySelector('[data-testid="novelty-grid-card"]')!;
    fireEvent.keyDown(article, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("np-1");
  });

  it("calls onSelect via Space keydown for keyboard navigation", async () => {
    const onSelect = vi.fn();
    const { NoveltyGridCard } = await import("@/components/novelties/NoveltyCards");
    renderWithProviders(<NoveltyGridCard {...baseCardProps} onSelect={onSelect} />);
    const article = document.querySelector('[data-testid="novelty-grid-card"]')!;
    fireEvent.keyDown(article, { key: " " });
    expect(onSelect).toHaveBeenCalledWith("np-1");
  });
});
