/**
 * Fluxo: exclusão de carrinho — sucesso, indicador de carregamento, foco e
 * proteção contra cliques duplicados.
 *
 * Cobre:
 *  1. Sucesso: após confirmar, o carrinho some da lista e a chave
 *     `seller:active-cart-id:<userId>` no localStorage é limpa (removida) —
 *     independente do id ainda estar em `carts[]` (o contexto só limpa quando
 *     `activeCartId === cartId`).
 *  2. Durante o DELETE em voo, o botão "Excluir" fica `disabled`, muda para
 *     "Excluindo…" e exibe um spinner (`data-testid="cart-delete-loading"`).
 *     O botão "Cancelar" também fica desabilitado. Cliques adicionais são
 *     ignorados (não há segundo DELETE).
 *  3. Foco: ao cancelar o AlertDialog, o foco volta para o botão de lixeira
 *     que abriu o dialog (contrato do Radix AlertDialog).
 *  4. Rapid-fire: cliques repetidos e velozes no "Excluir" disparam apenas
 *     um único DELETE por tentativa (o segundo clique é ignorado enquanto
 *     o botão está desabilitado / mutation em voo).
 */
import { test, expect, requireAuth } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';
import { mockSellerCartsAPI, makeMockCart, type MockCart } from '../helpers/cart-mock';
import { openCartPopover } from '../helpers/cart-fixture';
import type { Page, Route } from '@playwright/test';

interface Harness {
  carts: MockCart[];
  attempts: () => number;
  deletedIds: () => string[];
}

/**
 * Semeia dois carrinhos e intercepta DELETE com atraso configurável, respondendo
 * 204 e removendo do array local para o refetch subsequente refletir a lista real.
 */
async function seedWithDelayedDelete(
  page: Page,
  opts: { delayMs?: number; status?: number } = {},
): Promise<Harness> {
  const { delayMs = 400, status = 204 } = opts;
  const carts = [makeMockCart(0, 2), makeMockCart(1, 2)];
  await mockSellerCartsAPI(page, carts);

  let attempts = 0;
  const deleted: string[] = [];

  await page.route('**/rest/v1/seller_carts**', async (route: Route) => {
    const req = route.request();
    if (req.method() !== 'DELETE') return route.continue();
    attempts += 1;
    const m = req.url().match(/id=eq\.([^&]+)/);
    const id = m?.[1];
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    if (status < 300 && id) {
      deleted.push(id);
      const idx = carts.findIndex((c) => c.id === id);
      if (idx >= 0) carts.splice(idx, 1);
    }
    return route.fulfill({
      status: status < 300 ? 200 : status,
      contentType: 'application/json',
      headers: { 'X-Mock-Source': 'cart-delete-success-loading-focus-spec' },
      body: status < 300 ? JSON.stringify([{ id }]) : JSON.stringify({ message: 'boom' }),
    });
  });

  return { carts, attempts: () => attempts, deletedIds: () => deleted.slice() };
}

async function readActiveCartLS(page: Page): Promise<string | null> {
  return await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('seller:active-cart-id:')) {
        return localStorage.getItem(k);
      }
    }
    return null;
  });
}

async function seedActiveCartLS(page: Page, id: string): Promise<void> {
  await page.evaluate((cartId) => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('seller:active-cart-id:')) {
        localStorage.setItem(k, cartId);
        return;
      }
    }
    localStorage.setItem('seller:active-cart-id:e2e', cartId);
  }, id);
}

test.describe('Excluir carrinho — sucesso, loading, foco e anti-duplo-clique', () => {
  test.beforeEach(() => requireAuth());

  test('sucesso: cart some da lista e activeCartId é limpo no localStorage', async ({
    page,
  }) => {
    const harness = await seedWithDelayedDelete(page, { delayMs: 100 });
    const target = harness.carts[0];

    await gotoAndSettle(page, '/');
    await openCartPopover(page);

    // Garante que o target é o carrinho ativo e sua chave está no LS.
    await seedActiveCartLS(page, target.id);
    expect(await readActiveCartLS(page)).toBe(target.id);

    await page.getByTestId(`cart-delete-${target.id}`).click();
    await page.getByTestId('cart-delete-confirm').click();

    // Dialog fecha após sucesso.
    await expect(page.getByTestId('cart-delete-dialog')).toBeHidden({
      timeout: 5_000,
    });

    // Toast de sucesso.
    await expect(
      page
        .locator('[data-sonner-toast][data-type="success"]')
        .filter({ hasText: 'Carrinho removido' })
        .first(),
    ).toBeVisible({ timeout: 5_000 });

    // Carrinho some da lista.
    await expect(page.getByText(target.company_name)).toHaveCount(0);

    // Chave activeCartId foi removida (o contexto chama localStorage.removeItem).
    await expect.poll(() => readActiveCartLS(page), { timeout: 3_000 }).toBeNull();

    // Apenas um DELETE foi disparado.
    expect(harness.attempts()).toBe(1);
    expect(harness.deletedIds()).toEqual([target.id]);
  });

  test('durante o DELETE, confirm fica disabled + spinner + Cancelar disabled', async ({
    page,
  }) => {
    // Atraso grande o suficiente para observar o estado "em voo" com folga.
    const harness = await seedWithDelayedDelete(page, { delayMs: 900 });
    const target = harness.carts[0];

    await gotoAndSettle(page, '/');
    await openCartPopover(page);

    await page.getByTestId(`cart-delete-${target.id}`).click();

    const confirm = page.getByTestId('cart-delete-confirm');
    const cancel = page.getByTestId('cart-delete-cancel');
    await expect(confirm).toBeEnabled();

    await confirm.click();

    // Estado em voo: disabled + aria-busy + spinner + texto "Excluindo…".
    await expect(confirm).toBeDisabled();
    await expect(confirm).toHaveAttribute('aria-busy', 'true');
    await expect(confirm).toContainText('Excluindo');
    await expect(page.getByTestId('cart-delete-loading')).toBeVisible();
    await expect(cancel).toBeDisabled();

    // Espera concluir; UI reconcilia.
    await expect(page.getByTestId('cart-delete-dialog')).toBeHidden({
      timeout: 5_000,
    });
    expect(harness.attempts()).toBe(1);
  });

  test('foco volta para o botão de lixeira ao Cancelar o AlertDialog', async ({
    page,
  }) => {
    const harness = await seedWithDelayedDelete(page, { delayMs: 50 });
    const target = harness.carts[0];

    await gotoAndSettle(page, '/');
    await openCartPopover(page);

    const trash = page.getByTestId(`cart-delete-${target.id}`);
    await trash.click();
    await expect(page.getByTestId('cart-delete-dialog')).toBeVisible();

    // Cancela — Radix AlertDialog deve restaurar foco no elemento que abriu.
    await page.getByTestId('cart-delete-cancel').click();
    await expect(page.getByTestId('cart-delete-dialog')).toBeHidden();

    // Foco retornou para a lixeira do carrinho.
    await expect(trash).toBeFocused();

    // Nenhum DELETE foi disparado (só cancelamos).
    expect(harness.attempts()).toBe(0);
  });

  test('cliques rápidos em Excluir disparam apenas UM DELETE por tentativa', async ({
    page,
  }) => {
    // Atraso na resposta para que a mutation permaneça "em voo" durante os
    // cliques rápidos consecutivos.
    const harness = await seedWithDelayedDelete(page, { delayMs: 700 });
    const target = harness.carts[0];

    await gotoAndSettle(page, '/');
    await openCartPopover(page);

    await page.getByTestId(`cart-delete-${target.id}`).click();
    const confirm = page.getByTestId('cart-delete-confirm');
    await expect(confirm).toBeEnabled();

    // Rapid-fire: 5 cliques em sequência sem esperar. Após o 1º, o botão fica
    // disabled — os subsequentes são no-op no DOM. Usamos `{ force: true }` no
    // 2º..5º porque o Playwright normalmente bloqueia cliques em elementos
    // desabilitados; queremos garantir que MESMO se um evento vazasse, apenas
    // 1 DELETE seria disparado (guard `if (isDeletingCart) return` no onClick).
    await confirm.click();
    for (let i = 0; i < 4; i++) {
      await confirm.click({ force: true, timeout: 500 }).catch(() => {
        /* botão já disabled — esperado */
      });
    }

    // Espera terminar.
    await expect(page.getByTestId('cart-delete-dialog')).toBeHidden({
      timeout: 5_000,
    });

    // Apenas UM DELETE foi disparado, apesar dos 5 cliques.
    expect(harness.attempts()).toBe(1);
    expect(harness.deletedIds()).toEqual([target.id]);
  });
});
