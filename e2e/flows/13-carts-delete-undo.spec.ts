/**
 * E2E — Exclusão de Carrinhos com Desfazer.
 *
 * Cobre paridade com Orçamentos (04o/04p) para o módulo Carrinhos:
 *   A. Excluir 1 pela linha → toast "Desfazer" único → clicar restaura.
 *   B. Excluir 3 em lote → toast "N carrinhos excluídos" único → restaura todos.
 *   C. Excluir pelo popover do header → toast "Desfazer" → restaura.
 *   D. Sem clicar em Desfazer (8s+): toast some, DELETE persiste, sem duplicatas.
 *
 * Guarda anti-regressão do copy do ConfirmDialog: proíbe "Esta ação não pode
 * ser desfeita" (copy antigo) e exige o novo padrão SSOT.
 *
 * Interceptação: page.route() em /rest/v1/seller_carts para simular DELETE 204
 * e POST 201 sem tocar dados reais. Usa o helper `mockSellerCartsAPI`.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { mockSellerCartsAPI, makeMockCart, type MockCart } from "../helpers/cart-mock";

test.use({ trace: "retain-on-failure", screenshot: "only-on-failure" });

const SELLER_CARTS_REST = /\/rest\/v1\/seller_carts(\?|$)/;
const SELLER_CART_ITEMS_REST = /\/rest\/v1\/seller_cart_items(\?|$)/;
const UNDO_TOAST = '[data-testid="undo-toast"]';
const UNDO_BTN = '[data-testid="undo-toast-button"]';

/**
 * Semeia N carrinhos mockados e devolve o array + captura POSTs/DELETEs
 * emitidos pela app, para asserções de contagem no fluxo Undo.
 */
async function primeCarts(page: import("@playwright/test").Page, count: number) {
  const carts = Array.from({ length: count }, (_, i) => makeMockCart(i, 2));
  await mockSellerCartsAPI(page, carts);

  const calls = { delete: 0, cartInsert: 0, itemInsert: 0 };
  await page.route(SELLER_CARTS_REST, async (route, request) => {
    if (request.method() === "DELETE") {
      calls.delete += 1;
      await route.fulfill({
        status: 204,
        body: "",
        headers: { "Content-Range": "0-0/1" },
      });
      return;
    }
    if (request.method() === "POST") {
      calls.cartInsert += 1;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify([{ id: `restored-${calls.cartInsert}`, seller_id: "mock-seller-id" }]),
      });
      return;
    }
    await route.continue();
  });
  await page.route(SELLER_CART_ITEMS_REST, async (route, request) => {
    if (request.method() === "POST") {
      calls.itemInsert += 1;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
      return;
    }
    await route.continue();
  });

  return { carts, calls };
}

test.describe("Carrinhos: exclusão com Desfazer (paridade com Orçamentos)", () => {
  test.beforeEach(() => {
    requireAuth();
  });

  test("A — excluir 1 carrinho pela linha → toast Desfazer → restaura", async ({ page }) => {
    const { calls } = await primeCarts(page, 3);
    await gotoAndSettle(page, "/carrinhos");

    // Abre menu de ações da 1ª linha e dispara "Excluir".
    const firstRowMenu = page.locator('[aria-label*="Ações"], [data-testid^="cart-row-menu-"]').first();
    if (await firstRowMenu.count()) {
      await firstRowMenu.click();
      await page.getByRole("menuitem", { name: /excluir/i }).first().click();
    } else {
      // Fallback: acha o botão Excluir diretamente
      await page.getByRole("button", { name: /excluir/i }).first().click();
    }

    // Copy SSOT do diálogo (guarda anti-regressão)
    const dialog = page.getByTestId("cart-row-delete-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(
      "O carrinho será removido — você pode desfazer por até 8 segundos após a confirmação.",
    );
    await expect(dialog).not.toContainText("Esta ação não pode ser desfeita");

    // Confirma
    await dialog.getByRole("button", { name: /confirmar exclusão|excluir/i }).click();

    await expect.poll(() => calls.delete, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);

    // Toast Desfazer único
    await expect(page.locator(UNDO_TOAST)).toBeVisible({ timeout: 6_000 });
    await expect(page.locator(UNDO_TOAST)).toHaveCount(1);
    const btn = page.locator(UNDO_BTN);
    await expect(btn).toHaveCount(1);
    await expect(btn).toHaveAttribute("aria-label", /desfazer/i);

    // Clica Desfazer → dispara POST em seller_carts (recria carrinho).
    await btn.click();
    await expect.poll(() => calls.cartInsert, { timeout: 8_000 }).toBeGreaterThanOrEqual(1);
  });

  test("B — excluir 3 em lote → 1 toast → restaura os 3", async ({ page }) => {
    const { calls } = await primeCarts(page, 3);
    await gotoAndSettle(page, "/carrinhos");

    // Entra em modo de seleção
    await page.getByRole("button", { name: /selecionar/i }).first().click();

    const rowCheckboxes = page.getByRole("checkbox", {
      name: /selecionar carrinho|selecionar linha/i,
    });
    await expect(rowCheckboxes.first()).toBeVisible({ timeout: 8_000 });
    const count = await rowCheckboxes.count();
    for (let i = 0; i < Math.min(count, 3); i += 1) {
      await rowCheckboxes.nth(i).click();
    }

    // Aciona bulk delete
    await page.getByRole("button", { name: /excluir 3/i }).click();

    const bulkDialog = page.getByTestId("carts-bulk-delete-dialog");
    await expect(bulkDialog).toBeVisible();
    await expect(bulkDialog).toContainText(
      "Os carrinhos serão removidos — você pode desfazer por até 8 segundos após a confirmação.",
    );
    await expect(bulkDialog).not.toContainText("Esta ação não pode ser desfeita");

    await bulkDialog.getByRole("button", { name: /excluir/i }).click();

    // Aguarda os 3 DELETEs
    await expect.poll(() => calls.delete, { timeout: 15_000 }).toBeGreaterThanOrEqual(3);

    // UM ÚNICO toast agregado
    await expect(page.locator(UNDO_TOAST)).toBeVisible({ timeout: 6_000 });
    await expect(page.locator(UNDO_TOAST)).toHaveCount(1);
    await expect(page.locator(UNDO_TOAST)).toContainText(/3 carrinhos excluídos/i);

    await page.locator(UNDO_BTN).click();
    await expect.poll(() => calls.cartInsert, { timeout: 10_000 }).toBeGreaterThanOrEqual(3);
  });

  test("C — excluir pelo popover do CartHeaderButton → toast Desfazer → restaura", async ({ page }) => {
    const { calls } = await primeCarts(page, 2);
    // Qualquer rota que renderiza o header serve; usamos /carrinhos para reaproveitar o mock.
    await gotoAndSettle(page, "/carrinhos");

    // Abre o popover do carrinho no header
    const trigger = page.getByTestId("cart-trigger");
    await expect(trigger).toBeVisible({ timeout: 8_000 });
    await trigger.click();

    // Aguarda o drawer/popover renderizar e localiza o botão de excluir de um carrinho.
    // `cart-delete-${id}` é o testId estável do botão no popover.
    const drawer = page.getByTestId("cart-drawer");
    await expect(drawer).toBeVisible({ timeout: 6_000 });
    const deleteBtn = drawer.locator('[data-testid^="cart-delete-mock-cart-"]').first();
    await expect(deleteBtn).toBeVisible({ timeout: 6_000 });
    await deleteBtn.click();

    // AlertDialog do header (testId != cart-row-delete-dialog): usa `cart-delete-dialog`
    const dialog = page.getByTestId("cart-delete-dialog");
    await expect(dialog).toBeVisible({ timeout: 6_000 });
    // Copy SSOT — deve conter "você pode desfazer por até 8 segundos"
    await expect(dialog.getByTestId("cart-delete-dialog-description")).toContainText(
      /você pode desfazer por até 8 segundos após a confirmação/i,
    );
    await expect(dialog).not.toContainText("Esta ação não pode ser desfeita");

    // Confirma
    await page.getByTestId("cart-delete-confirm").click();

    // DELETE efetivado
    await expect.poll(() => calls.delete, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);

    // Toast Desfazer único (título singular)
    await expect(page.locator(UNDO_TOAST)).toBeVisible({ timeout: 6_000 });
    await expect(page.locator(UNDO_TOAST)).toHaveCount(1);
    await expect(page.locator(UNDO_TOAST)).toContainText(/Carrinho excluído/);
    // Descrição do toast padronizada com tempo (SSOT)
    await expect(page.locator(UNDO_TOAST)).toContainText(/você pode desfazer por até 8 segundos/i);

    // Clica Desfazer → dispara POST de restore
    const btn = page.locator(UNDO_BTN);
    await expect(btn).toHaveCount(1);
    await btn.click();
    await expect.poll(() => calls.cartInsert, { timeout: 8_000 }).toBeGreaterThanOrEqual(1);
    await expect(page.getByText(/Carrinho restaurado\./)).toBeVisible({ timeout: 6_000 });
  });


  test("D — sem clicar em Desfazer (>8s) toast some, DELETE persiste, sem duplicatas", async ({ page }) => {
    const { calls } = await primeCarts(page, 3);
    await gotoAndSettle(page, "/carrinhos");

    // Bulk delete rápido: seleciona 1 e confirma
    await page.getByRole("button", { name: /selecionar/i }).first().click();
    const rowCheckboxes = page.getByRole("checkbox", {
      name: /selecionar carrinho|selecionar linha/i,
    });
    await rowCheckboxes.first().click();
    await page.getByRole("button", { name: /excluir 1/i }).click();

    const bulkDialog = page.getByTestId("carts-bulk-delete-dialog");
    await bulkDialog.getByRole("button", { name: /excluir/i }).click();

    await expect(page.locator(UNDO_TOAST)).toBeVisible({ timeout: 6_000 });
    const deletesAfterUx = calls.delete;

    // Aguarda o toast expirar (8s + folga)
    await page.waitForTimeout(9_000);
    await expect(page.locator(UNDO_TOAST)).toHaveCount(0);
    // Nenhum POST de restore após o timeout
    expect(calls.cartInsert).toBe(0);
    // Nenhum DELETE adicional
    expect(calls.delete).toBe(deletesAfterUx);
  });

  test("E — bulk delete com falha parcial no POST de restore → só restaura o que deu certo e copy 'restaurado(s)/falhou(aram)'", async ({ page }) => {
    // Semeia 3 carrinhos e intercepta o POST de restore para que APENAS 2 dos 3
    // insertes sejam bem-sucedidos. Regra: cartInsert #2 responde 500 → o
    // restore reporta "2 restaurado(s), 1 falhou(aram)" (toast warning) e
    // NÃO faz retry silencioso do que falhou.
    const carts = Array.from({ length: 3 }, (_, i) => makeMockCart(i, 2));
    await mockSellerCartsAPI(page, carts);

    const calls = { delete: 0, cartInsertOk: 0, cartInsertFail: 0 };
    await page.route(SELLER_CARTS_REST, async (route, request) => {
      if (request.method() === "DELETE") {
        calls.delete += 1;
        await route.fulfill({ status: 204, body: "", headers: { "Content-Range": "0-0/1" } });
        return;
      }
      if (request.method() === "POST") {
        // 1º e 3º POST → 201, 2º → 500 (falha parcial)
        const totalPost = calls.cartInsertOk + calls.cartInsertFail + 1;
        if (totalPost === 2) {
          calls.cartInsertFail += 1;
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ message: "simulated failure" }),
          });
          return;
        }
        calls.cartInsertOk += 1;
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify([{ id: `restored-${totalPost}`, seller_id: "mock-seller-id" }]),
        });
        return;
      }
      await route.continue();
    });
    await page.route(SELLER_CART_ITEMS_REST, async (route, request) => {
      if (request.method() === "POST") {
        await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify([]) });
        return;
      }
      await route.continue();
    });

    await gotoAndSettle(page, "/carrinhos");

    await page.getByRole("button", { name: /selecionar/i }).first().click();
    const rowCheckboxes = page.getByRole("checkbox", {
      name: /selecionar carrinho|selecionar linha/i,
    });
    await expect(rowCheckboxes.first()).toBeVisible({ timeout: 8_000 });
    for (let i = 0; i < 3; i += 1) {
      await rowCheckboxes.nth(i).click();
    }
    await page.getByRole("button", { name: /excluir 3/i }).click();

    const bulkDialog = page.getByTestId("carts-bulk-delete-dialog");
    await bulkDialog.getByRole("button", { name: /excluir/i }).click();

    // 3 DELETEs efetivados
    await expect.poll(() => calls.delete, { timeout: 15_000 }).toBeGreaterThanOrEqual(3);
    await expect(page.locator(UNDO_TOAST)).toBeVisible({ timeout: 6_000 });

    // Aciona Desfazer
    await page.locator(UNDO_BTN).click();

    // Aguarda os 3 POSTs (2 ok + 1 falha) — o restore NÃO faz retry silencioso.
    await expect
      .poll(() => calls.cartInsertOk + calls.cartInsertFail, { timeout: 10_000 })
      .toBe(3);
    expect(calls.cartInsertOk).toBe(2);
    expect(calls.cartInsertFail).toBe(1);

    // Copy do toast agregado: "2 restaurado(s), 1 falhou(aram)."
    // Sonner renderiza o toast fora do UNDO_TOAST — buscamos pelo texto.
    await expect(page.getByText(/2 restaurado\(s\), 1 falhou\(aram\)\./)).toBeVisible({
      timeout: 6_000,
    });
    // NUNCA vaza a copy de "todos restaurados" quando houve falha parcial.
    await expect(page.locator("body")).not.toContainText(/3 carrinhos restaurados/);
  });

  test("F — falha parcial no undo do popover (CartHeaderButton) → toast de erro e nada indevidamente restaurado", async ({ page }) => {
    // Semeia 2 carrinhos e intercepta o POST de restore com falha 500.
    // No popover só deletamos 1 carrinho → o restore falha inteiro; o toast
    // deve refletir a falha e o carrinho NÃO deve aparecer como restaurado.
    const carts = Array.from({ length: 2 }, (_, i) => makeMockCart(i, 2));
    await mockSellerCartsAPI(page, carts);

    const calls = { delete: 0, cartInsertOk: 0, cartInsertFail: 0 };
    await page.route(SELLER_CARTS_REST, async (route, request) => {
      if (request.method() === "DELETE") {
        calls.delete += 1;
        await route.fulfill({ status: 204, body: "", headers: { "Content-Range": "0-0/1" } });
        return;
      }
      if (request.method() === "POST") {
        calls.cartInsertFail += 1;
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "simulated restore failure" }),
        });
        return;
      }
      await route.continue();
    });
    await page.route(SELLER_CART_ITEMS_REST, async (route) => {
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify([]) });
    });

    await gotoAndSettle(page, "/carrinhos");

    const trigger = page.getByTestId("cart-trigger");
    await expect(trigger).toBeVisible({ timeout: 8_000 });
    await trigger.click();

    const drawer = page.getByTestId("cart-drawer");
    await expect(drawer).toBeVisible({ timeout: 6_000 });
    const deleteBtn = drawer.locator('[data-testid^="cart-delete-mock-cart-"]').first();
    await deleteBtn.click();

    const dialog = page.getByTestId("cart-delete-dialog");
    await expect(dialog).toBeVisible({ timeout: 6_000 });
    await page.getByTestId("cart-delete-confirm").click();

    await expect.poll(() => calls.delete, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
    await expect(page.locator(UNDO_TOAST)).toBeVisible({ timeout: 6_000 });

    // Screenshot baseline: toast pós-delete no popover.
    await page.locator(UNDO_TOAST).screenshot({ path: "test-results/13-carts-undo/F-toast-before-undo.png" });

    // Clica Desfazer → POST falha
    await page.locator(UNDO_BTN).click();
    await expect.poll(() => calls.cartInsertFail, { timeout: 8_000 }).toBeGreaterThanOrEqual(1);
    expect(calls.cartInsertOk).toBe(0);

    // Toast de erro (não deve exibir "restaurado" como sucesso total)
    await expect(page.getByText(/falhou|erro|não foi possível/i).first()).toBeVisible({
      timeout: 6_000,
    });
    await expect(page.locator("body")).not.toContainText(/Carrinho restaurado\./);

    await page.screenshot({ path: "test-results/13-carts-undo/F-after-failed-undo.png" });
  });

  test("G — botão Desfazer fica inerte após 8s (linha, bulk e popover) sem novos POSTs", async ({ page }) => {
    // Cenário G1: exclusão pela linha
    {
      const { calls } = await primeCarts(page, 2);
      await gotoAndSettle(page, "/carrinhos");

      const firstRowMenu = page.locator('[aria-label*="Ações"], [data-testid^="cart-row-menu-"]').first();
      if (await firstRowMenu.count()) {
        await firstRowMenu.click();
        await page.getByRole("menuitem", { name: /excluir/i }).first().click();
      } else {
        await page.getByRole("button", { name: /excluir/i }).first().click();
      }
      const dialog = page.getByTestId("cart-row-delete-dialog");
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: /confirmar exclusão|excluir/i }).click();

      const btn = page.locator(UNDO_BTN);
      await expect(btn).toBeVisible({ timeout: 6_000 });
      await page.locator(UNDO_TOAST).screenshot({ path: "test-results/13-carts-undo/G1-row-toast.png" });

      // Aguarda 8.5s para o toast expirar
      await page.waitForTimeout(8_500);
      await expect(page.locator(UNDO_TOAST)).toHaveCount(0);

      // Tenta clicar no botão remanescente (força, ignora visibilidade) — não deve disparar restore
      const insertsBefore = calls.cartInsert;
      await btn.click({ force: true, timeout: 1_000 }).catch(() => {});
      await page.waitForTimeout(1_000);
      expect(calls.cartInsert).toBe(insertsBefore);
    }

    // Cenário G2: bulk
    {
      const { calls } = await primeCarts(page, 3);
      await gotoAndSettle(page, "/carrinhos");

      await page.getByRole("button", { name: /selecionar/i }).first().click();
      const rowCheckboxes = page.getByRole("checkbox", {
        name: /selecionar carrinho|selecionar linha/i,
      });
      await expect(rowCheckboxes.first()).toBeVisible({ timeout: 8_000 });
      await rowCheckboxes.nth(0).click();
      await rowCheckboxes.nth(1).click();
      await page.getByRole("button", { name: /excluir 2/i }).click();
      const bulkDialog = page.getByTestId("carts-bulk-delete-dialog");
      await bulkDialog.getByRole("button", { name: /excluir/i }).click();

      await expect(page.locator(UNDO_TOAST)).toBeVisible({ timeout: 6_000 });
      await page.locator(UNDO_TOAST).screenshot({ path: "test-results/13-carts-undo/G2-bulk-toast.png" });

      await page.waitForTimeout(8_500);
      await expect(page.locator(UNDO_TOAST)).toHaveCount(0);
      const insertsBefore = calls.cartInsert;
      await page.locator(UNDO_BTN).click({ force: true, timeout: 1_000 }).catch(() => {});
      await page.waitForTimeout(1_000);
      expect(calls.cartInsert).toBe(insertsBefore);
    }

    // Cenário G3: popover
    {
      const { calls } = await primeCarts(page, 2);
      await gotoAndSettle(page, "/carrinhos");

      const trigger = page.getByTestId("cart-trigger");
      await trigger.click();
      const drawer = page.getByTestId("cart-drawer");
      await expect(drawer).toBeVisible({ timeout: 6_000 });
      await drawer.locator('[data-testid^="cart-delete-mock-cart-"]').first().click();
      await expect(page.getByTestId("cart-delete-dialog")).toBeVisible({ timeout: 6_000 });
      await page.getByTestId("cart-delete-confirm").click();

      await expect(page.locator(UNDO_TOAST)).toBeVisible({ timeout: 6_000 });
      await page.locator(UNDO_TOAST).screenshot({ path: "test-results/13-carts-undo/G3-popover-toast.png" });

      await page.waitForTimeout(8_500);
      await expect(page.locator(UNDO_TOAST)).toHaveCount(0);
      const insertsBefore = calls.cartInsert;
      await page.locator(UNDO_BTN).click({ force: true, timeout: 1_000 }).catch(() => {});
      await page.waitForTimeout(1_000);
      expect(calls.cartInsert).toBe(insertsBefore);
    }
  });

  test("H — sem toasts duplicados no timeout (contagem = 0 após 8.5s em todos os fluxos)", async ({ page }) => {
    await primeCarts(page, 3);
    await gotoAndSettle(page, "/carrinhos");

    // Fluxo 1: linha
    const firstRowMenu = page.locator('[aria-label*="Ações"], [data-testid^="cart-row-menu-"]').first();
    if (await firstRowMenu.count()) {
      await firstRowMenu.click();
      await page.getByRole("menuitem", { name: /excluir/i }).first().click();
    } else {
      await page.getByRole("button", { name: /excluir/i }).first().click();
    }
    await page
      .getByTestId("cart-row-delete-dialog")
      .getByRole("button", { name: /confirmar exclusão|excluir/i })
      .click();

    await expect(page.locator(UNDO_TOAST)).toHaveCount(1, { timeout: 6_000 });
    await page.waitForTimeout(8_500);
    // Após timeout: nenhum toast Desfazer restante
    await expect(page.locator(UNDO_TOAST)).toHaveCount(0);

    // Screenshot final — estado sem toasts duplicados.
    await page.screenshot({ path: "test-results/13-carts-undo/H-after-timeout.png" });

    // Confirma que a região de toasts do sonner não tem toasts remanescentes
    // com texto de undo (evita duplicatas em fila).
    const anyUndo = page.getByText(/você pode desfazer por até 8 segundos/i);
    await expect(anyUndo).toHaveCount(0);
  });
});
