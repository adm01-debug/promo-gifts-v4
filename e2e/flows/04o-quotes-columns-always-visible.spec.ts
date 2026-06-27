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
  "expiration",
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

    // 4) Frase removida nunca pode aparecer no HTML — antes E depois de filtrar,
    //    ligar o modo de seleção e marcar itens. Asserção via conteúdo bruto
    //    do <body> para cobrir qualquer estado/render.
    const assertPhraseAbsent = async (label: string) => {
      const html = await page.locator("body").innerHTML();
      expect(html, `frase deve estar ausente em: ${label}`).not.toMatch(/Modo de seleção ativo/i);
      expect(html, `frase deve estar ausente em: ${label}`).not.toMatch(/marque manualmente os orçamentos/i);
      await expect(page.getByTestId("quotes-selection-hint")).toHaveCount(0);
    };

    // 4a) Estado inicial.
    await assertPhraseAbsent("estado inicial");

    // 4b) Após filtrar por chip de status.
    const draftChip = page.locator('[data-chip-key="draft"]').first();
    if (await draftChip.count()) {
      await draftChip.click();
      await page.waitForLoadState("domcontentloaded");
      await assertPhraseAbsent("após filtrar por 'draft'");
    }

    // 4c) Após ligar o modo de seleção (sem nenhum item marcado).
    const selectToggle = page.getByRole("button", { name: /Selecionar/i }).first();
    if (await selectToggle.count()) {
      await selectToggle.click();
      await assertPhraseAbsent("modo de seleção ligado, 0 itens");
    }

    // 4d) Após navegar para fora e voltar.
    await gotoAndSettle(page, "/");
    await gotoAndSettle(page, "/orcamentos");
    await assertPhraseAbsent("após navegação fora→volta");
  });
});
