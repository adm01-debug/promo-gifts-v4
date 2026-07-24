/**
 * E2E — Ciclo de commit com valor inválido/clamp.
 *
 * Regras verificadas:
 *  1. Vírgula/letras + Enter → sanitiza para dígitos, commit válido, Total
 *     recalcula com o valor sanitizado, feedback expira (idle) sem deixar
 *     aria-invalid pendurado.
 *  2. Acima do MAX + Enter → clamp para 999.999, Total = preço * 999.999,
 *     role=status + aria-live=polite ativos e depois somem no auto-clear.
 *  3. Após auto-clear o Total permanece consistente com a última quantidade
 *     válida (não há regressão para o valor pré-commit).
 */
import { test, expect, requireAuth } from '../fixtures/test-base';
import {
  seedAuthedCartWithItems,
  openCartPopover,
  formatBRL,
} from '../helpers/cart-fixture';
import { gotoAndSettle } from '../helpers/nav';

test.use({ trace: 'retain-on-failure', screenshot: 'only-on-failure' });

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

for (const vp of VIEWPORTS) {
  test(`sanitize + clamp em Enter mantêm Total consistente [${vp.name}]`, async ({
    page,
  }) => {
    requireAuth();
    await page.setViewportSize({ width: vp.width, height: vp.height });

    const { items, unitPrices } = await seedAuthedCartWithItems(page, {
      itemCount: 1,
      unitPrices: [7],
      quantities: [3],
    });
    await gotoAndSettle(page, '/');
    await openCartPopover(page);

    const it = items[0];
    const qty = page.getByTestId(`cart-item-qty-${it.id}`);
    const total = page.getByTestId(`cart-item-total-${it.id}`);
    const fbId = `cart-item-qty-fb-${it.id}`;

    // 1) "5a2" + Enter → sanitiza para "52", Total = 7*52.
    await qty.click();
    await qty.press('Control+A');
    await qty.pressSequentially('5a2');
    await expect(qty).toHaveAttribute('data-feedback', 'sanitized');
    await qty.press('Enter');
    await expect(qty).toHaveValue('52');
    await expect(total).toHaveText(formatBRL(unitPrices[0] * 52));

    // Feedback expira e ARIA some.
    await expect(qty).toHaveAttribute('data-feedback', 'idle', { timeout: 3000 });
    expect(await qty.getAttribute('aria-invalid')).toBeNull();
    await expect(page.locator(`#${fbId}`)).toHaveCount(0);

    // 2) "9999999" + Enter → clamp para 999999.
    await qty.click();
    await qty.press('Control+A');
    await qty.pressSequentially('9999999');
    await qty.press('Enter');
    await expect(qty).toHaveValue('999999');
    await expect(qty).toHaveAttribute('data-feedback', 'clamped');
    await expect(page.locator(`#${fbId}`)).toHaveAttribute('role', 'status');
    await expect(page.locator(`#${fbId}`)).toHaveAttribute('aria-live', 'polite');
    await expect(total).toHaveText(formatBRL(unitPrices[0] * 999_999));

    // 3) Após auto-clear, Total permanece com o valor pós-clamp.
    await expect(qty).toHaveAttribute('data-feedback', 'idle', { timeout: 3000 });
    await expect(total).toHaveText(formatBRL(unitPrices[0] * 999_999));
    await expect(page.locator(`#${fbId}`)).toHaveCount(0);
  });
}
