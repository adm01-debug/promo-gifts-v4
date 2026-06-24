/**
 * Contrato de persistência do `price_confirmed_at` em quote_items:
 *
 *  - Save: `buildItemsInsertPayload` deve incluir `price_confirmed_at` no payload
 *    (preservando o ISO timestamp ou null), para que o estado "confirmado pelo
 *    vendedor" sobreviva ao salvar / atualizar o orçamento.
 *  - Load: o `fetchQuote` usa `select("*")` em quote_items, então a coluna volta
 *    automaticamente. O mapeamento `{ ...item, personalizations: [...] }` deve
 *    preservar o campo no objeto QuoteItem do estado do builder.
 */
import { describe, it, expect } from "vitest";
import { buildItemsInsertPayload } from "@/hooks/quotes/quoteHelpers";
import type { QuoteItem } from "@/hooks/quotes/quoteTypes";

function makeItem(overrides: Partial<QuoteItem> = {}): QuoteItem {
  return {
    product_id: "p1",
    product_name: "Caneta",
    product_sku: "CAN-001",
    quantity: 100,
    unit_price: 5,
    color_name: "Azul", // cor obrigatória em buildItemsInsertPayload
    ...overrides,
  };
}

describe("quoteHelpers — persistência do price_confirmed_at (save)", () => {
  it("inclui price_confirmed_at no payload quando o vendedor confirmou", () => {
    const ts = "2026-04-24T10:00:00.000Z";
    const payload = buildItemsInsertPayload(
      [makeItem({ price_confirmed_at: ts })],
      "quote-1",
    );
    expect(payload[0].price_confirmed_at).toBe(ts);
  });

  it("envia null quando o vendedor ainda NÃO confirmou", () => {
    const payload = buildItemsInsertPayload([makeItem()], "quote-1");
    expect(payload[0].price_confirmed_at).toBeNull();
  });

  it("normaliza undefined → null (defensivo contra serialização)", () => {
    const payload = buildItemsInsertPayload(
      [makeItem({ price_confirmed_at: undefined })],
      "quote-1",
    );
    expect(payload[0].price_confirmed_at).toBeNull();
  });

  it("preserva o estado por item em uma lista mista", () => {
    const ts = "2026-04-24T10:00:00.000Z";
    const payload = buildItemsInsertPayload(
      [
        makeItem({ product_sku: "A", price_confirmed_at: ts }),
        makeItem({ product_sku: "B" }),
        makeItem({ product_sku: "C", price_confirmed_at: null }),
      ],
      "quote-1",
    );
    expect(payload.map((i) => i.price_confirmed_at)).toEqual([ts, null, null]);
  });
});

describe("quoteHelpers — load (espelha o mapeamento do fetchQuote)", () => {
  // Espelha o `(itemsData || []).map((item) => ({ ...item, personalizations: [...] }))`
  // de `useQuotes.fetchQuote` para garantir que o spread preserva o campo.
  function mapRowToQuoteItem(row: Record<string, unknown>): QuoteItem {
    return { ...row, personalizations: [] } as QuoteItem;
  }

  it("preserva price_confirmed_at vindo do banco", () => {
    const ts = "2026-04-24T10:00:00.000Z";
    const item = mapRowToQuoteItem({
      id: "qi-1",
      quote_id: "q-1",
      product_id: "p1",
      product_name: "Caneta",
      quantity: 100,
      unit_price: 5,
      price_confirmed_at: ts,
    });
    expect(item.price_confirmed_at).toBe(ts);
  });

  it("preserva price_confirmed_at = null quando o item nunca foi confirmado", () => {
    const item = mapRowToQuoteItem({
      id: "qi-2",
      product_id: "p2",
      product_name: "Bloco",
      quantity: 50,
      unit_price: 8,
      price_confirmed_at: null,
    });
    expect(item.price_confirmed_at).toBeNull();
  });

  it("round-trip: save → load preserva o timestamp exato", () => {
    const ts = "2026-04-24T10:00:00.000Z";
    const [savedRow] = buildItemsInsertPayload(
      [makeItem({ price_confirmed_at: ts })],
      "quote-1",
    );
    const loaded = mapRowToQuoteItem(
      savedRow as unknown as Record<string, unknown>,
    );
    expect(loaded.price_confirmed_at).toBe(ts);
  });
});
