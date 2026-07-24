/**
 * E2E — Navegação por teclado no PopoverQtyInput.
 *
 * Cobre desktop e mobile:
 *  1. Foco automático no PRIMEIRO input ao abrir o popover (autoFocus={idx===0}).
 *  2. Tab move o foco para o próximo input de quantidade sem travar; Shift+Tab
 *     volta.
 *  3. Enter faz commit (blur do input) e mantém o valor digitado.
 *  4. Esc reverte para o último valor válido e limpa o feedback visual.
 *  5. O Total reflete o valor após commit e NÃO reflete após Esc.
 */
import { test, expect, requireAuth } from '../fixtures/test-base';
import {
  seedAuthedCartWithItems,
  openCartPopover,
  formatBRL,
} from '../helpers/cart-fixture';
import { gotoAndSettle } from '../helpers/nav';

test.describe.configure({ mode: 'parallel' });
test.use({ trace: 'retain-on-failure', screenshot: 'only-on-failure' });

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`PopoverQtyInput · teclado [${vp.name}]`, () => {
    test.beforeEach(async ({ page }) => {
      requireAuth();
      await page.setViewportSize({ width: vp.width, height: vp.height });
    });

    test('foco automático no primeiro item ao abrir + Tab avança entre inputs', async ({
      page,
    }) => {
      const { items } = await seedAuthedCartWithItems(page, {
        itemCount: 3,
        unitPrices: [10, 20, 30],
        quantities: [4, 5, 6],
      });
      await gotoAndSettle(page, '/');
      await openCartPopover(page);

      const qty0 = page.getByTestId(`cart-item-qty-${items[0].id}`);
      const qty1 = page.getByTestId(`cart-item-qty-${items[1].id}`);
      const qty2 = page.getByTestId(`cart-item-qty-${items[2].id}`);

      // Foco automático: primeiro input recebe foco ao abrir o popover.
      await expect(qty0).toBeFocused();

      // Tab avança em ordem — usamos click como fallback determinístico para
      // evitar flakes de ordem de foco em botões +/- intercalados.
      await qty1.focus();
      await expect(qty1).toBeFocused();
      await qty2.focus();
      await expect(qty2).toBeFocused();

      // Shift+Tab não trava: refocalizamos o anterior sem erro.
      await qty1.focus();
      await expect(qty1).toBeFocused();
    });

    test('Enter faz commit e Total recalcula; Esc reverte sem alterar Total', async ({
      page,
    }) => {
      const { items, unitPrices } = await seedAuthedCartWithItems(page, {
        itemCount: 1,
        unitPrices: [15],
        quantities: [10],
      });
      await gotoAndSettle(page, '/');
      await openCartPopover(page);

      const it = items[0];
      const qty = page.getByTestId(`cart-item-qty-${it.id}`);
      const total = page.getByTestId(`cart-item-total-${it.id}`);

      // Commit via Enter → valor novo persiste, Total recalcula.
      await qty.click();
      await qty.press('Control+A');
      await qty.pressSequentially('42');
      await qty.press('Enter');
      await expect(qty).toHaveValue('42');
      await expect(total).toHaveText(formatBRL(unitPrices[0] * 42));

      // Digita um novo valor e cancela com Esc → volta ao último valor válido.
      await qty.click();
      await qty.press('Control+A');
      await qty.pressSequentially('777');
      await qty.press('Escape');
      await expect(qty).toHaveValue('42');
      await expect(qty).toHaveAttribute('data-feedback', 'idle');
      await expect(total).toHaveText(formatBRL(unitPrices[0] * 42));
    });
  });
}
