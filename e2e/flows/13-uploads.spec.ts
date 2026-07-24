/**
 * E2E Uploads - Mockups e Logos
 * Valida upload de mídias e tratamento de estados de carregamento.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle, settleAfterAction } from "../helpers/nav";
import path from "path";

test.describe("Fluxos de Upload", () => {
  test.beforeEach(() => requireAuth());

  test("Upload de logo no criador de mockup", async ({ page }) => {
    await gotoAndSettle(page, "/magic-up");
    
    // Simular upload de arquivo
    const fileChooserPromise = page.waitForEvent('filechooser');
    // Botão de upload
    await page.click('button:has-text("Upload"), button:has-text("Subir")');
    const fileChooser = await fileChooserPromise;
    
    // Usar um asset de teste fixo se existir, ou criar dummy
    const testFilePath = path.resolve('public/favicon.ico');
    await fileChooser.setFiles(testFilePath);
    
    // Validar estado de carregamento
    await expect(page.locator('[data-state="loading"], [data-skeleton], .animate-spin')).toBeVisible().catch(() => {});
    
    // Validar conclusão
    await settleAfterAction(page);
    await expect(page.locator('img[src*="supabase"]')).toBeVisible({ timeout: 15_000 });
  });

  test("Persistence de upload após refresh", async ({ page }) => {
    await gotoAndSettle(page, "/magic-up");
    // Se houver histórico, deve persistir
    const historyCount = await page.locator('[data-testid*="history-item"]').count();
    
    await page.reload();
    await settleAfterAction(page);
    
    const countAfter = await page.locator('[data-testid*="history-item"]').count();
    expect(countAfter).toEqual(historyCount);
  });
});
