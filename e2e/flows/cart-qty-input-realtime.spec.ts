/**
 * E2E — PopoverQtyInput dentro do popover do carrinho.
 *
 * Cobre:
 *  1. Digitar "80" e "9999999" em desktop e mobile — Total recalcula na hora.
 *  2. A11y: role=status + aria-live=polite + aria-invalid ao digitar vírgula,
 *     letras e valor acima do MAX.
 *  3. Limites (1, 999999, 9999999, 0) aplicados em itens DIFERENTES do MESMO
 *     carrinho — cada Total permanece consistente e isolado.
 *
 * A viewport mobile é forçada dentro do teste via `page.setViewportSize` para
 * não depender do projeto Playwright em que a spec roda.
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
  test.describe(`PopoverQtyInput [${vp.name}]`, () => {
    test.beforeEach(async ({ page }) => {
      requireAuth();
      await page.setViewportSize({ width: vp.width, height: vp.height });
    });

    test('digitar 80 e 9999999 recalcula o Total imediatamente', async ({ page }) => {
      const { items, unitPrices } = await seedAuthedCartWithItems(page, {
        itemCount: 2,
        unitPrices: [10, 25],
        quantities: [5, 7],
      });
      await gotoAndSettle(page, '/');
      await openCartPopover(page);

      const item0 = items[0];
      const item1 = items[1];

      const qty0 = page.getByTestId(`cart-item-qty-${item0.id}`);
      const total0 = page.getByTestId(`cart-item-total-${item0.id}`);
      await expect(qty0).toBeVisible();
      await expect(total0).toHaveText(formatBRL(unitPrices[0] * item0.quantity));

      // Digita 80 no primeiro item — Total = 10 * 80.
      await qty0.click();
      await qty0.press('Control+A');
      await qty0.pressSequentially('80');
      await qty0.press('Enter');
      await expect(qty0).toHaveValue('80');
      await expect(total0).toHaveText(formatBRL(unitPrices[0] * 80));

      // Digita 9999999 no segundo item — clamp em 999.999 e Total reflete o MAX.
      const qty1 = page.getByTestId(`cart-item-qty-${item1.id}`);
      const total1 = page.getByTestId(`cart-item-total-${item1.id}`);
      await qty1.click();
      await qty1.press('Control+A');
      await qty1.pressSequentially('9999999');
      await qty1.press('Enter');
      await expect(qty1).toHaveValue('999999');
      await expect(qty1).toHaveAttribute('data-feedback', 'clamped');
      await expect(total1).toHaveText(formatBRL(unitPrices[1] * 999_999));

      // O primeiro item continua em 80 — isolamento entre itens.
      await expect(total0).toHaveText(formatBRL(unitPrices[0] * 80));
    });

    test('a11y: role=status, aria-live=polite e aria-invalid em entradas inválidas', async ({ page }) => {
      const { items } = await seedAuthedCartWithItems(page, {
        itemCount: 1,
        unitPrices: [10],
        quantities: [3],
      });
      await gotoAndSettle(page, '/');
      await openCartPopover(page);

      const item = items[0];
      const qty = page.getByTestId(`cart-item-qty-${item.id}`);
      const statusLive = page.locator(`#cart-item-qty-fb-${item.id}`);

      // Vírgula é sanitizada (mantém apenas dígitos).
      await qty.click();
      await qty.press('Control+A');
      await qty.pressSequentially('5,3');
      await expect(qty).toHaveAttribute('data-feedback', 'sanitized');
      await expect(statusLive).toHaveAttribute('role', 'status');
      await expect(statusLive).toHaveAttribute('aria-live', 'polite');

      // Letras: também sanitizadas.
      await qty.press('Control+A');
      await qty.pressSequentially('abc12');
      await expect(qty).toHaveAttribute('data-feedback', 'sanitized');

      // 9999999 → commit dispara clamp e mantém role=status.
      await qty.press('Control+A');
      await qty.pressSequentially('9999999');
      await qty.press('Enter');
      await expect(qty).toHaveAttribute('data-feedback', 'clamped');
      await expect(page.locator(`#cart-item-qty-fb-${item.id}`)).toHaveAttribute(
        'aria-live',
        'polite',
      );

      // Commit vazio → aria-invalid=true e feedback invalid.
      await qty.click();
      await qty.press('Control+A');
      await qty.press('Delete');
      await qty.press('Enter');
      await expect(qty).toHaveAttribute('data-feedback', 'invalid');
      await expect(qty).toHaveAttribute('aria-invalid', 'true');
    });

    test('limites 1 / 999999 / 9999999 / 0 aplicados a itens diferentes permanecem consistentes', async ({ page }) => {
      const { items, unitPrices } = await seedAuthedCartWithItems(page, {
        itemCount: 4,
        unitPrices: [10, 2, 3, 5],
        quantities: [50, 50, 50, 50],
      });
      await gotoAndSettle(page, '/');
      await openCartPopover(page);

      const boundaries: Array<{ type: string; input: string; expectedQty: number }> = [
        { type: 'min', input: '1', expectedQty: 1 },
        { type: 'max-exact', input: '999999', expectedQty: 999_999 },
        { type: 'over-max', input: '9999999', expectedQty: 999_999 },
        { type: 'zero-reverts', input: '0', expectedQty: 50 },
      ];

      for (let i = 0; i < 4; i++) {
        const it = items[i];
        const b = boundaries[i];
        const qty = page.getByTestId(`cart-item-qty-${it.id}`);
        await qty.click();
        await qty.press('Control+A');
        await qty.pressSequentially(b.input);
        await qty.press('Enter');
        await expect(qty, `item ${i} qty display`).toHaveValue(String(b.expectedQty));
      }

      // Após aplicar todos, cada Total reflete o preço unitário × quantidade esperada.
      for (let i = 0; i < 4; i++) {
        const it = items[i];
        const total = page.getByTestId(`cart-item-total-${it.id}`);
        await expect(total, `item ${i} total`).toHaveText(
          formatBRL(unitPrices[i] * boundaries[i].expectedQty),
        );
      }
    });
  });
}
