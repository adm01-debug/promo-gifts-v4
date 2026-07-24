/**
 * Garante que o badge "Alterações não salvas / Não salvo" não aparece
 * visualmente no Quote Builder, mas que o auto-save segue gravando
 * o rascunho no localStorage (chave `quote_draft_*`).
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";

test.describe("Quote Builder — Auto-save silencioso", () => {
  test.beforeEach(() => requireAuth());

  test("badge oculto visualmente, mas persistência continua ativa", async ({ page }) => {
    await gotoAndSettle(page, "/orcamentos/novo");
    await expect(page.locator(Sel.quote.wizard).first()).toBeVisible({ timeout: 10_000 });

    // 1) Nenhum texto "Alterações não salvas" / "Não salvo" visível ao usuário.
    const visibleUnsaved = page.getByText(/Alterações não salvas|Não salvo/i).filter({
      visible: true,
    });
    await expect(visibleUnsaved).toHaveCount(0);

    // 2) Dispara uma mudança detectável pelo auto-save (campo Observações).
    const notes = page
      .locator('textarea[placeholder*="Observações" i], textarea[placeholder*="proposta" i]')
      .first();
    if (await notes.count()) {
      await notes.fill(`E2E autosave ${Date.now()}`);
    }

    // 3) Debounce do auto-save = 2000ms. Aguarda o flush no localStorage.
    await page.waitForTimeout(2500);

    const draftKeys = await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.startsWith("quote_draft_")),
    );
    expect(draftKeys.length, "auto-save não gravou rascunho no localStorage").toBeGreaterThan(0);

    // 4) Nenhum toast/sonner com texto "Não salvo" deve ter aparecido.
    const toastUnsaved = page
      .locator("[data-sonner-toast]")
      .filter({ hasText: /Não salvo|Alterações não salvas/i });
    await expect(toastUnsaved).toHaveCount(0);
  });
});
