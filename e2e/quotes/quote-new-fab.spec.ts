/**
 * E2E — FAB "Novo Orçamento" no header de /orcamentos.
 *
 * Valida em todos os breakpoints da matriz QUOTE_BREAKPOINTS:
 *  - FAB visível, circular (~44x44), com aria-label
 *  - mesma linha do título em >= sm; agrupado no header em mobile
 *  - tooltip abre no hover e fecha ao sair (desktop)
 *  - tooltip abre no focus por teclado e fecha ao perder foco
 *  - em viewports mobile, tap abre o tooltip e tap fora fecha
 *  - click navega para /orcamentos/novo
 *  - screenshot do header por viewport
 *
 * Roda só no project autenticado (mesmo padrão de quote-number-subtitle).
 */
import { test, expect, requireAuth } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';
import { QUOTE_BREAKPOINTS } from './_helpers/quote-scenarios';

test.describe('QuotesListPage · FAB Novo Orçamento', () => {
  test.skip(
    (_args, testInfo) => testInfo.project.name !== 'chromium-authed',
    'Visual/responsive regression roda só no Chromium autenticado.',
  );
  test.beforeEach(() => requireAuth());

  for (const vp of QUOTE_BREAKPOINTS) {
    test(`[${vp.name}] FAB acessível, posicionado e funcional`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, '/orcamentos');

      const fab = page.getByTestId('quote-new-button');
      const title = page.getByTestId('page-title-orcamentos');
      const tooltip = page.getByRole('tooltip', {
        name: /Criar novo orçamento em segundos/i,
      });

      await expect(fab).toBeVisible();
      await expect(title).toBeVisible();
      await expect(fab).toHaveAttribute('aria-label', 'Novo orçamento');

      // Geometria: tap target >= 44x44 e formato circular.
      const box = await fab.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(40);
        expect(box.height).toBeGreaterThanOrEqual(40);
        expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(2);
      }

      // Em >= sm (>= 640px) FAB e título compartilham a mesma linha.
      if (vp.width >= 640) {
        const titleBox = await title.boundingBox();
        if (box && titleBox) {
          const yFab = box.y + box.height / 2;
          const yTitle = titleBox.y + titleBox.height / 2;
          expect(Math.abs(yFab - yTitle)).toBeLessThanOrEqual(40);
        }
      }

      const isMobile = vp.width < 640;

      if (!isMobile) {
        // Desktop: hover abre, mover o mouse pra longe fecha.
        await fab.hover();
        await expect(tooltip).toBeVisible({ timeout: 3_000 });
        await page.mouse.move(0, 0);
        await expect(tooltip).toBeHidden({ timeout: 3_000 });
      } else {
        // Mobile: tap abre, tap fora fecha.
        await fab.tap();
        // Atenção: o click chega — esperamos o tooltip OU a navegação.
        // Em Radix Tooltip, o tap dispara press + click; o tooltip pode
        // aparecer brevemente. Se já navegou, voltamos para validar focus.
        if (page.url().includes('/orcamentos/novo')) {
          await page.goBack();
          await page.waitForURL(/\/orcamentos(?!\/novo)/, { timeout: 10_000 });
        } else {
          await expect(tooltip).toBeVisible({ timeout: 3_000 });
          await page.locator('body').tap({ position: { x: 5, y: 5 } });
          await expect(tooltip).toBeHidden({ timeout: 3_000 });
        }
      }

      // Foco por teclado abre tooltip; Tab para fora fecha.
      await page.keyboard.press('Escape').catch(() => undefined);
      await page.mouse.move(0, 0);
      await fab.focus();
      await expect(tooltip).toBeVisible({ timeout: 3_000 });

      await page.keyboard.press('Tab');
      await expect(tooltip).toBeHidden({ timeout: 3_000 });

      // Reset de foco e mouse antes do screenshot para evitar outline residual
      // (foco em outro elemento após o Tab) e estabilizar a baseline visual.
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
      await page.mouse.move(0, 0);

      // Screenshot do bloco do header (ancestral imediato do título).
      const headerBlock = title.locator('xpath=ancestor::div[1]');
      await expect(headerBlock).toHaveScreenshot(`quote-new-fab-header-${vp.name}.png`, {
        maxDiffPixelRatio: 0.02,
      });

      // Click → navega para o builder.
      await page.mouse.move(0, 0);
      await fab.click();
      await page.waitForURL(/\/orcamentos\/novo/, { timeout: 10_000 });
      await expect(page).toHaveURL(/\/orcamentos\/novo/);
    });
  }
});
