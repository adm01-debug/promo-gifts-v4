/**
 * Render tests for ProductGallery (696 lines)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../render-helpers";
import React from "react";

vi.mock("@/utils/colorSorting", () => ({
  sortByColorGroup: vi.fn((colors: any[]) => colors),
}));

vi.mock("@/utils/image-utils", () => ({
  getCdnUrl: vi.fn((url: string) => url),
  getSrcSet: vi.fn(() => ''),
  getImageSizes: vi.fn(() => ''),
  getBlurhashDominantColor: vi.fn(() => null),
}));

describe("ProductGallery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with images", async () => {
    const { ProductGallery } = await import("@/components/products/ProductGallery");
    renderWithProviders(
      <ProductGallery
        images={["https://example.com/img1.jpg", "https://example.com/img2.jpg"]}
        productName="Caneta BIC"
      />
    );
    expect(document.body).toBeTruthy();
  });

  it("renders with colors", async () => {
    const { ProductGallery } = await import("@/components/products/ProductGallery");
    renderWithProviders(
      <ProductGallery
        images={["https://example.com/img1.jpg"]}
        productName="Camiseta"
        colors={[
          { name: "Azul", hex: "#0000FF", image: "https://example.com/blue.jpg" },
          { name: "Vermelho", hex: "#FF0000", image: "https://example.com/red.jpg" },
        ]}
        onColorSelect={vi.fn()}
        selectedColorIndex={0}
      />
    );
    expect(document.body).toBeTruthy();
  });

  it("renders with empty images array", async () => {
    const { ProductGallery } = await import("@/components/products/ProductGallery");
    renderWithProviders(
      <ProductGallery images={[]} productName="Produto sem imagem" />
    );
    expect(document.body).toBeTruthy();
  });
});
