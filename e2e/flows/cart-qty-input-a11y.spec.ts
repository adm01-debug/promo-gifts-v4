/**
 * E2E — Associação ARIA da mensagem de feedback.
 *
 * Verifica que:
 *  - aria-describedby do input aponta para o `#cart-item-qty-fb-<id>` correto.
 *  - O elemento apontado possui role=status e aria-live=polite.
 *  - Ao entrar em estado inválido, aria-invalid=true.
 *  - Ao voltar para idle (commit válido), aria-describedby é removido.
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
  test(`aria-describedby + role=status + aria-live=polite [${vp.name}]`, async ({
    page,
  }) => {
    requireAuth();
    await page.setViewportSize({ width: vp.width, height: vp.height });

    const { items } = await seedAuthedCartWithItems(page, {
      itemCount: 1,
      unitPrices: [10],
      quantities: [7],
    });
    await gotoAndSettle(page, '/');
    await openCartPopover(page);

    const it = items[0];
    const fbId = `cart-item-qty-fb-${it.id}`;
    const qty = page.getByTestId(`cart-item-qty-${it.id}`);

    // Estado idle inicial — sem aria-describedby.
    await expect(qty).not.toHaveAttribute('aria-describedby', /.+/);

    // Vírgula → sanitized: describedby aponta para o span certo.
    await qty.click();
    await qty.press('Control+A');
    await qty.pressSequentially('5,3');
    await expect(qty).toHaveAttribute('aria-describedby', fbId);
    const fb = page.locator(`#${fbId}`);
    await expect(fb).toHaveAttribute('role', 'status');
    await expect(fb).toHaveAttribute('aria-live', 'polite');
    await expect(fb).toHaveText('Apenas dígitos são aceitos');

    // Commit vazio → invalid: aria-invalid=true e mensagem correspondente.
    await qty.press('Control+A');
    await qty.press('Delete');
    await qty.press('Enter');
    await expect(qty).toHaveAttribute('aria-invalid', 'true');
    await expect(qty).toHaveAttribute('aria-describedby', fbId);
    await expect(page.locator(`#${fbId}`)).toHaveText(
      'Valor inválido — quantidade restaurada',
    );

    // Commit acima do MAX → clamped: mensagem 999.999.
    await qty.click();
    await qty.press('Control+A');
    await qty.pressSequentially('9999999');
    await qty.press('Enter');
    await expect(qty).toHaveAttribute('data-feedback', 'clamped');
    await expect(qty).toHaveAttribute('aria-describedby', fbId);
    await expect(page.locator(`#${fbId}`)).toHaveText('Valor limitado a 999.999');
  });
}
