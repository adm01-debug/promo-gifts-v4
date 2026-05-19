/**
 * Contrato do botão "Confirmar todos" no resumo do QuoteBuilder:
 *
 *  1. Só aparece quando há itens com preço pendente (aging/stale e não confirmado).
 *  2. Clicar NÃO confirma de imediato — abre um ConfirmDialog primeiro.
 *  3. O diálogo mostra a contagem dinâmica e o CTA "Confirmar N preço(s)".
 *  4. Confirmar dispara `confirmAllStalePrices`, marca todos como confirmados,
 *     o chip e o botão somem e o alerta inline de cada item desaparece.
 *  5. Cancelar fecha o diálogo sem mexer no estado.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { useState } from "react";
import { QuoteBuilderSummaryColumn } from "@/components/quotes/QuoteBuilderSummaryColumn";
import type { QuoteItem } from "@/hooks/quotes";

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

/**
 * Espelha a lógica real do hook `useQuoteBuilderState.confirmAllStalePrices`:
 * marca apenas itens cujo preço esteja em estado de alerta (aging/stale) e
 * ainda não confirmado.
 */
function Harness({ initial }: { initial: QuoteItem[] }) {
  const [items, setItems] = useState<QuoteItem[]>(initial);
  const confirmAllStalePrices = () => {
    const ts = new Date().toISOString();
    setItems((prev) =>
      prev.map((item) => {
        if (item.price_confirmed_at) return item;
        const days = item.price_updated_at
          ? Math.floor(
              (Date.now() - new Date(item.price_updated_at).getTime()) / 86400000,
            )
          : null;
        const threshold = item.price_freshness_threshold_days ?? 60;
        const shouldWarn = days !== null && days >= threshold * 0.5;
        return shouldWarn ? { ...item, price_confirmed_at: ts } : item;
      }),
    );
  };
  const confirmItemPrice = (index: number) =>
    setItems((prev) =>
      prev.map((it, i) =>
        i === index ? { ...it, price_confirmed_at: new Date().toISOString() } : it,
      ),
    );
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
      confirmAllStalePrices={confirmAllStalePrices}
    />
  );
}

describe("QuoteBuilderSummaryColumn — Confirmar todos (com diálogo)", () => {
  it("não renderiza o botão 'Confirmar todos' quando não há itens pendentes", () => {
    render(
      <Harness
        initial={[
          makeItem({ price_updated_at: daysAgo(5), price_freshness_threshold_days: 60 }),
        ]}
      />,
    );
    expect(screen.queryByRole("button", { name: /confirmar todos/i })).not.toBeInTheDocument();
  });

  it("renderiza o botão 'Confirmar todos' quando há ao menos 1 item pendente", () => {
    render(
      <Harness
        initial={[
          makeItem({ price_updated_at: daysAgo(90), price_freshness_threshold_days: 60 }),
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: /confirmar todos/i })).toBeInTheDocument();
  });

  it("clicar em 'Confirmar todos' abre o diálogo e NÃO altera o estado ainda", () => {
    render(
      <Harness
        initial={[
          makeItem({ product_name: "Caneta", price_updated_at: daysAgo(90), price_freshness_threshold_days: 60 }),
          makeItem({ product_name: "Bloco",  price_updated_at: daysAgo(45), price_freshness_threshold_days: 60 }),
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /confirmar todos/i }));

    // Diálogo aberto com contagem dinâmica
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(
      screen.getByText(/confirmar preços com o fornecedor/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/validou 2 preço/i)).toBeInTheDocument();

    // Os badges inline ainda existem — nada confirmado. Stale usa label
    // "Preço pode estar defasado", aging usa "Atualizado há Nd". Validamos
    // que o item stale (90d) ainda tem o badge amber.
    expect(
      screen.getAllByLabelText(/preço (pode estar|possivelmente) defasado/i, { selector: "span" }),
    ).toHaveLength(1);
  });

  it("Cancelar fecha o diálogo sem mexer no estado", () => {
    render(
      <Harness
        initial={[
          makeItem({ price_updated_at: daysAgo(90), price_freshness_threshold_days: 60 }),
          makeItem({ price_updated_at: daysAgo(45), price_freshness_threshold_days: 60 }),
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /confirmar todos/i }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: /cancelar/i }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    // Chip e badge stale continuam intactos (1 stale + 1 aging)
    expect(screen.getByRole("button", { name: /preço a confirmar/i })).toBeInTheDocument();
    expect(
      screen.getAllByLabelText(/preço (pode estar|possivelmente) defasado/i, { selector: "span" }),
    ).toHaveLength(1);
  });

  it("Confirmar marca todos os pendentes, esconde chip/botão e remove alertas inline", () => {
    render(
      <Harness
        initial={[
          // pendentes
          makeItem({ product_name: "Stale-A", price_updated_at: daysAgo(90), price_freshness_threshold_days: 60 }),
          makeItem({ product_name: "Aging-B", price_updated_at: daysAgo(45), price_freshness_threshold_days: 60 }),
          // fresh — não deve ser tocado, mas também não conta
          makeItem({ product_name: "Fresh-C", price_updated_at: daysAgo(5),  price_freshness_threshold_days: 60 }),
          // já confirmado — deve permanecer estável
          makeItem({
            product_name: "Stale-D-OK",
            price_updated_at: daysAgo(90),
            price_freshness_threshold_days: 60,
            price_confirmed_at: daysAgo(0),
          }),
        ]}
      />,
    );

    // Contador inicial = 2 (Stale-A + Aging-B)
    const chip = screen.getByRole("button", { name: /preço a confirmar/i });
    expect(within(chip).getByText("2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /confirmar todos/i }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: /confirmar 2 preços/i,
      }),
    );

    // Diálogo fechou, chip e botão sumiram
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /preço a confirmar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /confirmar todos/i })).not.toBeInTheDocument();
    // Nenhum badge stale/aging restante (todos viraram pill verde "Confirmado")
    expect(
      screen.queryByLabelText(/preço (pode estar|possivelmente) defasado/i, { selector: "span" }),
    ).not.toBeInTheDocument();
  });

  it("CTA do diálogo concorda em singular quando há apenas 1 pendente", () => {
    render(
      <Harness
        initial={[
          makeItem({ price_updated_at: daysAgo(90), price_freshness_threshold_days: 60 }),
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /confirmar todos/i }));
    expect(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: /^confirmar 1 preço$/i }),
    ).toBeInTheDocument();
  });
});
