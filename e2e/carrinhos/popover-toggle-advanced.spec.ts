/**
 * E2E avançado · toggle do carrinho ativo no popover de carrinhos.
 *
 * Cobre:
 *  1. Tecla Esc fecha o popover e rodapé/lista somem do DOM.
 *  2. Ordem de tabulação e foco no header/chevron ao alternar (desktop + mobile).
 *  3. Carrinhos sem itens — toggle continua funcional e rodapé não vaza.
 *  4. Scroll do ScrollArea após abrir, com rodapé fixo (bounding box) em
 *     375px / 768px / 1920px.
 *  5. Acessibilidade — aria-expanded / aria-pressed antes e depois do toggle.
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import { seedAndMock } from '../helpers/cart-mock';


async function bootstrap(page: Page) {
  await loginAs(page, 'seller');
  await gotoAndSettle(page, '/');
}

async function openPopover(page: Page) {
  await page.getByTestId('cart-trigger').click();
  await expect(page.getByTestId('cart-drawer')).toBeVisible();
}

test.describe('Carrinhos · toggle avançado @smoke', () => {
  test('Esc fecha o popover e remove rodapé/lista', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await bootstrap(page);
    await seedAndMock(page, { count: 3, itemsPerCart: 3 });
    await page.reload();
    await openPopover(page);

    await expect(page.getByTestId('cart-popover-footer')).toBeVisible();
    await expect(page.getByTestId('cart-popover-scroll')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('cart-drawer')).toBeHidden();
    await expect(page.getByTestId('cart-popover-footer')).toHaveCount(0);
    await expect(page.getByTestId('cart-popover-scroll')).toHaveCount(0);
  });

  for (const vp of [
    { name: 'mobile', width: 375, height: 812 },
    { name: 'desktop', width: 1280, height: 800 },
  ]) {
    test(`foco e tab order no header/chevron ao alternar — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await bootstrap(page);
      await seedAndMock(page, { count: 3, itemsPerCart: 3 });
      await page.reload();
      await openPopover(page);

      const activeId = 'mock-cart-0';
      const chevron = page.getByTestId(`cart-toggle-${activeId}`);
      const header = page
        .getByRole('button', { name: /Recolher carrinho de Empresa mock 00/i })
        .first();

      // a11y antes do toggle: expandido
      await expect(header).toHaveAttribute('aria-expanded', 'true');
      await expect(header).toHaveAttribute('aria-pressed', 'true');
      await expect(chevron).toHaveAttribute('aria-expanded', 'true');

      // foca header e recolhe via teclado (Enter)
      await header.focus();
      await expect(header).toBeFocused();
      await page.keyboard.press('Enter');

      // a11y após toggle: recolhido
      const headerCollapsed = page
        .getByRole('button', { name: /Expandir carrinho de Empresa mock 00/i })
        .first();
      await expect(headerCollapsed).toHaveAttribute('aria-expanded', 'false');
      await expect(headerCollapsed).toHaveAttribute('aria-pressed', 'false');
      await expect(chevron).toHaveAttribute('aria-expanded', 'false');

      // foco continua dentro do popover (header ou chevron)
      const focused = await page.evaluate(
        () => document.activeElement?.getAttribute('data-testid') ?? document.activeElement?.tagName,
      );
      expect(focused).toBeTruthy();

      // re-expande via chevron com teclado
      await chevron.focus();
      await expect(chevron).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(chevron).toHaveAttribute('aria-expanded', 'true');
    });
  }

  test('carrinhos sem itens — toggle continua correto e rodapé não vaza', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await bootstrap(page);
    await seedAndMock(page, { count: 3, itemsPerCart: 3 });
    await page.reload();
    await openPopover(page);

    const activeId = 'mock-cart-0';
    const chevron = page.getByTestId(`cart-toggle-${activeId}`);

    // sem itens, rodapé "Gerar Orçamento" não deve aparecer
    await expect(page.getByTestId('cart-popover-footer')).toHaveCount(0);
    await expect(chevron).toHaveAttribute('aria-expanded', 'true');

    // toggle continua funcional
    await chevron.click();
    await expect(chevron).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('cart-popover-footer')).toHaveCount(0);

    await chevron.click();
    await expect(chevron).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('cart-popover-footer')).toHaveCount(0);
  });

  for (const vp of [
    { name: 'mobile-375', width: 375, height: 812 },
    { name: 'tablet-768', width: 768, height: 1024 },
    { name: 'ultrawide-1920', width: 1920, height: 1080 },
  ]) {
    test(`scroll do ScrollArea com rodapé fixo (bbox) — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await bootstrap(page);
      await seedAndMock(page, { count: 3, itemsPerCart: 3 });
      await page.reload();
      await openPopover(page);

      const footer = page.getByTestId('cart-popover-footer');
      await expect(footer).toBeVisible();
      const before = await footer.boundingBox();
      expect(before).not.toBeNull();

      const viewport = page.locator('[data-radix-scroll-area-viewport]').first();
      await viewport.evaluate((el) => el.scrollBy({ top: 400, behavior: 'instant' as ScrollBehavior }));
      await page.waitForTimeout(150);

      await expect(footer).toBeVisible();
      const after = await footer.boundingBox();
      expect(after).not.toBeNull();
      // rodapé permanece ancorado (tolerância 1px p/ sub-pixel)
      expect(Math.abs((after!.y ?? 0) - (before!.y ?? 0))).toBeLessThanOrEqual(1);
      expect(Math.abs((after!.height ?? 0) - (before!.height ?? 0))).toBeLessThanOrEqual(1);

      // rodapé NÃO está dentro do viewport rolável
      const insideScroll = await footer.evaluate(
        (el) => !!el.closest('[data-radix-scroll-area-viewport]'),
      );
      expect(insideScroll).toBe(false);
    });
  }
});
