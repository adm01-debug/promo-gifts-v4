/**
 * E2E — Esc devolve o foco ao próprio input (trigger de edição do item).
 *
 * Regra: ao pressionar Esc dentro do PopoverQtyInput, o valor reverte e o
 * foco DEVE permanecer no input daquele item — nunca cair no <body>. Isso
 * mantém a navegação por teclado consistente em desktop e mobile.
 */
import { test, expect, requireAuth } from '../fixtures/test-base';
import {
  seedAuthedCartWithItems,
  openCartPopover,
} from '../helpers/cart-fixture';
import { gotoAndSettle } from '../helpers/nav';

test.use({ trace: 'retain-on-failure', screenshot: 'only-on-failure' });

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

for (const vp of VIEWPORTS) {
  test(`Esc mantém foco no input do mesmo item [${vp.name}]`, async ({ page }) => {
    requireAuth();
    await page.setViewportSize({ width: vp.width, height: vp.height });

    const { items } = await seedAuthedCartWithItems(page, {
      itemCount: 3,
      unitPrices: [10, 12, 15],
      quantities: [5, 6, 7],
    });
    await gotoAndSettle(page, '/');
    await openCartPopover(page);

    // Testa Esc em cada item: foco deve permanecer no próprio input.
    for (const it of items) {
      const qty = page.getByTestId(`cart-item-qty-${it.id}`);
      await qty.click();
      await expect(qty).toBeFocused();
      await qty.press('Control+A');
      await qty.pressSequentially('999');
      await qty.press('Escape');

      // Valor voltou ao original E o foco continua no input daquele item.
      await expect(qty).toHaveValue(String(it.quantity));
      await expect(qty).toBeFocused();

      // Sanidade: não caímos no <body>.
      const activeTag = await page.evaluate(
        () => document.activeElement?.tagName ?? null,
      );
      expect(activeTag).toBe('INPUT');
    }
  });
}
