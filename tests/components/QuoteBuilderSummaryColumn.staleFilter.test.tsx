/**
 * Contrato do filtro/contador de "Preços a confirmar" no resumo do QuoteBuilder:
 *
 *  1. O contador (badge ao lado do chip) considera APENAS itens com
 *     `getPriceFreshness().shouldWarn === true` (aging/stale) E
 *     `price_confirmed_at` vazio. Itens fresh nunca entram, mesmo sem confirmação.
 *  2. O chip "Preços a confirmar" só aparece quando o contador é > 0.
 *  3. Após o vendedor clicar em "Confirmei" num item stale, o badge inline
 *     daquele item desaparece e o contador decrementa.
 *  4. Quando o contador zera, o chip some por completo.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { useState } from "react";
import { QuoteBuilderSummaryColumn } from "@/components/quotes/QuoteBuilderSummaryColumn";
import type { QuoteItem } from "@/hooks/quotes";

// O componente importa toast (sonner) — silenciamos para não poluir o stdout.
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const FIXED_NOW = new Date("2026-04-24T12:00:00.000Z").getTime();
const daysAgo = (d: number) => new Date(FIXED_NOW - d * 86400000).toISOString();

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterAll(() => {
  vi.useRealTimers();
});

function makeItem(overrides: Partial<QuoteItem>): QuoteItem {
  return {
    product_id: "p",
    product_name: "Item",
    product_sku: "SKU",
    product_image_url: null,
    color_name: null,
    color_hex: null,
    quantity: 10,
    unit_price: 5,
    discount_percent: 0,
    notes: null,
    kit_group_id: null,
    kit_name: null,
    price_updated_at: null,
    price_freshness_threshold_days: null,
    price_confirmed_at: null,
    personalizations: [],
    ...overrides,
  } as QuoteItem;
}

/** Wrapper que conecta `confirmItemPrice` ao state real, igual ao hook em produção. */
function Harness({ initial }: { initial: QuoteItem[] }) {
  const [items, setItems] = useState<QuoteItem[]>(initial);
  const confirmItemPrice = (index: number) => {
    setItems((prev) =>
      prev.map((it, i) =>
        i === index ? { ...it, price_confirmed_at: new Date().toISOString() } : it,
      ),
    );
  };
  return (
    <QuoteBuilderSummaryColumn
      items={items}
      activeItemIndex={null}
      setActiveItemIndex={() => {}}
      removeItem={() => {}}
      discountType="percent"
      setDiscountType={() => {}}
      discountValue={0}
      setDiscountValue={() => {}}
      discountAmount={0}
      total={0}
      isFormValid
      isDraftValid
      validationErrors={[]}
      quotesLoading={false}
      isEditMode={false}
      formatCurrency={(v) => `R$ ${v.toFixed(2)}`}
      calculateItemPersonalizationTotal={() => 0}
      calculateItemTotal={(it) => it.quantity * it.unit_price}
      onSave={() => {}}
      confirmItemPrice={confirmItemPrice}
    />
  );
}

describe("QuoteBuilderSummaryColumn — filtro/contador de preços a confirmar", () => {
  it("NÃO renderiza o chip quando todos os itens estão fresh", () => {
    render(
      <Harness
        initial={[
          makeItem({ product_name: "Caneta", price_updated_at: daysAgo(5), price_freshness_threshold_days: 60 }),
          makeItem({ product_name: "Bloco",  price_updated_at: daysAgo(10), price_freshness_threshold_days: 60 }),
        ]}
      />,
    );
    expect(screen.queryByText(/preços a confirmar/i)).not.toBeInTheDocument();
  });

  it("conta apenas aging/stale com price_confirmed_at vazio", () => {
    render(
      <Harness
        initial={[
          // fresh — NÃO conta
          makeItem({ product_name: "Fresh", price_updated_at: daysAgo(5), price_freshness_threshold_days: 60 }),
          // aging — conta
          makeItem({ product_name: "Aging", price_updated_at: daysAgo(45), price_freshness_threshold_days: 60 }),
          // stale — conta
          makeItem({ product_name: "Stale", price_updated_at: daysAgo(90), price_freshness_threshold_days: 60 }),
          // stale MAS já confirmado — NÃO conta
          makeItem({
            product_name: "Stale-OK",
            price_updated_at: daysAgo(90),
            price_freshness_threshold_days: 60,
            price_confirmed_at: daysAgo(0),
          }),
          // unknown (sem data) — NÃO conta (shouldWarn=false)
          makeItem({ product_name: "Unknown", price_updated_at: null }),
        ]}
      />,
    );
    const chip = screen.getByRole("button", { name: /preço a confirmar/i });
    // O badge numérico fica DENTRO do chip
    expect(within(chip).getByText("2")).toBeInTheDocument();
  });

  it("badge inline some no item após confirmar e o contador decrementa", () => {
    render(
      <Harness
        initial={[
          makeItem({ product_name: "Caneta-Stale", price_updated_at: daysAgo(90), price_freshness_threshold_days: 60 }),
          makeItem({ product_name: "Bloco-Stale",  price_updated_at: daysAgo(95), price_freshness_threshold_days: 60 }),
        ]}
      />,
    );
    // 2 alertas inline visíveis (status do PriceFreshnessBadge)
    expect(screen.getAllByText(/preço pode estar defasado/i)).toHaveLength(2);
    const chip = screen.getByRole("button", { name: /preço a confirmar/i });
    expect(within(chip).getByText("2")).toBeInTheDocument();

    // Confirma o primeiro item via botão "Confirmei com fornecedor" do badge
    const confirmButtons = screen.getAllByRole("button", {
      name: /confirmar que validei este preço com o fornecedor/i,
    });
    expect(confirmButtons).toHaveLength(2);
    fireEvent.click(confirmButtons[0]);

    // O alerta inline daquele item virou pill verde (sobrou 1 alerta amber)
    expect(screen.getAllByText(/preço pode estar defasado/i)).toHaveLength(1);
    // E o contador caiu para 1
    const chip2 = screen.getByRole("button", { name: /preço a confirmar/i });
    expect(within(chip2).getByText("1")).toBeInTheDocument();
  });

  it("chip desaparece quando o último item pendente é confirmado", () => {
    render(
      <Harness
        initial={[
          makeItem({ product_name: "Único", price_updated_at: daysAgo(90), price_freshness_threshold_days: 60 }),
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: /preço a confirmar/i })).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /confirmar que validei este preço com o fornecedor/i }),
    );

    expect(screen.queryByRole("button", { name: /preço a confirmar/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/preço pode estar defasado/i)).not.toBeInTheDocument();
  });

  it("filtro mostra somente os itens pendentes e ignora os já confirmados", () => {
    render(
      <Harness
        initial={[
          makeItem({ product_name: "Fresh-A", price_updated_at: daysAgo(5),  price_freshness_threshold_days: 60 }),
          makeItem({ product_name: "Stale-B", price_updated_at: daysAgo(90), price_freshness_threshold_days: 60 }),
          makeItem({
            product_name: "Stale-C-OK",
            price_updated_at: daysAgo(90),
            price_freshness_threshold_days: 60,
            price_confirmed_at: daysAgo(0),
          }),
        ]}
      />,
    );
    // Liga o filtro
    fireEvent.click(screen.getByRole("button", { name: /preço a confirmar/i }));

    // Só "Stale-B" deve estar visível na lista
    expect(screen.getByText("Stale-B")).toBeInTheDocument();
    expect(screen.queryByText("Fresh-A")).not.toBeInTheDocument();
    expect(screen.queryByText("Stale-C-OK")).not.toBeInTheDocument();
  });
});
