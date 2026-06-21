/**
 * Bateria adversarial de invariância de ALTURA do card de Reposição (grid).
 *
 * Protege o fix do PR #1271:
 *   1. BaseProductGridCard invoca ProductColorSwatches SEM `wrap` → a linha de
 *      cores fica em UMA única linha de altura fixa (flex-nowrap +
 *      overflow-hidden + h-[var(--swatch-size-sm)]) com chip "+N", para
 *      QUALQUER quantidade de cores. (Regressão: commit 876113a80 reintroduziu
 *      `wrap`, gerando 2–3 linhas e cards de alturas diferentes no grid.)
 *   2. ReplenishmentCards reserva um slot de altura fixa (h-7) para o
 *      ProductSparkline mesmo quando ele retorna null (sem série histórica),
 *      eliminando a variância de ~28px entre cards com/sem dados.
 *   3. O <article> raiz mantém o contrato virtualizer-safe: min-h-[420px],
 *      sem altura fixa, sem max-h e sem overflow-hidden no root.
 *
 * "Centenas de simulações": varremos dezenas de contagens de cores cruzadas
 * com 3 famílias de asserção, garantindo que os invariantes são CONSTANTES
 * (= cards uniformes) independentemente do número de cores.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "./render-helpers";
import React from "react";
import type { ColorDotLike } from "@/components/products/ProductColorSwatches";
import type { ReplenishmentCardProps } from "@/components/replenishments/ReplenishmentCards";

// ProductSparkline → null: simula "sem série histórica", o caso que exige a
// reserva de altura. Se o slot (div.h-7) sumir, o rodapé colapsa e os cards
// divergem em altura.
vi.mock("@/components/products/ProductSparkline", () => ({
  ProductSparkline: () => null,
}));
// Filhos pesados/irrelevantes ao teste: mockados para isolar swatch + slot.
vi.mock("@/components/products/ProductQuickActionsFAB", () => ({
  ProductQuickActionsFAB: () => null,
}));
vi.mock("@/components/products/ReplenishmentBadge", () => ({
  ReplenishmentBadge: () => null,
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
  ProductCategoryBadges: () => null,
}));
vi.mock("@/components/common/SelectionCheckbox", () => ({
  SelectionCheckbox: () => null,
}));
vi.mock("@/components/inventory/StockBadge", () => ({
  StockBadge: () => <span data-testid="stock-badge">Em estoque</span>,
  getStockStatus: () => "in-stock",
}));
// IMPORTANTE: ProductColorSwatches NÃO é mockado — usamos o componente REAL
// para provar que o card o invoca com wrap=false (single-row).

type ProductLike = ReplenishmentCardProps["product"];

const makeColors = (n: number): ColorDotLike[] =>
  Array.from({ length: n }, (_, i) => ({
    name: `Cor ${i + 1}`,
    hex: `#${(((i + 1) * 1234567) & 0xffffff).toString(16).padStart(6, "0")}`,
  }));

const baseProduct = {
  product_id: "rp-sim",
  product_name: "Produto Simulado",
  product_sku: "SIM-001",
  product_image: null,
  product_set_image: null,
  category_id: "cat-1",
  category_name: "Categoria",
  supplier_name: "Fornecedor",
  base_price: 19.9,
  min_quantity: 1,
  stock_status: "in-stock",
  stock_quantity: 100,
  days_since: 5,
} as unknown as ProductLike;

const baseProps = {
  product: baseProduct,
  onClick: vi.fn(),
  selectionMode: false,
  isSelected: false,
  onToggleSelect: vi.fn(),
};

// Espectro amplo de contagens: denso no range baixo (onde o wrap começa a
// quebrar linhas) + extremos altos (truncados pelo max=5).
const COUNTS: readonly number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22,
  24, 26, 28, 30, 35, 40, 45, 50, 60, 75, 100, 128, 150, 200, 256, 300, 500,
  750, 1000,
];

describe("Reposição card — invariância de altura (centenas de simulações)", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(COUNTS)(
    "n=%i cores → linha de swatches single-row de altura fixa (sem wrap)",
    async (n) => {
      const { ReplenishmentGridCard } = await import(
        "@/components/replenishments/ReplenishmentCards"
      );
      const { container, unmount } = renderWithProviders(
        <ReplenishmentGridCard {...baseProps} colors={makeColors(n)} />,
      );
      const row = container.querySelector(
        '[data-testid="product-colors-container"]',
      );
      expect(row, `container de cores ausente para n=${n}`).not.toBeNull();
      const cls = row!.className;
      expect(cls).toContain("flex-nowrap");
      expect(cls).toContain("overflow-hidden");
      expect(cls).toContain("h-[var(--swatch-size-sm)]");
      expect(cls).toContain("max-h-[var(--swatch-size-sm)]");
      expect(cls).not.toContain("flex-wrap");
      unmount();
    },
  );

  it.each(COUNTS)(
    "n=%i cores → chip +N sse n>5 e no máximo 5 swatches visíveis",
    async (n) => {
      const { ReplenishmentGridCard } = await import(
        "@/components/replenishments/ReplenishmentCards"
      );
      const { container, unmount } = renderWithProviders(
        <ReplenishmentGridCard {...baseProps} colors={makeColors(n)} />,
      );
      const overflow = container.querySelector(
        '[data-testid="color-swatches-overflow"]',
      );
      const swatches = container.querySelectorAll(
        '[data-testid="product-colors-container"] [aria-label^="Opção de cor:"]',
      );
      if (n > 5) {
        expect(overflow, `esperava chip +N para n=${n}`).not.toBeNull();
        expect(overflow!.textContent).toBe(`+${n - 5}`);
        expect(swatches.length).toBe(5);
      } else {
        expect(overflow, `não esperava chip +N para n=${n}`).toBeNull();
        expect(swatches.length).toBe(n);
      }
      unmount();
    },
  );

  it.each(COUNTS)(
    "n=%i cores → <article> mantém min-h-[420px] sem max-h/overflow-hidden",
    async (n) => {
      const { ReplenishmentGridCard } = await import(
        "@/components/replenishments/ReplenishmentCards"
      );
      const { container, unmount } = renderWithProviders(
        <ReplenishmentGridCard {...baseProps} colors={makeColors(n)} />,
      );
      const article = container.querySelector("article");
      expect(article).not.toBeNull();
      const cls = article!.className;
      expect(cls).toContain("min-h-[420px]");
      // sem altura travada: nenhuma classe h-[<px>] precedida de início/espaço
      expect(cls).not.toMatch(/(?:^|\s)h-\[\d+px\]/);
      expect(cls).not.toContain("max-h-[");
      expect(cls).not.toContain("overflow-hidden");
      unmount();
    },
  );
});

describe("Reposição card — reserva de altura do sparkline (slot h-7)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reserva o slot h-7 mesmo quando ProductSparkline retorna null", async () => {
    const { ReplenishmentGridCard } = await import(
      "@/components/replenishments/ReplenishmentCards"
    );
    const { getByText, unmount } = renderWithProviders(
      <ReplenishmentGridCard {...baseProps} colors={makeColors(3)} />,
    );
    const label = getByText("Saídas 90d");
    // Estrutura: <div border-t> → [ <div mb-0.5>(label) , <div h-7>(slot) ]
    const footerBlock = label.parentElement!.parentElement!;
    const slot = footerBlock.lastElementChild as HTMLElement;
    expect(slot).not.toBeNull();
    expect(slot.className).toContain("h-7");
    // slot reservado mesmo sem sparkline renderizado (mock → null)
    expect(slot.querySelector("svg")).toBeNull();
    unmount();
  });
});

describe("Reposição card — edge cases de cores", () => {
  beforeEach(() => vi.clearAllMocks());

  it("0 cores → placeholder de altura fixa, sem flex-wrap, card íntegro", async () => {
    const { ReplenishmentGridCard } = await import(
      "@/components/replenishments/ReplenishmentCards"
    );
    const { container, unmount } = renderWithProviders(
      <ReplenishmentGridCard {...baseProps} colors={[]} />,
    );
    // hideWhenEmpty=false (BaseProductGridCard) → placeholder "N/A"
    const empty = container.querySelector('[data-testid="colors-unavailable"]');
    expect(empty).not.toBeNull();
    expect(empty!.className).toContain("min-h-[var(--swatch-size-sm)]");
    expect(empty!.className).not.toContain("flex-wrap");
    expect(container.querySelector("article")!.className).toContain(
      "min-h-[420px]",
    );
    unmount();
  });

  it("colors=undefined → skeleton de carregamento, card íntegro", async () => {
    const { ReplenishmentGridCard } = await import(
      "@/components/replenishments/ReplenishmentCards"
    );
    const { container, unmount } = renderWithProviders(
      <ReplenishmentGridCard {...baseProps} colors={undefined} />,
    );
    const skeleton = container.querySelector(
      '[data-testid="colors-loading-skeleton"]',
    );
    expect(skeleton).not.toBeNull();
    expect(container.querySelector("article")!.className).toContain(
      "min-h-[420px]",
    );
    unmount();
  });
});
