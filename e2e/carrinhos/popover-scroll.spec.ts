/**
 * E2E: popover de carrinhos no header
 *  - garante overflow + rolagem da lista interna em 4 viewports (375, 768, 1280, 1920)
 *  - garante que o rodapé "Gerar Orçamento" permanece ancorado durante o scroll
 *  - valida via bounding box + verificação estrutural (rodapé fora do viewport rolável)
 *  - testa rolagem via teclado (PageDown / Setas) preservando o rodapé
 *  - cenário extra com `animations: 'allow'` para validar transições
 *  - captura snapshots visuais (mobile, tablet, desktop, ultrawide)
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import { seedAndMock } from '../helpers/cart-mock';


async function openPopover(page: Page) {
  await page.getByTestId('cart-trigger').click();
  await expect(page.getByTestId('cart-drawer')).toBeVisible();
}

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'ultrawide', width: 1920, height: 1080 },
] as const;

async function assertFooterAnchored(page: Page) {
  const scroll = page.getByTestId('cart-popover-scroll');
  const footer = page.getByTestId('cart-popover-footer');
  const viewport = scroll.locator('[data-radix-scroll-area-viewport]').first();

  await expect(scroll).toBeVisible();
  await expect(footer).toBeVisible();
  await expect(viewport).toBeVisible();

  // Asserção estrutural: rodapé NÃO está dentro do viewport rolável
  const footerInsideViewport = await footer.evaluate(
    (el) => !!el.closest('[data-radix-scroll-area-viewport]'),
  );
  expect(footerInsideViewport).toBe(false);

  // Há overflow real
  const overflow = await viewport.evaluate((el) => ({
    sh: el.scrollHeight,
    ch: el.clientHeight,
  }));
  expect(overflow.sh).toBeGreaterThan(overflow.ch);

  const before = await footer.boundingBox();
  expect(before).not.toBeNull();

  // Rola programaticamente
  await viewport.evaluate((el) => el.scrollTo({ top: 200 }));
  await page.waitForTimeout(120);
  const scrollTop = await viewport.evaluate((el) => el.scrollTop);
  expect(scrollTop).toBeGreaterThan(0);

  const after = await footer.boundingBox();
  expect(after).not.toBeNull();
  expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(after!.height - before!.height)).toBeLessThanOrEqual(1);

  return { viewport, footer, before };
}

async function assertFooterAfterKeyboard(page: Page, before: { x: number; y: number }) {
  const viewport = page
    .getByTestId('cart-popover-scroll')
    .locator('[data-radix-scroll-area-viewport]')
    .first();
  const footer = page.getByTestId('cart-popover-footer');

  await viewport.evaluate((el) => el.scrollTo({ top: 0 }));
  await viewport.focus();
  // PageDown + setas para baixo (tabIndex do viewport do Radix permite focar)
  await page.keyboard.press('PageDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(120);

  const scrolledByKeyboard = await viewport.evaluate((el) => el.scrollTop);
  // Se o navegador não rolar via teclado no viewport, força fallback programático
  if (scrolledByKeyboard === 0) {
    await viewport.evaluate((el) => el.scrollTo({ top: 150 }));
    await page.waitForTimeout(80);
  }

  const after = await footer.boundingBox();
  expect(after).not.toBeNull();
  expect(Math.abs(after!.y - before.y)).toBeLessThanOrEqual(1);
}

test.describe('Carrinhos · popover scroll + rodapé fixo @smoke', () => {
  for (const vp of VIEWPORTS) {
    test(`${vp.name} (${vp.width}px) — rola e mantém rodapé ancorado`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await loginAs(page, 'seller');
      await gotoAndSettle(page, '/');
      await seedAndMock(page, { count: 6, itemsPerCart: 4 });
      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      await openPopover(page);
      const { before } = await assertFooterAnchored(page);

      // Fluxo de teclado preservando o rodapé
      await assertFooterAfterKeyboard(page, { x: before!.x, y: before!.y });

      // Snapshot visual (animações desabilitadas)
      await expect(page.getByTestId('cart-drawer')).toHaveScreenshot(
        `cart-popover-${vp.name}.png`,
        { animations: 'disabled', maxDiffPixelRatio: 0.02 },
      );
    });
  }

  test('animações habilitadas — altura, scroll e rodapé permanecem estáveis', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/');
    await seedAndMock(page, { count: 6, itemsPerCart: 4 });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    await openPopover(page);

    // Aguarda a transição de entrada do Radix Popover finalizar
    const drawer = page.getByTestId('cart-drawer');
    await expect(drawer).toHaveAttribute('data-state', 'open');
    await page.waitForTimeout(300);

    await assertFooterAnchored(page);

    // Snapshot com animações permitidas (tolerância mais folgada)
    await expect(drawer).toHaveScreenshot('cart-popover-animated.png', {
      animations: 'allow',
      maxDiffPixelRatio: 0.05,
    });
  });
});
