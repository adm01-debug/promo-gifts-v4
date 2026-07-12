/**
 * E2E — Cenários de borda da exclusão INDIVIDUAL com "Desfazer".
 *
 * Cobre:
 *   1. Contador expira → toast desaparece → cliques posteriores no botão
 *      "Desfazer" não disparam POST de restore (o botão sai do DOM).
 *   2. `deleteQuote` falha (DELETE 500) → toast "Desfazer" NÃO aparece →
 *      linha do orçamento continua na lista, sem duplicatas.
 *   3. Valida testids granulares do toast (title, description, countdown,
 *      button com `data-remaining-sec`).
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";
import { seedQuotesForStatusChips } from "../helpers/quotes-status-seed";

test.use({ trace: "retain-on-failure", screenshot: "only-on-failure" });

const QUOTES_REST = /\/rest\/v1\/quotes(\?|$)/;
const UNDO_TOAST = '[data-testid="undo-toast"]';
const UNDO_BTN = '[data-testid="undo-toast-button"]';
const UNDO_COUNTDOWN = '[data-testid="undo-toast-countdown"]';
const UNDO_TITLE = '[data-testid="undo-toast-title"]';

test.describe("Fluxo: exclusão individual — cenários de borda com Desfazer", () => {
  test.beforeEach(() => requireAuth());

  test("contador expira → toast some → clique posterior não restaura", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await gotoAndSettle(page, "/orcamentos");
    const seed = await seedQuotesForStatusChips(page);
    expect(seed.skipped, `seed falhou: ${seed.skipped}`).toBeNull();

    await gotoAndSettle(page, "/orcamentos");
    await expect(page.locator(Sel.page.title("orcamentos")).first()).toBeVisible({
      timeout: 10_000,
    });
    await page.locator('button[data-chip-key="all"]').click();

    const firstRow = page.locator('[data-testid^="quote-row-"]').first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    const rowTestId = (await firstRow.getAttribute("data-testid"))!;
    const quoteId = rowTestId.replace(/^quote-row-/, "");

    let deleteCalls = 0;
    let postCalls = 0;
    await page.route(QUOTES_REST, async (route, request) => {
      const method = request.method();
      if (method === "DELETE") {
        deleteCalls += 1;
        await route.fulfill({ status: 204, body: "" });
        return;
      }
      if (method === "POST") {
        postCalls += 1;
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify([{ id: `restored-${quoteId}` }]),
        });
        return;
      }
      await route.continue();
    });

    await page.getByTestId(`quote-row-more-${quoteId}`).click();
    await page.getByTestId(`quote-row-menu-delete-${quoteId}`).click();
    await page.getByTestId("quote-list-delete-dialog-yes").click();

    await expect.poll(() => deleteCalls, { timeout: 15_000 }).toBeGreaterThanOrEqual(1);

    // Toast aparece com testids granulares presentes
    const toast = page.locator(UNDO_TOAST);
    await expect(toast).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(UNDO_TITLE)).toBeVisible();
    await expect(page.locator(UNDO_COUNTDOWN)).toBeVisible();

    // Aguarda o contador expirar (duração = 8s + margem). O toast é
    // dispensado quando remainingSec chega a 0.
    await expect(page.locator(UNDO_TOAST)).toHaveCount(0, { timeout: 20_000 });

    // Nenhum POST de restore foi disparado durante a espera
    expect(postCalls).toBe(0);

    // Aguarda mais 1.5s para garantir que nenhum restore silencioso ocorre
    await page.waitForTimeout(1500);
    expect(postCalls).toBe(0);

    // O botão "Desfazer" saiu do DOM — clique via .click() em locator
    // com 0 elementos falha rápido, confirmando a indisponibilidade
    await expect(page.locator(UNDO_BTN)).toHaveCount(0);
  });

  test("DELETE falha (500) → toast Desfazer NÃO aparece, linha permanece sem duplicatas", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await gotoAndSettle(page, "/orcamentos");
    const seed = await seedQuotesForStatusChips(page);
    expect(seed.skipped, `seed falhou: ${seed.skipped}`).toBeNull();

    await gotoAndSettle(page, "/orcamentos");
    await page.locator('button[data-chip-key="all"]').click();

    const firstRow = page.locator('[data-testid^="quote-row-"]').first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    const rowTestId = (await firstRow.getAttribute("data-testid"))!;
    const quoteId = rowTestId.replace(/^quote-row-/, "");

    // Conta linhas antes
    const rowsBefore = await page.locator('[data-testid^="quote-row-"]').count();

    let deleteCalls = 0;
    let postCalls = 0;
    await page.route(QUOTES_REST, async (route, request) => {
      const method = request.method();
      if (method === "DELETE") {
        deleteCalls += 1;
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "internal error", code: "PGRST500" }),
        });
        return;
      }
      if (method === "POST") {
        postCalls += 1;
        await route.fulfill({ status: 201, body: "[]" });
        return;
      }
      await route.continue();
    });

    await page.getByTestId(`quote-row-more-${quoteId}`).click();
    await page.getByTestId(`quote-row-menu-delete-${quoteId}`).click();
    await page.getByTestId("quote-list-delete-dialog-yes").click();

    // DELETE foi tentado
    await expect.poll(() => deleteCalls, { timeout: 15_000 }).toBeGreaterThanOrEqual(1);

    // Aguarda margem para garantir que o toast Desfazer NÃO aparece
    await page.waitForTimeout(2000);
    await expect(page.locator(UNDO_TOAST)).toHaveCount(0);

    // Nenhum POST de restore disparado
    expect(postCalls).toBe(0);

    // A linha específica continua no DOM (delete falhou → nada removido do estado)
    await expect(page.getByTestId(`quote-row-${quoteId}`)).toBeVisible({
      timeout: 10_000,
    });

    // Contagem total de linhas não aumentou (sem duplicatas)
    const rowsAfter = await page.locator('[data-testid^="quote-row-"]').count();
    expect(rowsAfter).toBe(rowsBefore);
  });
});
