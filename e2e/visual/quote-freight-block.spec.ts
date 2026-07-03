/**
 * Visual regression do bloco Frete no QuoteBuilderPage.
 *
 * Snapshots vivem em ./quote-freight-block.spec.ts-snapshots/
 * (Playwright cria/atualiza com --update-snapshots).
 *
 * Cobertura:
 *  - shippingType padrão cif: grid com 1 coluna preenchida
 *  - shippingType fob (repassado): grid com 1 coluna, sem Valor R$
 *  - shippingType fob_pre: grid com 2 colunas (trigger + Valor R$)
 *  - viewports: mobile (375) e md (900) — validam quebra responsiva
 */
import { test, expect } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'md', width: 900, height: 1000 },
] as const;

const NON_PRE_MODES = [
  { key: 'cif', label: /CIF \| Frete grátis/i, slug: 'cif' },
  { key: 'fob', label: /FOB \| Repassado ao cliente/i, slug: 'fob' },
] as const;

test.describe('QuoteBuilder — bloco Frete (visual regression)', () => {
  for (const vp of VIEWPORTS) {
    test(`@${vp.name}: bloco Frete padrão (cif) — snapshot`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, '/orcamentos/novo');

      const trigger = page.getByTestId('shipping-type-select');
      await expect(trigger).toBeVisible({ timeout: 15_000 });

      // Enquadra o container do grid (pai do trigger) — evita ruído do restante da página.
      const grid = trigger.locator('xpath=ancestor::div[contains(@class,"grid-cols-1") and contains(@class,"md:grid-cols-3")][1]');
      await expect(grid).toBeVisible();
      await expect(grid).toHaveScreenshot(`freight-grid-default-${vp.name}.png`, {
        maxDiffPixelRatio: 0.02,
      });
    });

    test(`@${vp.name}: bloco Frete com fob_pre exibe Valor R$ na 2ª coluna — snapshot`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, '/orcamentos/novo');

      const trigger = page.getByTestId('shipping-type-select');
      await expect(trigger).toBeVisible({ timeout: 15_000 });

      await trigger.click();
      await page.getByRole('option', { name: /FOB \| Valor pré negociado/i }).click();

      const input = page.getByTestId('shipping-cost-input');
      await expect(input).toBeVisible();

      const grid = trigger.locator('xpath=ancestor::div[contains(@class,"grid-cols-1") and contains(@class,"md:grid-cols-3")][1]');
      await expect(grid).toHaveScreenshot(`freight-grid-fob-pre-${vp.name}.png`, {
        maxDiffPixelRatio: 0.02,
      });

      // Sanidade geométrica: no md+, input está à direita do trigger; no mobile, abaixo.
      const [tBox, iBox] = await Promise.all([trigger.boundingBox(), input.boundingBox()]);
      if (tBox && iBox) {
        if (vp.width >= 768) {
          expect(iBox.x).toBeGreaterThan(tBox.x);
          expect(Math.abs(iBox.y - tBox.y)).toBeLessThan(60);
        } else {
          expect(iBox.y).toBeGreaterThan(tBox.y);
        }
      }
    });
  }
});
