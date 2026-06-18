/**
 * Fluxo: clicar na foto do produto (Lista/Tabela) abre o QuickView.
 *
 * Cobre os testids adicionados em ProductListItem (product-list-item-thumb)
 * e ProductTableView (product-table-row-thumb). Se a visualização default
 * não montar nenhum dos dois, o teste é skipado — o objetivo é garantir
 * que QUANDO presentes, o clique abre o QuickView sem navegar para /produto/:id.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";

test.describe("Foto do produto abre QuickView (Lista/Tabela)", () => {
  test.beforeEach(() => requireAuth());

  test("thumb da Lista abre QuickView e não navega", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    const thumb = page.locator(Sel.product.listItemThumb).first();
    if ((await thumb.count()) === 0) test.skip(true, "Lista não está ativa por padrão");

    const urlBefore = page.url();
    await thumb.click();

    const quickName = page.locator(Sel.product.quickViewName).first();
    await expect(quickName).toBeVisible({ timeout: 8_000 });
    expect(page.url()).toBe(urlBefore);
  });

  test("thumb da Tabela abre QuickView e não navega", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    const thumb = page.locator(Sel.product.tableRowThumb).first();
    if ((await thumb.count()) === 0) test.skip(true, "Tabela não está ativa por padrão");

    const urlBefore = page.url();
    await thumb.click();

    const quickName = page.locator(Sel.product.quickViewName).first();
    await expect(quickName).toBeVisible({ timeout: 8_000 });
    expect(page.url()).toBe(urlBefore);
  });

  test("a11y: thumb da Lista é ativável via teclado (Enter)", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    const thumb = page.locator(Sel.product.listItemThumb).first();
    if ((await thumb.count()) === 0) test.skip(true, "Lista não está ativa por padrão");

    await expect(thumb).toHaveAttribute("role", "button");
    await expect(thumb).toHaveAttribute("tabindex", "0");
    await thumb.focus();
    await page.keyboard.press("Enter");

    const quickName = page.locator(Sel.product.quickViewName).first();
    await expect(quickName).toBeVisible({ timeout: 8_000 });
  });
});
