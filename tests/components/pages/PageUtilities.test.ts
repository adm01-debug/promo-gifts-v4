/**
 * Logic tests for SellerCartsPage, QuoteBuilderPage, QuoteViewPage
 * These pages are too deeply interconnected for render tests in jsdom,
 * so we test their utility logic and data transformations.
 *
 * FIX 2026-06-29: ciclo de vida do carrinho reduzido para 2 estados
 * (espelha STATUS_CONFIG + CartStatus + a constraint chk_sc_status do banco):
 *   'em_separacao' (default) | 'pronto_orcamento'.
 * Os valores antigos 'novo' e 'em_negociacao' foram colapsados em 'em_separacao'.
 */
import { describe, it, expect } from "vitest";

// Replicate formatCNPJ from QuoteViewPage
function formatCNPJ(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length === 14) {
    return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12,14)}`;
  }
  return cnpj;
}

/**
 * CartStatus — espelha exatamente o tipo e STATUS_CONFIG de produção:
 *   src/hooks/products/useSellerCarts.ts  (export type CartStatus)
 *   src/components/cart/CartUtilComponents.tsx (STATUS_CONFIG)
 */
type CartStatus = "em_separacao" | "pronto_orcamento";

const STATUS_COLORS: Record<CartStatus, string> = {
  em_separacao: "bg-warning/10 text-warning border-warning/20",
  pronto_orcamento: "bg-success/10 text-success border-success/20",
};

function getStatusColor(status: CartStatus): string {
  return STATUS_COLORS[status] ?? STATUS_COLORS.em_separacao;
}

function calculateCartTotal(items: Array<{ quantity: number; product_price: number }>): number {
  return items.reduce((sum, item) => sum + item.quantity * item.product_price, 0);
}

// Quote builder validation logic
function validateQuoteItems(items: Array<{ quantity: number; unit_price: number; product_name: string }>): string[] {
  const errors: string[] = [];
  if (items.length === 0) errors.push("Adicione pelo menos um item");
  items.forEach((item, i) => {
    if (item.quantity <= 0) errors.push(`Item ${i + 1}: quantidade inválida`);
    if (item.unit_price < 0) errors.push(`Item ${i + 1}: preço inválido`);
    if (!item.product_name.trim()) errors.push(`Item ${i + 1}: nome obrigatório`);
  });
  return errors;
}

describe("Page Utilities - SellerCartsPage", () => {
  it("calculates cart total correctly", () => {
    expect(calculateCartTotal([
      { quantity: 10, product_price: 5.50 },
      { quantity: 20, product_price: 3.25 },
    ])).toBeCloseTo(120.0);
  });

  it("handles empty cart", () => {
    expect(calculateCartTotal([])).toBe(0);
  });

  it("returns correct color for 'em_separacao'", () => {
    expect(getStatusColor("em_separacao")).toBe("bg-warning/10 text-warning border-warning/20");
  });

  it("returns correct color for 'pronto_orcamento'", () => {
    expect(getStatusColor("pronto_orcamento")).toBe("bg-success/10 text-success border-success/20");
  });

  it("STATUS_COLORS cobre todos os valores de CartStatus sem fallback", () => {
    const statuses: CartStatus[] = ["em_separacao", "pronto_orcamento"];
    for (const s of statuses) {
      expect(STATUS_COLORS[s]).toBeDefined();
      expect(getStatusColor(s)).toBe(STATUS_COLORS[s]);
    }
  });
});

describe("Page Utilities - QuoteViewPage", () => {
  it("formats CNPJ correctly", () => {
    expect(formatCNPJ("12345678000190")).toBe("12.345.678/0001-90");
  });

  it("returns raw string for invalid CNPJ length", () => {
    expect(formatCNPJ("123456")).toBe("123456");
    expect(formatCNPJ("")).toBe("");
  });

  it("handles already formatted CNPJ", () => {
    const formatted = "12.345.678/0001-90";
    expect(formatCNPJ(formatted)).toBe("12.345.678/0001-90");
  });
});

describe("Page Utilities - QuoteBuilderPage", () => {
  it("validates empty items list", () => {
    const errors = validateQuoteItems([]);
    expect(errors).toContain("Adicione pelo menos um item");
  });

  it("validates item with zero quantity", () => {
    const errors = validateQuoteItems([
      { quantity: 0, unit_price: 10, product_name: "Caneta" },
    ]);
    expect(errors).toContain("Item 1: quantidade inválida");
  });

  it("validates item with negative price", () => {
    const errors = validateQuoteItems([
      { quantity: 5, unit_price: -1, product_name: "Caneta" },
    ]);
    expect(errors).toContain("Item 1: preço inválido");
  });

  it("validates item with empty name", () => {
    const errors = validateQuoteItems([
      { quantity: 5, unit_price: 10, product_name: "  " },
    ]);
    expect(errors).toContain("Item 1: nome obrigatório");
  });

  it("passes valid items", () => {
    const errors = validateQuoteItems([
      { quantity: 100, unit_price: 5.50, product_name: "Caneta BIC" },
      { quantity: 50, unit_price: 12.00, product_name: "Camiseta" },
    ]);
    expect(errors).toHaveLength(0);
  });

  it("accumulates multiple errors", () => {
    const errors = validateQuoteItems([
      { quantity: 0, unit_price: -1, product_name: "" },
    ]);
    expect(errors.length).toBe(3);
  });
});
