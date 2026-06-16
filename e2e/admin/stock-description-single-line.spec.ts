/**
 * E2E — Descrição do StockDashboardPage:
 *  - permanece em uma única linha (altura == max-h fixa)
 *  - quando truncada (ellipsis), expõe texto completo via `title` + `aria-label`
 *  - line-height/max-height estáveis (não dependem de fonte renderizada)
 */
import { test, expect } from '../fixtures/test-base';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

const FULL_TEXT =
  'Acompanhe níveis de estoque e disponibilidade dos produtos em tempo real.';

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
] as const;

test.describe('Estoque — descrição em linha única + ellipsis acessível', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  for (const vp of VIEWPORTS) {
    test(`linha única e tooltip acessível em ${vp.name} (${vp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, '/estoque');

      const desc = page.getByTestId('page-description-estoque');
      await expect(desc).toBeVisible();

      // Atributos acessíveis com texto completo (tooltip nativo + a11y).
      await expect(desc).toHaveAttribute('title', FULL_TEXT);
      await expect(desc).toHaveAttribute('aria-label', FULL_TEXT);

      const metrics = await desc.evaluate((el) => {
        const cs = window.getComputedStyle(el);
        return {
          clientHeight: el.clientHeight,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          lineHeightPx: parseFloat(cs.lineHeight),
          maxHeight: cs.maxHeight,
          whiteSpace: cs.whiteSpace,
          overflow: cs.overflow,
          textOverflow: cs.textOverflow,
        };
      });

      // Linha única estável: altura ≈ line-height (fixo via classe `leading-5 max-h-5`).
      expect(metrics.whiteSpace).toBe('nowrap');
      expect(metrics.textOverflow).toBe('ellipsis');
      expect(metrics.overflow).toMatch(/hidden/);
      expect(metrics.lineHeightPx).toBeGreaterThan(0);
      expect(metrics.clientHeight).toBeLessThanOrEqual(metrics.lineHeightPx + 1);
      expect(metrics.maxHeight).not.toBe('none');

      // Se truncou (scrollWidth > clientWidth), texto completo continua acessível
      // via title/aria-label — já verificados acima.
      const truncated = metrics.scrollWidth > metrics.clientWidth + 1;
      // sanity: textContent permanece íntegro mesmo truncado visualmente
      await expect(desc).toHaveText(FULL_TEXT);
      // marcador semântico: quando truncado, tooltip é o que entrega o texto
      if (truncated) {
        expect(await desc.getAttribute('title')).toBe(FULL_TEXT);
      }
    });
  }
});
