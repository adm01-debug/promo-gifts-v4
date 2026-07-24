/**
 * E2E — Feedback ARIA é isolado por item.
 *
 * Ao gerar um estado inválido no item A e depois focar o item B, o item B
 * deve estar limpo (sem aria-describedby / aria-invalid / role=status) e o
 * item A mantém o próprio feedback. Cobre desktop e mobile.
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
  test(`aria-describedby / aria-invalid isolados por item [${vp.name}]`, async ({
    page,
  }) => {
    requireAuth();
    await page.setViewportSize({ width: vp.width, height: vp.height });

    const { items } = await seedAuthedCartWithItems(page, {
      itemCount: 2,
      unitPrices: [10, 20],
      quantities: [3, 4],
    });
    await gotoAndSettle(page, '/');
    await openCartPopover(page);

    const a = items[0];
    const b = items[1];
    const qtyA = page.getByTestId(`cart-item-qty-${a.id}`);
    const qtyB = page.getByTestId(`cart-item-qty-${b.id}`);
    const fbAId = `cart-item-qty-fb-${a.id}`;
    const fbBId = `cart-item-qty-fb-${b.id}`;

    // Item A entra em estado "invalid" via commit vazio.
    await qtyA.click();
    await qtyA.press('Control+A');
    await qtyA.press('Delete');
    await qtyA.press('Enter');
    await expect(qtyA).toHaveAttribute('data-feedback', 'invalid');
    await expect(qtyA).toHaveAttribute('aria-invalid', 'true');
    await expect(qtyA).toHaveAttribute('aria-describedby', fbAId);
    await expect(page.locator(`#${fbAId}`)).toHaveAttribute('role', 'status');

    // Foca no item B: o feedback do B deve continuar idle e SEM ARIA extra.
    await qtyB.focus();
    await expect(qtyB).toBeFocused();
    await expect(qtyB).toHaveAttribute('data-feedback', 'idle');
    expect(await qtyB.getAttribute('aria-invalid')).toBeNull();
    expect(await qtyB.getAttribute('aria-describedby')).toBeNull();
    await expect(page.locator(`#${fbBId}`)).toHaveCount(0);

    // B entra em "sanitized" (vírgula) — A já expirou o feedback (700ms) e
    // deve estar limpo. Aguardamos B refletir seu próprio estado.
    await qtyB.press('Control+A');
    await qtyB.pressSequentially('5,0');
    await expect(qtyB).toHaveAttribute('data-feedback', 'sanitized');
    await expect(qtyB).toHaveAttribute('aria-describedby', fbBId);
    await expect(page.locator(`#${fbBId}`)).toHaveAttribute('aria-live', 'polite');

    // Feedback do A eventualmente volta para idle (timeout auto-clear ~700ms).
    await expect(qtyA).toHaveAttribute('data-feedback', 'idle', { timeout: 3000 });
    expect(await qtyA.getAttribute('aria-invalid')).toBeNull();
    expect(await qtyA.getAttribute('aria-describedby')).toBeNull();
  });
}
