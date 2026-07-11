/**
 * E2E — Ciclo completo de Tab / Shift+Tab pelos inputs de quantidade.
 *
 * Percorre TODOS os inputs `cart-item-qty-*` do popover usando apenas o
 * teclado (Tab e Shift+Tab). Verifica que:
 *  - Cada input do carrinho é alcançável no fluxo natural de foco.
 *  - Shift+Tab devolve o foco pelo caminho inverso (sem "foco preso").
 *  - Esc no final fecha o popover e devolve o foco ao `cart-trigger`.
 *
 * Rodamos em desktop e mobile — a viewport é forçada por teste.
 */
import { test, expect, type Page, type Locator } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import { seedAndMock } from '../helpers/cart-mock';

test.use({ trace: 'retain-on-failure', screenshot: 'only-on-failure' });

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

/**
 * Avança Tab até que o Locator alvo esteja focado ou o limite seja atingido.
 * Retorna o número de Tabs consumidos (útil para depuração de flakes).
 */
async function tabUntilFocused(
  page: Page,
  target: Locator,
  maxSteps = 40,
): Promise<number> {
  for (let i = 0; i < maxSteps; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return i;
    await page.keyboard.press('Tab');
  }
  throw new Error('tabUntilFocused: alvo não recebeu foco dentro do limite');
}

async function shiftTabUntilFocused(
  page: Page,
  target: Locator,
  maxSteps = 40,
): Promise<number> {
  for (let i = 0; i < maxSteps; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return i;
    await page.keyboard.press('Shift+Tab');
  }
  throw new Error('shiftTabUntilFocused: alvo não recebeu foco dentro do limite');
}

for (const vp of VIEWPORTS) {
  test(`Tab / Shift+Tab percorre todos os itens sem foco preso [${vp.name}]`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await loginAs(page, 'seller');

    const carts = await seedAndMock(page, { count: 1, itemsPerCart: 4 });
    const items = carts[0].seller_cart_items;

    await gotoAndSettle(page, '/');
    const trigger = page.getByTestId('cart-trigger');
    await trigger.click();
    await expect(page.getByTestId('cart-drawer')).toBeVisible();

    // Alcança o primeiro input via Tab a partir do trigger (autoFocus pode
    // já ter posicionado o foco lá — tabUntilFocused vira no-op se sim).
    const qty0 = page.getByTestId(`cart-item-qty-${items[0].id}`);
    await tabUntilFocused(page, qty0);
    await expect(qty0).toBeFocused();

    // Fluxo adiante: cada input subsequente é alcançável por Tab.
    for (let i = 1; i < items.length; i++) {
      const next = page.getByTestId(`cart-item-qty-${items[i].id}`);
      await tabUntilFocused(page, next);
      await expect(next).toBeFocused();
    }

    // Fluxo reverso: Shift+Tab devolve o foco até o primeiro input.
    for (let i = items.length - 2; i >= 0; i--) {
      const prev = page.getByTestId(`cart-item-qty-${items[i].id}`);
      await shiftTabUntilFocused(page, prev);
      await expect(prev).toBeFocused();
    }

    // Nenhum item ficou "preso": conseguimos voltar ao início.
    await expect(qty0).toBeFocused();

    // Esc no input fecha o popover e devolve o foco ao trigger (Radix).
    await page.keyboard.press('Escape'); // Esc no input: apenas reverte
    // Segundo Esc: fecha o popover (comportamento do Radix Popover).
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('cart-drawer')).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
}
