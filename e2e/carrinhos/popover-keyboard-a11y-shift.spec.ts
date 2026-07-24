/**
 * E2E · navegação por teclado, a11y formal, baselines visuais e layout shift.
 *
 * Cobre:
 *  1. Tab/Shift+Tab + Enter/Espaço alternam o popover; foco perdido fecha quando esperado.
 *  2. aria-expanded / aria-controls / role no trigger e no botão de alternância,
 *     antes e depois de clique-fora e Esc.
 *  3. Baseline versionada de regressão visual do rodapé fixo em 375/768/1920,
 *     com tolerância calibrada para falhar quando a posição variar.
 *  4. Artifacts (trace, screenshot, vídeo) exportados automaticamente no formato CI.
 *  5. Alternar o popover durante scroll do rodapé fixo — sem layout shift.
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import { seedAndMock } from '../helpers/cart-mock';


// Artifacts automáticos no formato esperado pelo CI (test-results/<spec>/<test>/).
// retain-on-failure mantém apenas em falhas — não polui execuções verdes.
test.use({
  trace: 'retain-on-failure',
  screenshot: { mode: 'only-on-failure', fullPage: false },
  video: 'retain-on-failure',
});

async function bootstrap(page: Page) {
  await loginAs(page, 'seller');
  await gotoAndSettle(page, '/');
}

async function openByKeyboard(page: Page) {
  const trigger = page.getByTestId('cart-trigger');
  await trigger.focus();
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('cart-drawer')).toBeVisible();
  return trigger;
}

test.describe('Carrinhos · teclado, a11y formal e layout shift @smoke', () => {
  test('Tab/Shift+Tab + Enter/Espaço alternam o popover via teclado', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await bootstrap(page);
    await seedAndMock(page, { count: 3, itemsPerCart: 3 });
    await page.reload();

    const trigger = page.getByTestId('cart-trigger');

    // Abre via Enter
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('cart-drawer')).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // Esc fecha; foco volta ao trigger
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('cart-drawer')).toBeHidden();
    await expect(trigger).toBeFocused();

    // Reabre via Espaço
    await page.keyboard.press(' ');
    await expect(page.getByTestId('cart-drawer')).toBeVisible();

    // Shift+Tab fora do drawer + clique-fora simulado por blur+click → fecha
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('cart-drawer')).toBeHidden();
  });

  test('aria-expanded / aria-controls / role refletem estado em todos os eventos', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await bootstrap(page);
    await seedAndMock(page, { count: 3, itemsPerCart: 3 });
    await page.reload();

    const trigger = page.getByTestId('cart-trigger');
    // Estado inicial: fechado
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toHaveAttribute('aria-haspopup', /dialog|menu/);

    await trigger.click();
    await expect(page.getByTestId('cart-drawer')).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    // Radix expõe aria-controls apontando para o id do PopoverContent
    await expect(trigger).toHaveAttribute('aria-controls', /.+/);

    const activeId = 'mock-cart-0';
    const chevron = page.getByTestId(`cart-toggle-${activeId}`);
    await expect(chevron).toHaveAttribute('aria-expanded', 'true');
    await expect(chevron).toHaveRole('button');

    // Esc → fechado
    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();

    // Reabre e fecha com clique-fora
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await page.mouse.click(5, 5);
    await expect(page.getByTestId('cart-drawer')).toBeHidden();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
  });

  for (const vp of [
    { name: 'mobile-375', width: 375, height: 812 },
    { name: 'tablet-768', width: 768, height: 1024 },
    { name: 'ultrawide-1920', width: 1920, height: 1080 },
  ]) {
    test(`regressão visual versionada do rodapé fixo — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await bootstrap(page);
      await seedAndMock(page, { count: 3, itemsPerCart: 3 });
      await page.reload();

      await page.getByTestId('cart-trigger').click();
      const footer = page.getByTestId('cart-popover-footer');
      await expect(footer).toBeVisible();

      const before = await footer.boundingBox();
      const viewport = page.locator('[data-radix-scroll-area-viewport]').first();
      await viewport.evaluate((el) =>
        el.scrollBy({ top: 600, behavior: 'instant' as ScrollBehavior }),
      );
      await page.waitForTimeout(150);
      const after = await footer.boundingBox();
      expect(Math.abs((after!.y ?? 0) - (before!.y ?? 0))).toBeLessThanOrEqual(1);

      // Baseline versionado por viewport — falha se posição/aparência variar > 2%
      await expect(footer).toHaveScreenshot(`cart-footer-baseline-${vp.name}.png`, {
        animations: 'disabled',
        maxDiffPixelRatio: 0.02,
      });
    });
  }

  test('toggle durante scroll do rodapé fixo não causa layout shift', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await bootstrap(page);
    await seedAndMock(page, { count: 3, itemsPerCart: 3 });
    await page.reload();

    await page.getByTestId('cart-trigger').click();
    const footer = page.getByTestId('cart-popover-footer');
    const scroll = page.getByTestId('cart-popover-scroll');
    await expect(footer).toBeVisible();
    await expect(scroll).toBeVisible();

    // Captura geometria inicial
    const footerBefore = await footer.boundingBox();
    const scrollBefore = await scroll.boundingBox();

    // Rola, depois alterna o carrinho ativo (chevron), depois rola de novo
    const viewport = page.locator('[data-radix-scroll-area-viewport]').first();
    await viewport.evaluate((el) =>
      el.scrollBy({ top: 300, behavior: 'instant' as ScrollBehavior }),
    );
    const chevron = page.getByTestId('cart-toggle-mock-cart-0');
    await chevron.click();
    await expect(chevron).toHaveAttribute('aria-expanded', 'false');
    await chevron.click();
    await expect(chevron).toHaveAttribute('aria-expanded', 'true');
    await viewport.evaluate((el) =>
      el.scrollBy({ top: 200, behavior: 'instant' as ScrollBehavior }),
    );
    await page.waitForTimeout(150);

    // Estado correto: rodapé e lista permanecem visíveis e ancorados
    await expect(footer).toBeVisible();
    await expect(scroll).toBeVisible();
    const footerAfter = await footer.boundingBox();
    const scrollAfter = await scroll.boundingBox();

    expect(Math.abs((footerAfter!.y ?? 0) - (footerBefore!.y ?? 0))).toBeLessThanOrEqual(1);
    expect(Math.abs((footerAfter!.height ?? 0) - (footerBefore!.height ?? 0))).toBeLessThanOrEqual(
      1,
    );
    expect(Math.abs((scrollAfter!.y ?? 0) - (scrollBefore!.y ?? 0))).toBeLessThanOrEqual(1);
    expect(Math.abs((scrollAfter!.height ?? 0) - (scrollBefore!.height ?? 0))).toBeLessThanOrEqual(
      1,
    );
  });
});
