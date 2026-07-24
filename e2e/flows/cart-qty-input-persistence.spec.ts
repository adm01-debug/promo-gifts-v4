/**
 * E2E — Persistência da quantidade ao fechar/reabrir o popover.
 *
 * Após commit via Enter, fechamos o popover clicando fora e o reabrimos.
 * A quantidade committada e o Total devem permanecer consistentes, e o
 * isolamento entre itens continua válido.
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
  test(`Total consistente após fechar/reabrir popover [${vp.name}]`, async ({
    page,
  }) => {
    requireAuth();
    await page.setViewportSize({ width: vp.width, height: vp.height });

    const { items, unitPrices } = await seedAuthedCartWithItems(page, {
      itemCount: 2,
      unitPrices: [12, 8],
      quantities: [3, 4],
    });
    await gotoAndSettle(page, '/');
    await openCartPopover(page);

    // Ajusta os dois itens com valores distintos.
    const qty0 = page.getByTestId(`cart-item-qty-${items[0].id}`);
    const qty1 = page.getByTestId(`cart-item-qty-${items[1].id}`);
    await qty0.click();
    await qty0.press('Control+A');
    await qty0.pressSequentially('80');
    await qty0.press('Enter');
    await qty1.click();
    await qty1.press('Control+A');
    await qty1.pressSequentially('25');
    await qty1.press('Enter');

    const total0 = page.getByTestId(`cart-item-total-${items[0].id}`);
    const total1 = page.getByTestId(`cart-item-total-${items[1].id}`);
    await expect(total0).toHaveText(formatBRL(unitPrices[0] * 80));
    await expect(total1).toHaveText(formatBRL(unitPrices[1] * 25));

    // Fecha via Esc (fechamento nativo do Radix Popover).
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('cart-drawer')).toBeHidden();

    // Reabre e re-verifica os totais e as quantidades exibidas.
    await openCartPopover(page);
    await expect(page.getByTestId(`cart-item-qty-${items[0].id}`)).toHaveValue('80');
    await expect(page.getByTestId(`cart-item-qty-${items[1].id}`)).toHaveValue('25');
    await expect(page.getByTestId(`cart-item-total-${items[0].id}`)).toHaveText(
      formatBRL(unitPrices[0] * 80),
    );
    await expect(page.getByTestId(`cart-item-total-${items[1].id}`)).toHaveText(
      formatBRL(unitPrices[1] * 25),
    );
  });
}
