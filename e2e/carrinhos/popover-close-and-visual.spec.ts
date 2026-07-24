/**
 * E2E · fechamento do popover do carrinho ativo + regressão visual + diagnóstico.
 *
 * Cobre:
 *  1. Clique fora fecha o popover; lista/rodapé somem; foco volta ao trigger.
 *  2. Esc fecha o popover; foco volta ao trigger; aria-expanded=false.
 *  3. Regressão visual do rodapé fixo durante scroll em 375/768/1920.
 *  4. Trace + screenshot + vídeo automáticos em caso de falha (test.use).
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import { seedAndMock } from '../helpers/cart-mock';


// Diagnóstico automático: ativa trace/screenshot/vídeo apenas neste spec,
// sem alterar a configuração global do Playwright.
test.use({
  trace: 'retain-on-failure',
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
});

async function bootstrap(page: Page) {
  await loginAs(page, 'seller');
  await gotoAndSettle(page, '/');
}

async function openPopover(page: Page) {
  const trigger = page.getByTestId('cart-trigger');
  await trigger.click();
  await expect(page.getByTestId('cart-drawer')).toBeVisible();
  return trigger;
}

test.describe('Carrinhos · fechamento e regressão visual @smoke', () => {
  test('clique fora fecha o popover e devolve o foco ao trigger', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await bootstrap(page);
    await seedAndMock(page, { count: 3, itemsPerCart: 3 });
    await page.reload();

    const trigger = await openPopover(page);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('cart-popover-footer')).toBeVisible();
    await expect(page.getByTestId('cart-popover-scroll')).toBeVisible();

    // Clique fora do popover (canto superior esquerdo, longe do drawer)
    await page.mouse.click(5, 5);

    await expect(page.getByTestId('cart-drawer')).toBeHidden();
    await expect(page.getByTestId('cart-popover-footer')).toHaveCount(0);
    await expect(page.getByTestId('cart-popover-scroll')).toHaveCount(0);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // Radix Popover devolve o foco ao trigger por padrão
    await expect(trigger).toBeFocused();
  });

  test('Escape fecha o popover, devolve o foco ao trigger e zera aria-expanded', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await bootstrap(page);
    await seedAndMock(page, { count: 3, itemsPerCart: 3 });
    await page.reload();

    const trigger = await openPopover(page);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Escape');

    await expect(page.getByTestId('cart-drawer')).toBeHidden();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
    // role do trigger continua válido (Radix usa <button>)
    await expect(trigger).toHaveAttribute('aria-haspopup', /dialog|menu/);
  });

  for (const vp of [
    { name: 'mobile-375', width: 375, height: 812 },
    { name: 'tablet-768', width: 768, height: 1024 },
    { name: 'ultrawide-1920', width: 1920, height: 1080 },
  ]) {
    test(`regressão visual · rodapé fixo durante scroll — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await bootstrap(page);
      await seedAndMock(page, { count: 3, itemsPerCart: 3 });
      await page.reload();
      await openPopover(page);

      const footer = page.getByTestId('cart-popover-footer');
      await expect(footer).toBeVisible();
      const before = await footer.boundingBox();
      expect(before).not.toBeNull();

      // Rola o ScrollArea
      const viewport = page.locator('[data-radix-scroll-area-viewport]').first();
      await viewport.evaluate((el) =>
        el.scrollBy({ top: 600, behavior: 'instant' as ScrollBehavior }),
      );
      await page.waitForTimeout(150);

      const after = await footer.boundingBox();
      expect(after).not.toBeNull();
      // Falha se o rodapé sair da posição esperada (tolerância 1px sub-pixel)
      expect(Math.abs((after!.y ?? 0) - (before!.y ?? 0))).toBeLessThanOrEqual(1);
      expect(Math.abs((after!.height ?? 0) - (before!.height ?? 0))).toBeLessThanOrEqual(1);

      // Snapshot visual do rodapé após scroll
      await expect(footer).toHaveScreenshot(`cart-footer-scrolled-${vp.name}.png`, {
        animations: 'disabled',
        maxDiffPixelRatio: 0.02,
      });
    });
  }
});
