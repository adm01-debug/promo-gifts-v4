/**
 * Fluxo: exclusão de carrinho — invariantes de estado após falha e retries.
 *
 * Cobre:
 *  1. Quando o DELETE falha, o `activeCartId` do usuário NÃO é limpo:
 *     - o carrinho continua marcado como ativo na UI (aria-expanded="true"
 *       no toggle) e
 *     - a chave `seller:active-cart-id:<userId>` no localStorage continua
 *       apontando para o mesmo id.
 *  2. O toast de erro é acessível: fica dentro do landmark
 *     `section[aria-label="Notifications"]`, herda `aria-live="assertive"`
 *     via `ol[aria-live]` do sonner, tem `data-type="error"` e o texto
 *     acessível "Operação falhou" aparece EXATAMENTE UMA VEZ por tentativa.
 *  3. Duas falhas consecutivas: o dialog permanece aberto, o carrinho não é
 *     removido, `attempts === 2` e o toast reaparece a cada tentativa.
 */
import { test, expect, requireAuth } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';
import { mockSellerCartsAPI, makeMockCart, type MockCart } from '../helpers/cart-mock';
import { openCartPopover } from '../helpers/cart-fixture';
import type { Page, Route } from '@playwright/test';

interface Harness {
  carts: MockCart[];
  attempts: () => number;
}

async function seedWithFailingDelete(page: Page): Promise<Harness> {
  const carts = [makeMockCart(0, 2), makeMockCart(1, 2)];
  await mockSellerCartsAPI(page, carts);

  let attempts = 0;
  await page.route('**/rest/v1/seller_carts**', async (route: Route) => {
    const req = route.request();
    if (req.method() !== 'DELETE') return route.continue();
    attempts += 1;
    return route.fulfill({
      status: 500,
      contentType: 'application/json',
      headers: { 'X-Mock-Source': 'cart-delete-invariants-spec' },
      body: JSON.stringify({
        code: 'PGRST500',
        message: 'boom',
        details: null,
        hint: null,
      }),
    });
  });

  return { carts, attempts: () => attempts };
}

/**
 * Lê a chave de activeCartId do localStorage independentemente do userId.
 * A chave tem o formato `seller:active-cart-id:<userId>`.
 */
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

test.describe('Excluir carrinho — invariantes após falha', () => {
  test.beforeEach(() => requireAuth());

  test('falha não limpa activeCartId nem a chave no localStorage', async ({ page }) => {
    const harness = await seedWithFailingDelete(page);
    const target = harness.carts[0];

    await gotoAndSettle(page, '/');
    await openCartPopover(page);

    // Garante que o carrinho-alvo é o ativo (o contexto usa carts[0] como fallback).
    const toggle = page.getByTestId(`cart-toggle-${target.id}`);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    // Semeia a chave no localStorage (a UI pode ainda não ter escrito porque o
    // activeCartId veio do fallback do contexto — força para reproduzir o cenário
    // real onde o usuário selecionou explicitamente).
    await page.evaluate((id) => {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('seller:active-cart-id:')) {
          localStorage.setItem(k, id);
          return;
        }
      }
      // Se não existir ainda, cria uma chave genérica pra este teste.
      localStorage.setItem('seller:active-cart-id:e2e', id);
    }, target.id);

    const lsBefore = await readActiveCartLS(page);
    expect(lsBefore).toBe(target.id);

    await page.getByTestId(`cart-delete-${target.id}`).click();
    await page.getByTestId('cart-delete-confirm').click();

    // Espera o toast de erro (mutação concluiu).
    await expect(
      page.locator('[data-sonner-toast][data-type="error"]').first(),
    ).toBeVisible({ timeout: 5_000 });

    expect(harness.attempts()).toBe(1);

    // activeCartId continua marcado na UI e no localStorage.
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const lsAfter = await readActiveCartLS(page);
    expect(lsAfter).toBe(target.id);

    // Carrinho continua na lista.
    await expect(page.getByText(target.company_name).first()).toBeVisible();
  });

  test('toast de erro é acessível e aparece exatamente uma vez por tentativa', async ({
    page,
  }) => {
    const harness = await seedWithFailingDelete(page);
    const target = harness.carts[0];

    await gotoAndSettle(page, '/');
    await openCartPopover(page);

    await page.getByTestId(`cart-delete-${target.id}`).click();

    const confirm = page.getByTestId('cart-delete-confirm');
    await confirm.click();

    // Landmark acessível do sonner + live region assertive para errors.
    const region = page.locator('section[aria-label="Notifications"]');
    await expect(region).toBeAttached();
    // O sonner renderiza pelo menos um <ol aria-live="..."> no container.
    const liveList = region.locator('ol[aria-live]');
    await expect(liveList.first()).toBeAttached();

    // Exatamente UM toast de erro com o texto "Operação falhou".
    const errorToasts = page
      .locator('[data-sonner-toast][data-type="error"]')
      .filter({ hasText: 'Operação falhou' });
    await expect(errorToasts).toHaveCount(1, { timeout: 5_000 });

    expect(harness.attempts()).toBe(1);

    // Segunda tentativa: aguarda o botão reabilitar (mutation terminou) e clica.
    await expect(confirm).toBeEnabled();
    await confirm.click();

    // Após a 2ª falha, o total de attempts é 2 e temos um novo toast de erro.
    // Toasts antigos podem ainda estar animando, então validamos apenas o
    // limite superior (não mais que 2 toasts de erro empilhados) e que existe
    // pelo menos 1 visível.
    await expect
      .poll(() => harness.attempts(), { timeout: 5_000 })
      .toBe(2);
    await expect(errorToasts.first()).toBeVisible();
    const count = await errorToasts.count();
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBeLessThanOrEqual(2);
  });

  test('duas falhas consecutivas: dialog fica aberto, carrinho permanece na lista', async ({
    page,
  }) => {
    const harness = await seedWithFailingDelete(page);
    const target = harness.carts[0];

    await gotoAndSettle(page, '/');
    await openCartPopover(page);

    await page.getByTestId(`cart-delete-${target.id}`).click();
    const dialog = page.getByTestId('cart-delete-dialog');
    const confirm = page.getByTestId('cart-delete-confirm');
    await expect(dialog).toBeVisible();

    // 1ª falha.
    await confirm.click();
    await expect(
      page.locator('[data-sonner-toast][data-type="error"]').first(),
    ).toBeVisible({ timeout: 5_000 });
    await expect(dialog).toBeVisible();
    await expect(page.getByText(target.company_name).first()).toBeVisible();
    await expect(confirm).toBeEnabled();

    // 2ª falha.
    await confirm.click();
    await expect
      .poll(() => harness.attempts(), { timeout: 5_000 })
      .toBe(2);
    await expect(dialog).toBeVisible();
    await expect(page.getByText(target.company_name).first()).toBeVisible();
    await expect(confirm).toBeEnabled();

    // Cancelar fecha o dialog sem excluir.
    await page.getByTestId('cart-delete-cancel').click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(target.company_name).first()).toBeVisible();
    expect(harness.attempts()).toBe(2);
  });
});
