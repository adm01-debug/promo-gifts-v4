/**
 * Valida que TODAS as colunas da lista de orçamentos sempre aparecem e que
 * NÃO existe mais nenhum seletor de visibilidade de colunas (popover "Colunas").
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { seedQuotesForStatusChips } from "../helpers/quotes-status-seed";

const ALL_COLUMN_IDS = [
  "status",
  "client",
  "contact",
  "date",
  "value",
  "delivery",
  "quote_number",
] as const;

test.describe("Cotações · todas as colunas sempre visíveis", () => {
  test.beforeEach(() => requireAuth());

  test("todas as colunas aparecem e não há seletor de colunas", async ({ page }) => {
    await gotoAndSettle(page, "/orcamentos");
    const seed = await seedQuotesForStatusChips(page);
    expect(seed.skipped, `seed falhou: ${seed.skipped}`).toBeNull();
    await gotoAndSettle(page, "/orcamentos");

    // 1) Todas as colunas presentes no header.
    for (const id of ALL_COLUMN_IDS) {
      await expect(
        page.locator(`[data-testid="quotes-col-header-${id}"]`).first(),
        `coluna ${id} deve estar visível`,
      ).toBeVisible({ timeout: 10_000 });
    }

    // 2) Nenhum trigger de seleção de colunas.
    await expect(page.getByTestId("quotes-col-prefs-trigger")).toHaveCount(0);

    // 3) Nenhum botão/texto "Colunas" ou "Exibir colunas" no toolbar de cotações.
    await expect(page.getByRole("button", { name: /^Colunas$/i })).toHaveCount(0);
    await expect(page.getByText(/Exibir colunas/i)).toHaveCount(0);

    // 4) Frase de dica de seleção removida da UI.
    await expect(page.getByTestId("quotes-selection-hint")).toHaveCount(0);
    await expect(page.getByText(/Modo de seleção ativo/i)).toHaveCount(0);
    await expect(page.getByText(/marque manualmente os orçamentos/i)).toHaveCount(0);
  });
});
