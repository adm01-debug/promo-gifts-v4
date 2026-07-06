/**
 * Fluxo: /carrinhos — Duplicar, a11y de teclado no menu 3-pontinhos e estado vazio.
 *
 * Cobre:
 *  1) Duplicar via menu: clica em Duplicar, menu fecha, contagem de linhas
 *     aumenta em 1 e um novo `[E2E` aparece (apenas quando existe um carrinho
 *     e2e-safe para não impactar dados reais).
 *  2) A11y: abre menu 3-pontinhos com Enter no trigger, navega com ArrowDown,
 *     fecha com Esc e o foco volta para o trigger.
 *  3) Estado vazio: quando `carts.length === 0` mostra `carts-empty-none`.
 *     Quando existem carrinhos mas a busca não bate, mostra `carts-empty-filtered`
 *     e o header (busca/ordenação) segue visível e funcional.
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

test.describe("/carrinhos — duplicar + a11y + estado vazio", () => {
  test.beforeEach(() => requireAuth());

  test("Duplicar via menu fecha o menu e aumenta a contagem (e2e-safe)", async ({
    page,
  }) => {
    await gotoAndSettle(page, "/carrinhos");
    const before = await countRows(page);
    test.skip(before === 0, "sem carrinhos");

    const targetId = await findE2eSafeCartId(page);
    test.skip(
      !targetId,
      "sem carrinho [E2E — pulando duplicação real para preservar dados",
    );

    await page.locator(Sel.carts.rowMore(targetId!)).click();
    const menu = page.locator(Sel.carts.rowMenu(targetId!));
    await expect(menu).toBeVisible();

    await page.locator(Sel.carts.rowMenuDuplicate(targetId!)).click();
    await expect(menu).toHaveCount(0);

    await expect
      .poll(async () => countRows(page), { timeout: 10_000 })
      .toBe(before + 1);
  });

  test("A11y: menu 3-pontinhos abre/fecha com teclado e devolve foco", async ({
    page,
  }) => {
    await gotoAndSettle(page, "/carrinhos");
    const rowsCount = await countRows(page);
    test.skip(rowsCount === 0, "sem carrinhos");

    const firstRow = page.locator(Sel.carts.rows).first();
    const firstId = (await firstRow.getAttribute("data-testid"))!.replace(
      /^cart-row-/,
      "",
    );

    const trigger = page.locator(Sel.carts.rowMore(firstId));
    await trigger.focus();
    await expect(trigger).toBeFocused();

    // Enter abre o menu (Radix DropdownMenu)
    await page.keyboard.press("Enter");
    const menu = page.locator(Sel.carts.rowMenu(firstId));
    await expect(menu).toBeVisible();

    // Radix move o foco para o primeiro item ao abrir por teclado
    const focusInsideMenu = await page.evaluate((sel) => {
      const m = document.querySelector(sel);
      return !!m && m.contains(document.activeElement);
    }, `[data-testid="cart-row-menu-${firstId}"]`);
    expect(focusInsideMenu).toBe(true);

    // Navega para o próximo item
    await page.keyboard.press("ArrowDown");
    const stillInside = await page.evaluate((sel) => {
      const m = document.querySelector(sel);
      return !!m && m.contains(document.activeElement);
    }, `[data-testid="cart-row-menu-${firstId}"]`);
    expect(stillInside).toBe(true);

    // Esc fecha e devolve o foco ao trigger
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("Estado vazio filtrado: header (busca/ordenação) segue visível", async ({
    page,
  }) => {
    await gotoAndSettle(page, "/carrinhos");
    await expect(page.locator(Sel.carts.pageTitle)).toBeVisible();

    // Se não há nenhum carrinho no banco, valida o empty state absoluto
    if ((await countRows(page)) === 0) {
      await expect(page.locator(Sel.carts.emptyNone)).toBeVisible();
      // Header continua com busca e ordenação disponíveis
      await expect(page.locator(Sel.carts.listSearch)).toBeVisible();
      await expect(page.locator(Sel.carts.listSort)).toBeVisible();
      await expect(page.locator(Sel.carts.listNew)).toBeVisible();
      return;
    }

    // Força "nenhum encontrado" digitando algo improvável na busca
    const search = page.locator(Sel.carts.listSearch);
    await search.fill("zzz-e2e-no-match-" + Date.now());

    await expect(page.locator(Sel.carts.emptyFiltered)).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.locator(Sel.carts.rows)).toHaveCount(0);

    // Header (busca + ordenação + novo) segue visível
    await expect(search).toBeVisible();
    await expect(page.locator(Sel.carts.listSort)).toBeVisible();
    await expect(page.locator(Sel.carts.listNew)).toBeVisible();

    // Limpar busca restaura a lista
    await search.fill("");
    await expect(page.locator(Sel.carts.emptyFiltered)).toHaveCount(0);
    await expect
      .poll(async () => countRows(page), { timeout: 5_000 })
      .toBeGreaterThan(0);
  });
});
