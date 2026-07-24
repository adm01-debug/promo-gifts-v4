/**
 * Fluxo: /carrinhos — modo de seleção múltipla + Esc + exclusão em lote
 *
 * Cobre:
 *  1) Toggle do modo de seleção (aria-pressed + checkboxes visíveis).
 *  2) Atalho de teclado Esc → sai do modo e limpa marcações.
 *  3) Selecionar 1 carrinho → botão "Excluir (N)" aparece com aria-label correto.
 *  4) Abrir AlertDialog de confirmação → foco vai para dentro do dialog
 *     (foco fica em elemento com role=alertdialog ou seu descendente),
 *     Esc/Cancelar fecha sem excluir, e o AlertDialog tem título/descrição
 *     associados (aria-labelledby/aria-describedby via Radix).
 *  5) Confirmar exclusão → linha some da tabela (poll com timeout).
 *
 * Política: SSOT em e2e/fixtures/selectors.ts — somente data-testid.
 * A destruição real (passo 5) é feita apenas em UM carrinho previamente
 * detectado como "e2e-name" (prefixo `[E2E`) para não impactar dados
 * reais do banco canônico. Caso não haja carrinho e2e-safe, o passo 5 é
 * pulado com test.skip preservando as validações de UX/A11y (1-4).
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";
import type { Page } from "@playwright/test";

async function countRows(page: Page): Promise<number> {
  return page.locator(Sel.carts.rows).count();
}

/**
 * Retorna o cart id de uma linha cujo texto começa com o prefixo `[E2E`
 * (criada por um spec anterior). Devolve null quando não achar — nesse
 * caso o passo de exclusão real é pulado.
 */
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

test.describe("/carrinhos — seleção múltipla + Esc + exclusão em lote", () => {
  test.beforeEach(() => requireAuth());

  test("Esc sai do modo de seleção e limpa marcações", async ({ page }) => {
    await gotoAndSettle(page, "/carrinhos");
    await expect(page.locator(Sel.carts.pageTitle)).toBeVisible();

    const rowsCount = await countRows(page);
    test.skip(rowsCount === 0, "sem carrinhos na lista para exercitar seleção");

    const toggle = page.locator(Sel.carts.selectToggle);
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");

    // Cabeçalho da coluna checkbox "selecionar todos" agora está visível
    await expect(page.locator(Sel.carts.selectAll)).toBeVisible();

    // Seleciona a primeira linha via checkbox
    const firstRow = page.locator(Sel.carts.rows).first();
    const firstTid = await firstRow.getAttribute("data-testid");
    const firstId = firstTid!.replace(/^cart-row-/, "");
    await page.locator(Sel.carts.rowCheckbox(firstId)).click();

    // Botão "Excluir (N)" aparece com aria-label falando em "carrinho selecionado"
    const bulk = page.locator(Sel.carts.bulkDeleteTop);
    await expect(bulk).toBeVisible();
    await expect(bulk).toHaveAttribute(
      "aria-label",
      /Excluir 1 carrinho selecionado/i,
    );

    // Pressiona Esc no body → sai do modo e limpa seleção
    await page.locator("body").focus();
    await page.keyboard.press("Escape");

    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(Sel.carts.selectAll)).toHaveCount(0);
    await expect(bulk).toHaveCount(0);
  });

  test("Selecionar → Excluir abre AlertDialog acessível; Cancelar não exclui", async ({
    page,
  }) => {
    await gotoAndSettle(page, "/carrinhos");
    const rowsCount = await countRows(page);
    test.skip(rowsCount === 0, "sem carrinhos para selecionar");

    await page.locator(Sel.carts.selectToggle).click();

    const firstRow = page.locator(Sel.carts.rows).first();
    const firstId = (await firstRow.getAttribute("data-testid"))!.replace(
      /^cart-row-/,
      "",
    );
    await page.locator(Sel.carts.rowCheckbox(firstId)).click();

    await page.locator(Sel.carts.bulkDeleteTop).click();

    const dialog = page.locator(Sel.carts.bulkDeleteDialog);
    await expect(dialog).toBeVisible();

    // A11y do AlertDialog (Radix): role=alertdialog + aria-labelledby + aria-describedby
    const role = await dialog.getAttribute("role");
    expect(role).toBe("alertdialog");
    await expect(dialog).toHaveAttribute("aria-labelledby", /.+/);
    await expect(dialog).toHaveAttribute("aria-describedby", /.+/);

    // Foco está dentro do dialog (Radix move o foco automaticamente)
    const focusInsideDialog = await page.evaluate(() => {
      const dlg = document.querySelector(
        '[data-testid="carts-bulk-delete-dialog"]',
      );
      return !!dlg && dlg.contains(document.activeElement);
    });
    expect(focusInsideDialog).toBe(true);

    // Esc fecha o dialog SEM excluir
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    // Ainda em modo de seleção com a linha marcada
    await expect(page.locator(Sel.carts.selectToggle)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator(Sel.carts.bulkDeleteTop)).toBeVisible();

    // Contagem de linhas não mudou
    expect(await countRows(page)).toBe(rowsCount);
  });

  test("Confirmar exclusão remove o carrinho (apenas para carrinhos e2e-safe)", async ({
    page,
  }) => {
    await gotoAndSettle(page, "/carrinhos");
    const before = await countRows(page);
    test.skip(before === 0, "sem carrinhos");

    const targetId = await findE2eSafeCartId(page);
    test.skip(
      !targetId,
      "sem carrinho com prefixo [E2E — pulando exclusão real para preservar dados manuais",
    );

    await page.locator(Sel.carts.selectToggle).click();
    await page.locator(Sel.carts.rowCheckbox(targetId!)).click();
    await page.locator(Sel.carts.bulkDeleteTop).click();

    const dialog = page.locator(Sel.carts.bulkDeleteDialog);
    await expect(dialog).toBeVisible();

    await page.locator(Sel.carts.bulkDeleteConfirm).click();

    // Toast de sucesso aparece
    await expect(page.locator("[data-sonner-toast]").first()).toBeVisible({
      timeout: 8_000,
    });

    // Linha alvo some
    await expect(page.locator(Sel.carts.row(targetId!))).toHaveCount(0, {
      timeout: 10_000,
    });

    // Sai do modo de seleção após excluir
    await expect(page.locator(Sel.carts.selectToggle)).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
