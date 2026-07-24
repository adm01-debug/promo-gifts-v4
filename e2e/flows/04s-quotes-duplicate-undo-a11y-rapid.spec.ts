/**
 * E2E — Desfazer duplicação de orçamento: acessibilidade + rajada de cliques.
 *
 * Complementa `04r-undo-toast-a11y-keyboard.spec.ts` (que valida o toast
 * genérico via `window.__showUndoToast`) exercitando o FLUXO REAL de
 * duplicação disparado por `handleDuplicateWithUndo` (`useQuotesListPage`):
 *
 *   A. Após duplicate, o toast Desfazer aparece com `aria-label`
 *      começando por "Desfazer ação" e citando segundos.
 *   B. Botão recebe foco via `.focus()` e reage a Enter (dispara DELETE
 *      do orçamento recém-criado — restauração no fluxo de duplicate).
 *   C. Rajada de cliques rápidos em Desfazer NÃO gera múltiplos DELETEs
 *      de rollback — apenas 1 acontece, mesmo com 12 cliques em sequência.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { installMockAuth, isMockAuthEnabled } from "../helpers/mock-auth";
import { gotoAndSettle } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";
import { seedQuotesForStatusChips } from "../helpers/quotes-status-seed";

test.use({ trace: "retain-on-failure", screenshot: "only-on-failure" });

const QUOTES_REST = /\/rest\/v1\/quotes(\?|$)/;
const UNDO_TOAST = '[data-testid="undo-toast"]';
const UNDO_BTN = '[data-testid="undo-toast-button"]';

async function openListAndFirstQuoteId(page: import("@playwright/test").Page) {
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
  return rowTestId.replace(/^quote-row-/, "");
}

test.describe("Duplicate + Desfazer — a11y, teclado e rajada de cliques", () => {
  test.beforeEach(async ({ page }) => {
    requireAuth();
    if (isMockAuthEnabled()) await installMockAuth(page);
  });

  test("aria-label acessível + Enter no botão focado dispara rollback do duplicate 1x", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const quoteId = await openListAndFirstQuoteId(page);

    let postCalls = 0; // duplicação
    let deleteCalls = 0; // rollback do duplicate no onUndo
    await page.route(QUOTES_REST, async (route, request) => {
      const method = request.method();
      if (method === "POST") {
        postCalls += 1;
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify([
            { id: `dup-${quoteId}-${postCalls}`, quote_number: "ORC-DUP" },
          ]),
        });
        return;
      }
      if (method === "DELETE") {
        deleteCalls += 1;
        await route.fulfill({ status: 204, body: "" });
        return;
      }
      await route.continue();
    });

    // Abre menu e clica em "Duplicar"
    await page.getByTestId(`quote-row-more-${quoteId}`).click();
    await page.getByTestId(`quote-row-menu-duplicate-${quoteId}`).click();

    // Toast Desfazer aparece
    await expect(page.locator(UNDO_TOAST)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(UNDO_TOAST)).toHaveCount(1);
    await expect(page.locator(UNDO_BTN)).toHaveCount(1);

    // (A) aria-label acessível
    const label = await page.locator(UNDO_BTN).getAttribute("aria-label");
    expect(label, "aria-label ausente no botão Desfazer").not.toBeNull();
    expect(label!).toMatch(/^Desfazer ação/);
    expect(label!).toMatch(/\d+ segundos? restantes? de \d+/);

    // (B) Foco no botão + Enter dispara onUndo (que executa DELETE do dup)
    await page.locator(UNDO_BTN).focus();
    await expect(page.locator(UNDO_BTN)).toBeFocused();
    await page.keyboard.press("Enter");

    // 1 DELETE de rollback
    await expect.poll(() => deleteCalls, { timeout: 10_000 }).toBe(1);
    // Toast dispensado
    await expect(page.locator(UNDO_TOAST)).toHaveCount(0, { timeout: 5_000 });
  });

  test("rajada de cliques rápidos em Desfazer gera 1 rollback (sem DELETEs duplicados)", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const quoteId = await openListAndFirstQuoteId(page);

    let postCalls = 0;
    let deleteCalls = 0;
    await page.route(QUOTES_REST, async (route, request) => {
      const method = request.method();
      if (method === "POST") {
        postCalls += 1;
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify([
            { id: `dup-rapid-${postCalls}`, quote_number: "ORC-DUP" },
          ]),
        });
        return;
      }
      if (method === "DELETE") {
        deleteCalls += 1;
        // pequeno delay para simular latência real e ampliar janela de spam
        await new Promise((r) => setTimeout(r, 250));
        await route.fulfill({ status: 204, body: "" });
        return;
      }
      await route.continue();
    });

    await page.getByTestId(`quote-row-more-${quoteId}`).click();
    await page.getByTestId(`quote-row-menu-duplicate-${quoteId}`).click();

    await expect(page.locator(UNDO_TOAST)).toBeVisible({ timeout: 15_000 });

    // Rajada de 12 cliques (force:true para ignorar transições)
    const btn = page.locator(UNDO_BTN);
    for (let i = 0; i < 12; i++) {
      await btn.click({ force: true, timeout: 500 }).catch(() => {
        /* botão pode ter sido dispensado — esperado */
      });
    }

    // Aguarda estabilizar e confirma: 1 DELETE, sem retry silencioso
    await page.waitForTimeout(1500);
    expect(deleteCalls, "rollback deve rodar 1x mesmo com rajada de cliques").toBe(1);

    // Nenhuma duplicata pendurada + toast dispensado
    await expect(page.locator(UNDO_TOAST)).toHaveCount(0, { timeout: 5_000 });
    const desfazerToasts = await page
      .locator('[data-sonner-toast]:has-text("Desfazer")')
      .count();
    expect(desfazerToasts).toBe(0);

    // Reassert final após margem extra: sem DELETE tardio
    await page.waitForTimeout(1500);
    expect(deleteCalls).toBe(1);
  });
});
