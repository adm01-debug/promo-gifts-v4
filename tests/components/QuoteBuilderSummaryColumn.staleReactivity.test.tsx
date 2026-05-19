/**
 * Reatividade do chip "Preços a confirmar" e do botão "Confirmar todos"
 * no QuoteBuilderSummaryColumn.
 *
 * Contrato:
 *  - O chip exibe a contagem de itens com preço aging/stale ainda **não**
 *    confirmados (`price_confirmed_at == null`).
 *  - O botão "Confirmar todos" só aparece quando há ao menos 1 item nesse
 *    estado (`staleCount > 0`) E o handler `confirmAllStalePrices` foi
 *    fornecido.
 *  - Ao confirmar um item individualmente (badge → `confirmItemPrice`),
 *    o array `items` muda no pai → o `useMemo` recomputa `staleIndexes`
 *    → o número do chip cai e, quando chega a 0, chip e botão somem.
 *  - Quando o filtro "mostrar apenas stale" estava ativo e a contagem
 *    zera, o filtro é desligado automaticamente (efeito setTimeout 0).
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { render, screen, act, fireEvent, within } from "@testing-library/react";
import { useState, useCallback } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QuoteBuilderSummaryColumn } from "@/components/quotes/QuoteBuilderSummaryColumn";
import type { QuoteItem } from "@/hooks/quotes";

const FIXED_NOW = new Date("2026-04-24T12:00:00.000Z").getTime();
const daysAgo = (d: number) =>
  new Date(FIXED_NOW - d * 86400000).toISOString();

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});
afterAll(() => {
  vi.useRealTimers();
});

function makeItem(overrides: Partial<QuoteItem> = {}): QuoteItem {
  return {
    product_id: "p" + Math.random().toString(36).slice(2, 8),
    product_name: "Item",
    quantity: 100,
    unit_price: 5,
    price_freshness_threshold_days: 60,
    ...overrides,
  };
}

/**
 * Harness que espelha a integração real entre `useQuoteBuilderState` e o
 * `QuoteBuilderSummaryColumn`: o `confirmItemPrice` cria um novo array de
 * `items` (contrato do reducer real), forçando o re-render que dispara o
 * recálculo do `useMemo` do chip.
 */
function Harness({ initial }: { initial: QuoteItem[] }) {
  const [items, setItems] = useState(initial);
  const confirmItemPrice = useCallback((index: number) => {
    setItems((prev) =>
      prev.map((it, i) =>
        i === index ? { ...it, price_confirmed_at: new Date().toISOString() } : it,
      ),
    );
  }, []);
  const confirmAllStalePrices = useCallback(() => {
    setItems((prev) =>
      prev.map((it) =>
        it.price_confirmed_at
          ? it
          : { ...it, price_confirmed_at: new Date().toISOString() },
      ),
    );
  }, []);
  return (
    <TooltipProvider>
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
        total={items.reduce((s, i) => s + i.quantity * i.unit_price, 0)}
        isFormValid
        isDraftValid
        validationErrors={[]}
        quotesLoading={false}
        isEditMode={false}
        formatCurrency={(v) => `R$ ${v.toFixed(2)}`}
        calculateItemPersonalizationTotal={() => 0}
        calculateItemTotal={(i) => i.quantity * i.unit_price}
        onSave={() => {}}
        confirmItemPrice={confirmItemPrice}
        confirmAllStalePrices={confirmAllStalePrices}
      />
    </TooltipProvider>
  );
}

function getStaleChip(): HTMLElement | null {
  return screen.queryByRole("button", { name: /preço a confirmar/i });
}

function getConfirmAllButton(): HTMLElement | null {
  return screen.queryByRole("button", { name: /confirmar todos/i });
}

/**
 * O CTA "Confirmei com fornecedor" do badge inline pode receber sufixos do
 * tooltip (data, status). Filtramos pelo texto literal e ignoramos o chip do
 * topo (que tem "preço a confirmar" no nome, sem "Confirmei").
 */
function getInlineConfirmCtas(): HTMLElement[] {
  return screen
    .getAllByRole("button")
    .filter((b) => /^confirmei com fornecedor/i.test(b.textContent ?? ""));
}

describe("QuoteBuilderSummaryColumn — reatividade do chip + botão de confirmar todos", () => {
  it("monta com 2 stale → chip mostra '2' e botão 'Confirmar todos' aparece", () => {
    render(
      <Harness
        initial={[
          makeItem({ product_name: "A", price_updated_at: daysAgo(90) }),
          makeItem({ product_name: "B", price_updated_at: daysAgo(80) }),
          makeItem({ product_name: "C", price_updated_at: daysAgo(5) }), // fresh
        ]}
      />,
    );
    const chip = getStaleChip();
    expect(chip).not.toBeNull();
    expect(within(chip!).getByText("2")).toBeInTheDocument();
    expect(getConfirmAllButton()).toBeInTheDocument();
  });

  it("confirmar 1 dos 2 stale → chip cai para '1', botão continua visível", () => {
    render(
      <Harness
        initial={[
          makeItem({ product_name: "A", price_updated_at: daysAgo(90) }),
          makeItem({ product_name: "B", price_updated_at: daysAgo(80) }),
        ]}
      />,
    );
    expect(within(getStaleChip()!).getByText("2")).toBeInTheDocument();

    // Clica no CTA "Confirmei com fornecedor" do primeiro badge stale.
    const confirmCtas = getInlineConfirmCtas();
    expect(confirmCtas.length).toBeGreaterThanOrEqual(2);
    act(() => {
      fireEvent.click(confirmCtas[0]);
    });

    // Re-render reativo via useMemo([items]).
    expect(within(getStaleChip()!).getByText("1")).toBeInTheDocument();
    expect(getConfirmAllButton()).toBeInTheDocument();
  });

  it("confirmar o último stale → chip e botão desaparecem", () => {
    render(
      <Harness
        initial={[
          makeItem({ product_name: "A", price_updated_at: daysAgo(90) }),
          makeItem({ product_name: "B", price_updated_at: daysAgo(5) }), // fresh
        ]}
      />,
    );
    expect(within(getStaleChip()!).getByText("1")).toBeInTheDocument();
    expect(getConfirmAllButton()).toBeInTheDocument();

    const confirmCtas = getInlineConfirmCtas();
    expect(confirmCtas.length).toBe(1);
    act(() => {
      fireEvent.click(confirmCtas[0]);
    });

    expect(getStaleChip()).toBeNull();
    expect(getConfirmAllButton()).toBeNull();
  });

  it("filtro 'mostrar apenas stale' ativo: ao zerar a contagem, o filtro desliga sozinho", () => {
    render(
      <Harness
        initial={[
          makeItem({ product_name: "A", price_updated_at: daysAgo(90) }),
          makeItem({ product_name: "B", price_updated_at: daysAgo(5) }),
        ]}
      />,
    );
    // Ativa o filtro clicando no chip.
    act(() => {
      fireEvent.click(getStaleChip()!);
    });
    expect(getStaleChip()).toHaveAttribute("aria-pressed", "true");

    // Confirma o único stale.
    const ctas = getInlineConfirmCtas();
    expect(ctas.length).toBe(1);
    act(() => {
      fireEvent.click(ctas[0]);
    });

    // Auto-desliga via setTimeout(0) — avança timers para disparar.
    act(() => {
      vi.advanceTimersByTime(1);
    });

    // Sem stale → chip e botão somem; o card "Todos os preços confirmados"
    // não deve permanecer (filtro foi desligado).
    expect(getStaleChip()).toBeNull();
    expect(
      screen.queryByText(/todos os preços estão confirmados/i),
    ).toBeNull();
  });
});
