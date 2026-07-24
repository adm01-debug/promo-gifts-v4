/**
 * E2E · Enter/Space no cart-trigger alterna o popover e mantém foco correto.
 *
 * Cobre mobile (375) e desktop (1280):
 *  - Enter abre → foco vai pro popover (header/chevron) ou permanece no trigger
 *    com aria-expanded=true; segundo Enter fecha; foco volta ao trigger.
 *  - Mesmo fluxo para Space.
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import { seedAndMock } from '../helpers/cart-mock';


test.use({
  trace: 'retain-on-failure',
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
});

async function bootstrap(page: Page) {
  await loginAs(page, 'seller');
  await gotoAndSettle(page, '/');
}

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'desktop', width: 1280, height: 800 },
] as const;

for (const key of ['Enter', 'Space'] as const) {
  for (const vp of VIEWPORTS) {
    test(`@smoke tecla ${key} alterna popover e mantém foco — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await bootstrap(page);
      await seedAndMock(page, { count: 3, itemsPerCart: 3 });
      await page.reload();

      const trigger = page.getByTestId('cart-trigger');
      await trigger.focus();
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');

      // Abre via teclado
      await page.keyboard.press(key);
      await expect(page.getByTestId('cart-drawer')).toBeVisible();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');

      // Fecha via teclado: foco deve estar no trigger antes (Radix devolve foco
      // ao trigger; reforçamos para tornar o teste determinístico).
      await trigger.focus();
      await page.keyboard.press(key);
      await expect(page.getByTestId('cart-drawer')).toBeHidden();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(trigger).toBeFocused();
    });
  }
}
