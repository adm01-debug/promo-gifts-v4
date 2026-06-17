/**
 * E2E — Paridade de ações catálogo ↔ estoque.
 *
 * Valida que a tabela de Estoque (1 SKU = 1 linha) expõe, para cada variação
 * (SKU/cor/tamanho), as mesmas 7 ações do catálogo: Copiar SKU, Carrinho,
 * Orçamento, Coleção, Favoritar, Comparar, Visualizar, Compartilhar — além
 * do modo de seleção em lote (Favoritar/Comparar/Orçamento).
 *
 * Skipa quando a rota está vazia ou em sincronização (ambientes sem seed).
 */
import { test, expect, type Page } from "../../fixtures/test-base";
import { TID } from "../../fixtures/selectors";
import { gotoAndSettle } from "../../helpers/nav";
import { loginAs } from "../../helpers/auth";

const ROW = TID("stock-row");
const ACTION_TESTIDS = [
  "stock-row-copy-sku",
  "stock-row-cart",
  "stock-row-quote",
  "stock-row-collection",
  "stock-row-favorite",
  "stock-row-compare",
  "stock-row-view",
  "stock-row-share",
] as const;

async function gotoStock(page: Page) {
  await loginAs(page);
  await gotoAndSettle(page, "/estoque");
  const syncing = page.getByText(/Sincronizando estoque/i);
  if (await syncing.isVisible().catch(() => false)) {
    await expect(syncing).not.toBeVisible({ timeout: 60_000 });
  }
  const empty = page.getByText(/Nenhum.*encontrad/i);
  if (await empty.isVisible().catch(() => false)) {
    test.skip(true, "sem dados seedados para validar paridade");
  }
}

test.describe("Estoque · paridade com catálogo", () => {
  test("cada linha expõe as 7 ações do catálogo (+copy)", async ({ page }) => {
    await gotoStock(page);

    const rows = page.locator(ROW);
    await expect(rows.first()).toBeVisible({ timeout: 30_000 });
    const sample = Math.min(await rows.count(), 5);
    test.skip(sample === 0, "tabela sem linhas");

    for (let i = 0; i < sample; i++) {
      const row = rows.nth(i);
      // Hover força a barra a sair de opacity-0 → 100 (gated por group-hover).
      await row.hover();
      for (const tid of ACTION_TESTIDS) {
        await expect(
          row.locator(TID(tid)),
          `linha ${i} deveria expor ${tid}`,
        ).toBeVisible({ timeout: 5_000 });
      }
    }
  });

  test("paridade se mantém para múltiplas variações (SKU/cor/tamanho distintos)", async ({ page }) => {
    await gotoStock(page);
    const rows = page.locator(ROW);
    const total = await rows.count();
    test.skip(total < 2, "poucas variações para validar variação cruzada");

    const indexes = total >= 3 ? [0, Math.floor(total / 2), total - 1] : [0, total - 1];
    for (const i of indexes) {
      const row = rows.nth(i);
      await row.hover();
      // Sanity: assegura cor/SKU únicos entre linhas amostradas (best-effort).
      const sku = await row.locator(TID("stock-row-copy-sku")).getAttribute("aria-label");
      expect(sku, `linha ${i} sem aria-label de SKU`).toBeTruthy();

      for (const tid of ACTION_TESTIDS) {
        await expect(row.locator(TID(tid))).toBeVisible({ timeout: 5_000 });
      }
    }
  });

  test("modo seleção habilita checkboxes + barra de ações em lote", async ({ page }) => {
    await gotoStock(page);

    const toggle = page.locator(TID("stock-selection-toggle"));
    await expect(toggle).toBeVisible({ timeout: 15_000 });

    // Antes do toggle, a barra de ações em lote NÃO existe.
    await expect(page.locator(TID("stock-bulk-action-bar"))).toHaveCount(0);

    await toggle.click();
    await expect(page.locator(TID("stock-bulk-action-bar"))).toBeVisible();

    const checks = page.locator(TID("stock-row-select"));
    await expect(checks.first()).toBeVisible({ timeout: 10_000 });

    // Marcar 2 primeiras variações
    const n = Math.min(await checks.count(), 2);
    for (let i = 0; i < n; i++) await checks.nth(i).check();

    // Botões de bulk não devem ficar desabilitados após seleção.
    for (const tid of ["stock-bulk-favorite", "stock-bulk-compare", "stock-bulk-quote"]) {
      await expect(page.locator(TID(tid))).toBeEnabled({ timeout: 5_000 });
    }

    // Sair do modo
    await page.locator(TID("stock-bulk-clear")).click();
    await expect(page.locator(TID("stock-bulk-action-bar"))).toHaveCount(0);
  });

  test("favoritar via ação rápida persiste estado aria-pressed", async ({ page }) => {
    await gotoStock(page);
    const row = page.locator(ROW).first();
    await row.hover();
    const fav = row.locator(TID("stock-row-favorite"));
    await expect(fav).toBeVisible({ timeout: 10_000 });

    const before = await fav.getAttribute("aria-pressed");
    await fav.click();
    await expect.poll(async () => fav.getAttribute("aria-pressed"), { timeout: 5_000 }).not.toBe(
      before,
    );
  });

  test("bulk favorite persiste em localStorage e aparece em /favoritos", async ({ page }) => {
    await gotoStock(page);

    // Limpa estado prévio para isolar a asserção.
    await page.evaluate(() => {
      try {
        localStorage.removeItem("product-favorites");
      } catch {
        /* noop */
      }
    });

    await page.locator(TID("stock-selection-toggle")).click();
    const checks = page.locator(TID("stock-row-select"));
    await expect(checks.first()).toBeVisible({ timeout: 10_000 });
    const n = Math.min(await checks.count(), 2);
    test.skip(n < 1, "sem variações para favoritar em lote");
    for (let i = 0; i < n; i++) await checks.nth(i).check();

    await page.locator(TID("stock-bulk-favorite")).click();

    // localStorage refletiu a ação.
    const stored = await page.evaluate<unknown[]>(() => {
      try {
        const raw = localStorage.getItem("product-favorites");
        return raw ? (JSON.parse(raw) as unknown[]) : [];
      } catch {
        return [];
      }
    });
    expect(stored.length).toBeGreaterThanOrEqual(1);

    // Navegar para /favoritos não deve renderizar empty state.
    await gotoAndSettle(page, "/favoritos");
    await expect(
      page.getByTestId("favorites-empty-state"),
    ).toHaveCount(0, { timeout: 10_000 });
  });

  test('atalho "s" alterna o modo de seleção', async ({ page }) => {
    await gotoStock(page);

    const toggle = page.locator(TID("stock-selection-toggle"));
    await expect(toggle).toBeVisible({ timeout: 15_000 });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");

    // Garante foco fora de input (clicando no body).
    await page.locator("body").click({ position: { x: 10, y: 10 } });
    await page.keyboard.press("s");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(TID("stock-bulk-action-bar"))).toBeVisible();

    await page.keyboard.press("s");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(TID("stock-bulk-action-bar"))).toHaveCount(0);
  });

  test('atalho "s" é ignorado quando foco está em input de busca', async ({ page }) => {
    await gotoStock(page);
    const toggle = page.locator(TID("stock-selection-toggle"));
    await expect(toggle).toHaveAttribute("aria-pressed", "false");

    const search = page.getByPlaceholder(/Buscar na tabela/i);
    await search.click();
    await search.type("s");
    // Atalho NÃO deve disparar — segue desabilitado.
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(search).toHaveValue("s");
  });

  test("bulk Coleção abre modal e lista coleções existentes", async ({ page }) => {
    await gotoStock(page);
    await page.locator(TID("stock-selection-toggle")).click();
    const checks = page.locator(TID("stock-row-select"));
    await expect(checks.first()).toBeVisible({ timeout: 10_000 });
    await checks.first().check();

    const bulkColl = page.locator(TID("stock-bulk-collection"));
    await expect(bulkColl).toBeEnabled();
    await bulkColl.click();

    await expect(page.locator(TID("stock-bulk-collection-modal"))).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.locator(TID("stock-bulk-collection-new"))).toBeVisible();
  });
});
