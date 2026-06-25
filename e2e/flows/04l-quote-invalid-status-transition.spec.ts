/**
 * Spec: bloqueio de transição inválida + fallback de UI.
 *
 * Estratégia: intercepta GET em /rest/v1/quotes* (PostgREST) e devolve
 * payloads sintéticos:
 *   1. somente status='pending' → banner "Todos em Pendente" deve aparecer;
 *   2. inclui um 'approved' → banner deve sumir (fallback é desativado).
 *
 * Não cria/escreve nada no banco — totalmente determinístico.
 *
 * Cobertura indireta da telemetria `quote_status_transition_blocked`:
 * o caminho de CHECK violation é coberto por testes unitários em
 * `quoteService.updateQuoteStatus` (gap FE↔DB de 10↔7 status).
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";

const BANNER = '[data-testid="quotes-only-pending-banner"]';

function fakeQuote(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    quote_number: "001/26",
    seller_id: "fake-seller",
    org_id: null,
    client_name: "Cliente Teste",
    client_company: "Empresa Teste",
    client_email: "teste@example.com",
    status: "pending",
    total: 1000,
    subtotal: 1000,
    discount: 0,
    valid_until: null,
    created_at: "2026-06-25T00:00:00Z",
    updated_at: "2026-06-25T00:00:00Z",
    version: 1,
    ...overrides,
  };
}

test.describe("Orçamentos — fallback pending-only e telemetria de transição", () => {
  test.beforeEach(() => requireAuth());

  test("banner pending-only aparece quando todos os quotes estão em pending", async ({
    page,
  }) => {
    await page.route(/\/rest\/v1\/quotes(\?|$)/i, (route) => {
      if (route.request().method() !== "GET") return route.continue();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Content-Range": "0-2/3" },
        body: JSON.stringify([
          fakeQuote({ id: "11111111-1111-1111-1111-111111111111", quote_number: "001/26" }),
          fakeQuote({ id: "22222222-2222-2222-2222-222222222222", quote_number: "002/26" }),
          fakeQuote({ id: "33333333-3333-3333-3333-333333333333", quote_number: "003/26" }),
        ]),
      });
    });

    await gotoAndSettle(page, "/orcamentos");
    await expect(page.locator(Sel.page.title("orcamentos")).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator(BANNER)).toBeVisible({ timeout: 8_000 });
  });

  test("banner some quando há ao menos um status diferente de pending", async ({ page }) => {
    await page.route(/\/rest\/v1\/quotes(\?|$)/i, (route) => {
      if (route.request().method() !== "GET") return route.continue();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Content-Range": "0-1/2" },
        body: JSON.stringify([
          fakeQuote({ id: "11111111-1111-1111-1111-111111111111", status: "pending" }),
          fakeQuote({
            id: "22222222-2222-2222-2222-222222222222",
            status: "approved",
            quote_number: "002/26",
          }),
        ]),
      });
    });

    await gotoAndSettle(page, "/orcamentos");
    await expect(page.locator(Sel.page.title("orcamentos")).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator(BANNER)).toHaveCount(0);
  });
});
