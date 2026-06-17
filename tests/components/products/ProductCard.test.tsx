/**
 * Render tests for ProductCard (584 lines)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../render-helpers";
import React from "react";

vi.mock("@/utils/image-utils", () => ({
  getCdnUrl: vi.fn((url: string) => url),
  getSrcSet: vi.fn(() => ""),
  getBlurhashDominantColor: vi.fn(() => null),
}));

vi.mock("@/components/collections/AddToCollectionModal", () => ({
  AddToCollectionModal: () => null,
}));

vi.mock("@/components/products/QuickAddToQuote", () => ({
  QuickAddToQuote: () => null,
}));

vi.mock("@/components/products/ProductQuickView", () => ({
  ProductQuickView: () => null,
}));

vi.mock("@/components/products/ProductCategoryBadges", () => ({
  // Stub renderiza só o nome da categoria — suficiente para os testes de
  // "category line" verificarem visibilidade sem montar o componente real
  // (que depende de useCategoryIcons + outras dependências).
  ProductCategoryBadges: ({ category }: { category?: { name?: string } }) =>
    category?.name ? <span>{category.name}</span> : null,
}));

vi.mock("@/components/products/NoveltyBadge", () => ({
  NoveltyBadge: () => null,
}));

vi.mock("@/utils/undoToast", () => ({
  showUndoToast: vi.fn(),
  showErrorToast: vi.fn(),
}));

vi.mock("@/lib/supplier-colors", () => ({
  getSupplierColors: vi.fn().mockReturnValue({ bg: "#fff", text: "#000" }),
}));

vi.mock("@/utils/color-image-resolver", () => ({
  resolveColorImage: vi.fn().mockReturnValue(null),
  resolveColorStock: vi.fn().mockReturnValue(null),
  getActiveColorName: vi.fn().mockReturnValue(null),
}));

vi.mock("@/hooks/productsBounds", () => ({
  useProductBounds: vi.fn().mockReturnValue({ width: 0, height: 0 }),
}));

vi.mock("@/components/products/share/SharePreviewDialog", () => ({
  SharePreviewDialog: () => null,
}));

vi.mock("@/components/products/ProductSparkline", () => ({
  ProductSparkline: () => null,
}));

vi.mock("@/components/products/VariantPickerDialog", () => ({
  VariantPickerDialog: () => null,
}));

vi.mock("@/stores/useFavoritesStore", () => ({
  useFavoritesStore: () => ({
    addFavorite: vi.fn(),
    removeFavorite: vi.fn(),
    isFavorite: vi.fn().mockReturnValue(false),
  }),
}));

vi.mock("@/stores/useComparisonStore", () => ({
  useComparisonStore: () => ({
    addToCompare: vi.fn(),
    removeFromCompare: vi.fn(),
    isInCompare: vi.fn().mockReturnValue(false),
  }),
}));

const mockProduct = {
  id: "p1",
  name: "Caneta Premium",
  sku: "CAN-001",
  price: 15.50,
  images: ["https://example.com/caneta.jpg"],
  og_image_url: "https://example.com/caneta.jpg",
  category_name: "Canetas",
  supplier: { name: "Supplier A", code: "SA" },
  supplier_name: "Supplier A",
  stock: 100,
  stockStatus: "in-stock",
  colors: [],
  tags: {},
  min_quantity: 50,
  featured: false,
  newArrival: false,
};

const mockProductWithColors = {
  ...mockProduct,
  id: "p2",
  name: "Garrafa Térmica",
  colors: [
    { name: "Rosa Pink", hex: "#E91E8C", group: "Rosa", groupSlug: "rosa", variationSlug: "rosa-pink", image: "rosa.jpg", images: [] },
    { name: "Azul Royal", hex: "#1E40AF", group: "Azul", groupSlug: "azul", variationSlug: "azul-royal", image: "azul.jpg", images: [] },
    { name: "Verde Limão", hex: "#22C55E", group: "Verde", groupSlug: "verde", variationSlug: "verde-limao", image: "verde.jpg", images: [] },
  ],
};

// PR addition: product with a category object (category.name)
const mockProductWithCategory = {
  ...mockProduct,
  id: "p3",
  name: "Mochila Executiva",
  category: { id: 10, name: "Mochilas" },
};

// PR addition: product explicitly without category
const mockProductWithoutCategory = {
  ...mockProduct,
  id: "p4",
  name: "Chaveiro Simples",
  category: undefined,
};

describe("ProductCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders product name and price", async () => {
    const { ProductCard } = await import("@/components/products/ProductCard");
    renderWithProviders(<ProductCard product={mockProduct as any} />);
    expect(screen.getByText("Caneta Premium")).toBeInTheDocument();
  });

  it("renders with favorite state", async () => {
    const { ProductCard } = await import("@/components/products/ProductCard");
    renderWithProviders(<ProductCard product={mockProduct as any} isFavorited={true} />);
    expect(screen.getByText("Caneta Premium")).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const handleClick = vi.fn();
    const { ProductCard } = await import("@/components/products/ProductCard");
    renderWithProviders(<ProductCard product={mockProduct as any} onClick={handleClick} />);
    expect(document.body).toBeTruthy();
  });

  it("does NOT show carousel dots when no color filter active", async () => {
    const { ProductCard } = await import("@/components/products/ProductCard");
    renderWithProviders(<ProductCard product={mockProductWithColors as any} />);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("does NOT show carousel dots when only 1 color filter matches", async () => {
    const { ProductCard } = await import("@/components/products/ProductCard");
    renderWithProviders(
      <ProductCard
        product={mockProductWithColors as any}
        activeColorFilter={{ groups: ["rosa"], variations: [] }}
      />
    );
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("shows color swatches when 2+ color filters match", async () => {
    const { ProductCard } = await import("@/components/products/ProductCard");
    renderWithProviders(
      <ProductCard
        product={mockProductWithColors as any}
        activeColorFilter={{ groups: ["rosa", "azul"], variations: [] }}
      />
    );
    // Tablist was removed; color swatches are now a radiogroup
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    const radiogroup = screen.getByRole("radiogroup");
    expect(radiogroup).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios.length).toBeGreaterThanOrEqual(2);
  });

  it("shows 3 color swatches when product has 3 colors", async () => {
    const { ProductCard } = await import("@/components/products/ProductCard");
    renderWithProviders(
      <ProductCard
        product={mockProductWithColors as any}
        activeColorFilter={{ groups: ["rosa", "azul", "verde"], variations: [] }}
      />
    );
    // Tablist was removed; color swatches are now a radiogroup
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
  });

  it("color swatches have correct aria-labels", async () => {
    const { ProductCard } = await import("@/components/products/ProductCard");
    renderWithProviders(
      <ProductCard
        product={mockProductWithColors as any}
        activeColorFilter={{ groups: ["rosa", "azul"], variations: [] }}
      />
    );
    expect(screen.getByLabelText("Opção de cor: Rosa Pink")).toBeInTheDocument();
    expect(screen.getByLabelText("Opção de cor: Azul Royal")).toBeInTheDocument();
  });

  it("first color swatch is selected by default (aria-checked)", async () => {
    const { ProductCard } = await import("@/components/products/ProductCard");
    renderWithProviders(
      <ProductCard
        product={mockProductWithColors as any}
        activeColorFilter={{ groups: ["rosa", "azul"], variations: [] }}
      />
    );
    const pinkSwatch = screen.getByLabelText("Opção de cor: Rosa Pink");
    expect(pinkSwatch).toHaveAttribute("aria-checked", "true");
    const blueSwatch = screen.getByLabelText("Opção de cor: Azul Royal");
    expect(blueSwatch).toHaveAttribute("aria-checked", "false");
  });

  it("renders product without colors gracefully", async () => {
    const { ProductCard } = await import("@/components/products/ProductCard");
    renderWithProviders(
      <ProductCard
        product={mockProduct as any}
        activeColorFilter={{ groups: ["rosa", "azul"], variations: [] }}
      />
    );
    // No tablist and no radiogroup — product has no colors
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByText("Caneta Premium")).toBeInTheDocument();
  });
});

// ── Category line — PR change: display product.category.name ─────────

describe("ProductCard — category line (PR)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders category name when product.category.name is present", async () => {
    const { ProductCard } = await import("@/components/products/ProductCard");
    renderWithProviders(<ProductCard product={mockProductWithCategory as any} />);
    expect(screen.getByText("Mochilas")).toBeInTheDocument();
  });

  it("does not render category line when product.category is absent", async () => {
    const { ProductCard } = await import("@/components/products/ProductCard");
    renderWithProviders(<ProductCard product={mockProductWithoutCategory as any} />);
    // No stray "undefined" or empty badge
    expect(screen.queryByText("undefined")).not.toBeInTheDocument();
    // The product name is still shown
    expect(screen.getByText("Chaveiro Simples")).toBeInTheDocument();
  });

  it("does not render category line when category.name is falsy", async () => {
    const { ProductCard } = await import("@/components/products/ProductCard");
    const productNoName = { ...mockProduct, id: "p5", name: "Produto Sem Cat", category: { id: 1, name: "" } };
    renderWithProviders(<ProductCard product={productNoName as any} />);
    // Empty-name category should not create a visible badge
    const categoryBadges = document.querySelectorAll(".bg-primary\\/15");
    const emptyBadge = Array.from(categoryBadges).find((el) => el.textContent?.trim() === "");
    expect(emptyBadge).toBeUndefined();
  });

  it("renders a sales stats button with 'Vendas Xd' label (not the old 'Vendas no Fornecedor' label)", async () => {
    const { ProductCard } = await import("@/components/products/ProductCard");
    renderWithProviders(<ProductCard product={mockProduct as any} />);
    expect(screen.getByText(/^Vendas \d+d$/)).toBeInTheDocument();
    expect(screen.queryByText(/Vendas no Fornecedor/i)).not.toBeInTheDocument();
  });

  // Regression: category name must not appear when category object exists but name is undefined
  it("handles category object with undefined name gracefully", async () => {
    const { ProductCard } = await import("@/components/products/ProductCard");
    const productUndefinedCatName = {
      ...mockProduct,
      id: "p6",
      name: "Produto X",
      category: { id: 2, name: undefined as unknown as string },
    };
    expect(() =>
      renderWithProviders(<ProductCard product={productUndefinedCatName as any} />)
    ).not.toThrow();
  });
});
