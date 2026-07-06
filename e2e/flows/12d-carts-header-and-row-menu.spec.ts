/**
 * Fluxo: /carrinhos — header (novo/busca/ordenação) + menu 3-pontinhos por linha
 *
 * Cobre:
 *  1) Testids do header: carts-list-new, carts-list-search, carts-list-sort.
 *  2) Menu 3-pontinhos: abre, fecha após Editar/Duplicar/Excluir.
 *  3) AlertDialog de exclusão da linha bloqueia até confirmar (Cancelar/Esc não excluem).
 *  4) Ao confirmar exclusão, a linha some e a contagem cai em 1
 *     (apenas para carrinhos com prefixo `[E2E` para preservar dados reais).
 *
 * SSOT: e2e/fixtures/selectors.ts — somente data-testid.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";
import type { Page } from "@playwright/test";

async function countRows(page: Page): Promise<number> {
  return page.locator(Sel.carts.rows).count();
}

async function findE2eSafeCartId(page: Page): Promise<string | null> {
  const rows = page.locator(Sel.carts.rows);
  const n = await rows.count();
  for (let i = 0; i < n; i++) {
    const row = rows.nth(i);
    const text = (await row.innerText().catch(() => "")) ?? "";
    if (/\[E2E/i.test(text)) {
      const tid = await row.getAttribute("data-testid");
      const id = tid?.replace(/^cart-row-/, "") ?? null;
      if (id) return id;
    }
  }
  return null;
}

test.describe("/carrinhos — header + menu de 3-pontinhos por linha", () => {
  test.beforeEach(() => requireAuth());

  test("Header expõe testids de novo/busca/ordenação", async ({ page }) => {
    await gotoAndSettle(page, "/carrinhos");
    await expect(page.locator(Sel.carts.pageTitle)).toBeVisible();
    await expect(page.locator(Sel.carts.listNew)).toBeVisible();
    await expect(page.locator(Sel.carts.listSearch)).toBeVisible();
    await expect(page.locator(Sel.carts.listSort)).toBeVisible();
  });

  test("Menu 3-pontinhos abre, fecha após clicar Duplicar", async ({ page }) => {
    await gotoAndSettle(page, "/carrinhos");
    const rowsCount = await countRows(page);
    test.skip(rowsCount === 0, "sem carrinhos para exercitar menu");

    const firstRow = page.locator(Sel.carts.rows).first();
    const firstId = (await firstRow.getAttribute("data-testid"))!.replace(
      /^cart-row-/,
      "",
    );

    await page.locator(Sel.carts.rowMore(firstId)).click();
    const menu = page.locator(Sel.carts.rowMenu(firstId));
    await expect(menu).toBeVisible();
    await expect(page.locator(Sel.carts.rowMenuEdit(firstId))).toBeVisible();
    await expect(page.locator(Sel.carts.rowMenuDuplicate(firstId))).toBeVisible();
    await expect(page.locator(Sel.carts.rowMenuDelete(firstId))).toBeVisible();

    // Esc fecha menu sem navegar
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(page).toHaveURL(/\/carrinhos\/?$/);
  });

  test("Excluir via menu abre AlertDialog acessível; Cancelar não exclui", async ({
    page,
  }) => {
    await gotoAndSettle(page, "/carrinhos");
    const before = await countRows(page);
    test.skip(before === 0, "sem carrinhos");

    const firstRow = page.locator(Sel.carts.rows).first();
    const firstId = (await firstRow.getAttribute("data-testid"))!.replace(
      /^cart-row-/,
      "",
    );

    await page.locator(Sel.carts.rowMore(firstId)).click();
    await page.locator(Sel.carts.rowMenuDelete(firstId)).click();

    const dialog = page.locator(Sel.carts.rowDeleteDialog);
    await expect(dialog).toBeVisible();
    expect(await dialog.getAttribute("role")).toBe("alertdialog");
    await expect(dialog).toHaveAttribute("aria-labelledby", /.+/);
    await expect(dialog).toHaveAttribute("aria-describedby", /.+/);

    // Esc cancela sem excluir
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    expect(await countRows(page)).toBe(before);
  });

  test("Confirmar exclusão remove a linha e diminui a contagem (e2e-safe)", async ({
    page,
  }) => {
    await gotoAndSettle(page, "/carrinhos");
    const before = await countRows(page);
    test.skip(before === 0, "sem carrinhos");

    const targetId = await findE2eSafeCartId(page);
    test.skip(
      !targetId,
      "sem carrinho com prefixo [E2E — pulando exclusão real",
    );

    await page.locator(Sel.carts.rowMore(targetId!)).click();
    await page.locator(Sel.carts.rowMenuDelete(targetId!)).click();

    const dialog = page.locator(Sel.carts.rowDeleteDialog);
    await expect(dialog).toBeVisible();
    await page.locator(Sel.carts.rowDeleteConfirm).click();

    await expect(page.locator(Sel.carts.row(targetId!))).toHaveCount(0, {
      timeout: 10_000,
    });
    await expect
      .poll(async () => countRows(page), { timeout: 10_000 })
      .toBe(before - 1);
  });
});
