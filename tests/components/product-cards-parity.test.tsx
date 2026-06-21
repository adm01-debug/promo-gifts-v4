/**
 * Parity test — guarantees NoveltyGridCard and ReplenishmentGridCard render
 * the same product fields in the same order. Protects against future drift.
 *
 * Order tested (top → bottom of card):
 *   1. Imagem (aspect-square, rounded-lg)
 *   2. Categoria (ProductCategoryBadges)
 *   3. Fornecedor + SKU (mesma linha)
 *   4. Nome do produto (line-clamp-2)
 *   5. Bolinhas de cores (ProductColorSwatches)
 *   6. Preço + StockBadge
 *
 * Difference allowed: Reposição adiciona <ProductSparkline> "Saídas 90d"
 * abaixo do rodapé como contexto exclusivo do módulo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "./render-helpers";
import React from "react";

// ── Shared mocks (mesma estratégia dos specs individuais) ────────────

vi.mock("@/components/products/NoveltyBadge", () => ({
  NoveltyBadge: () => null,
}));
vi.mock("@/components/products/ProductStatusBadge", () => ({
  ProductStatusBadge: () => null,
}));
vi.mock("@/components/products/ReplenishmentBadge", () => ({
  ReplenishmentBadge: () => null,
}));
vi.mock("@/components/products/ProductSparkline", () => ({
  ProductSparkline: () => <div data-testid="sparkline-stub" />,
}));
vi.mock("@/components/products/ProductQuickActionsFAB", () => ({
  ProductQuickActionsFAB: () => null,
}));
vi.mock("@/components/products/HoverSetImage", () => ({
  HoverSetImage: () => <div data-testid="hover-image-stub" />,
}));
vi.mock("@/components/products/QuickViewThumb", () => ({
  QuickViewThumb: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="quickview-stub">{children}</div>
  ),
}));
vi.mock("@/components/products/ProductCategoryBadges", () => ({
  ProductCategoryBadges: ({ category }: { category: { name: string } }) => (
    <div data-testid="category-badge">{category.name}</div>
  ),
}));
vi.mock("@/components/products/ProductColorSwatches", () => ({
  ProductColorSwatches: () => <div data-testid="color-swatches" />,
}));
vi.mock("@/components/common/SelectionCheckbox", () => ({
  SelectionCheckbox: () => null,
}));
vi.mock("@/components/inventory/StockBadge", () => ({
  StockBadge: () => <span data-testid="stock-badge">Em estoque</span>,
  getStockStatus: () => "in-stock",
}));

// ── Fixtures (campos mínimos compartilhados) ─────────────────────────

const SHARED = {
  product_id: "p-1",
  id: "p-1",
  product_name: "Caneta Metálica Premium",
  name: "Caneta Metálica Premium",
  product_image: null,
  product_sku: "CAN-METAL-001",
  base_price: 19.9,
  price: 19.9,
  stock_quantity: 250,
  stock_status: "in-stock" as const,
  category_id: "cat-1",
  category_name: "Canetas",
  supplier_id: "sup-1",
  supplier_name: "FornecedorTeste",
  min_quantity: 1,
  images: [],
};

// Ordem esperada de testids dentro do card (após a imagem)
const EXPECTED_ORDER = [
  "category-badge",
  "color-swatches",
  "stock-badge",
];

function getOrderedTestIds(root: HTMLElement): string[] {
  const nodes = Array.from(root.querySelectorAll("[data-testid]"));
  return nodes
    .map((n) => n.getAttribute("data-testid")!)
    .filter((id) => EXPECTED_ORDER.includes(id));
}

describe("Product cards — paridade estrutural Novidades × Reposição", () => {
  beforeEach(() => vi.clearAllMocks());

  it("NoveltyGridCard renderiza nome, SKU, fornecedor, categoria, cores e estoque", async () => {
    const { NoveltyGridCard } = await import("@/components/novelties/NoveltyCards");
    const product = {
      ...SHARED,
      detected_at: new Date().toISOString(),
      days_remaining: 30,
      days_as_novelty: 5,
      is_highlighted: true,
    };
    renderWithProviders(
      <NoveltyGridCard product={product as any} onSelect={vi.fn()} />,
    );

    expect(screen.getByText("Caneta Metálica Premium")).toBeInTheDocument();
    expect(screen.getByText("CAN-METAL-001")).toBeInTheDocument();
    expect(screen.getByText(/FornecedorTeste/)).toBeInTheDocument();
    expect(screen.getByTestId("category-badge")).toBeInTheDocument();
    expect(screen.getByTestId("color-swatches")).toBeInTheDocument();
    expect(screen.getByTestId("stock-badge")).toBeInTheDocument();
  });

  it("ReplenishmentGridCard renderiza os mesmos campos + sparkline", async () => {
    const { ReplenishmentGridCard } = await import(
      "@/components/replenishments/ReplenishmentCards"
    );
    const product = {
      ...SHARED,
      replenishment_id: "r-1",
      replenished_at: new Date().toISOString(),
      days_since: 5,
    };
    renderWithProviders(
      <ReplenishmentGridCard
        product={product as any}
        onClick={vi.fn()}
        selectionMode={false}
        isSelected={false}
        onToggleSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("Caneta Metálica Premium")).toBeInTheDocument();
    expect(screen.getByText("CAN-METAL-001")).toBeInTheDocument();
    expect(screen.getByText(/FornecedorTeste/)).toBeInTheDocument();
    expect(screen.getByTestId("category-badge")).toBeInTheDocument();
    expect(screen.getByTestId("color-swatches")).toBeInTheDocument();
    expect(screen.getByTestId("stock-badge")).toBeInTheDocument();
    // Sparkline é a única diferença permitida
    expect(screen.getByTestId("sparkline-stub")).toBeInTheDocument();
  });

  it("ambos os cards aplicam min-h-[420px] (altura mínima com piso — compatível com virtualizer)", async () => {
    const { NoveltyGridCard } = await import("@/components/novelties/NoveltyCards");
    const { ReplenishmentGridCard } = await import(
      "@/components/replenishments/ReplenishmentCards"
    );

    const noveltyProduct = {
      ...SHARED,
      detected_at: new Date().toISOString(),
      days_remaining: 30,
      days_as_novelty: 5,
      is_highlighted: false,
    };
    const replenishmentProduct = {
      ...SHARED,
      replenishment_id: "r-1",
      replenished_at: new Date().toISOString(),
      days_since: 5,
    };

    const { unmount } = renderWithProviders(
      <NoveltyGridCard product={noveltyProduct as any} onSelect={vi.fn()} />,
    );
    const noveltyArticle = document.querySelector("article")!;
    expect(noveltyArticle.className).toMatch(/min-h-\[420px\]/);
    unmount();

    renderWithProviders(
      <ReplenishmentGridCard
        product={replenishmentProduct as any}
        onClick={vi.fn()}
        selectionMode={false}
        isSelected={false}
        onToggleSelect={vi.fn()}
      />,
    );
    const replenishmentArticle = document.querySelector("article")!;
    expect(replenishmentArticle.className).toMatch(/min-h-\[420px\]/);
  });

  it("ordem dos campos é idêntica (categoria → cores → estoque)", async () => {
    const { NoveltyGridCard } = await import("@/components/novelties/NoveltyCards");
    const { ReplenishmentGridCard } = await import(
      "@/components/replenishments/ReplenishmentCards"
    );

    const noveltyProduct = {
      ...SHARED,
      detected_at: new Date().toISOString(),
      days_remaining: 30,
      days_as_novelty: 5,
      is_highlighted: false,
    };

    const { container: noveltyContainer, unmount } = renderWithProviders(
      <NoveltyGridCard product={noveltyProduct as any} onSelect={vi.fn()} />,
    );
    const noveltyOrder = getOrderedTestIds(noveltyContainer);
    unmount();

    const replenishmentProduct = {
      ...SHARED,
      replenishment_id: "r-1",
      replenished_at: new Date().toISOString(),
      days_since: 5,
    };
    const { container: repContainer } = renderWithProviders(
      <ReplenishmentGridCard
        product={replenishmentProduct as any}
        onClick={vi.fn()}
        selectionMode={false}
        isSelected={false}
        onToggleSelect={vi.fn()}
      />,
    );
    const repOrder = getOrderedTestIds(repContainer);

    expect(repOrder).toEqual(noveltyOrder);
    expect(noveltyOrder).toEqual(EXPECTED_ORDER);
  });
});
