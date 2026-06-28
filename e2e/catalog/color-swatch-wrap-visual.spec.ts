/**
 * E2E — Regressão visual do wrap de bolinhas de cor no ProductCard.
 *
 * Contrato visual:
 *  - Até 2 linhas de bolinhas (`flex-wrap` + `max-h` calculado).
 *  - Quando overflow, última posição vira chip "+N" (preserva ordem).
 *  - Posição da 2ª linha estável entre quantidades variadas de cores.
 *
 * Estratégia:
 *  - Visita /catalogo (rota pública), aguarda hidratação.
 *  - Coleta os 3 primeiros cards QUE TÊM o chip "+N" visível
 *    (deterministicamente diferentes contagens; ordem fixa do catálogo).
 *  - Screenshot por card x viewport (desktop/mobile) com tolerância 2%.
 *
 * Baseline:
 *  npx playwright test e2e/catalog/color-swatch-wrap-visual.spec.ts --update-snapshots
 *
 * Tolerância: maxDiffPixelRatio 0.02 cobre antialiasing / sub-pixel.
 */
import { test, expect, type Page } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

// Quantos cards distintos capturar (com overflow). Cobre múltiplas contagens
// reais sem precisar montar dados sintéticos.
const SAMPLE_COUNT = 3;

const FREEZE_CSS = `
  *, *::before, *::after {
    transition: none !important;
    animation: none !important;
    caret-color: transparent !important;
  }
  /* Esconde imagens (data-dependent) para focar o snapshot na faixa de cores */
  [data-testid="product-card"] img { visibility: hidden !important; }
`;

async function settleCatalog(page: Page) {
  await page.waitForSelector('[data-testid="product-card"]', { timeout: 20_000 });
  await expect(page.locator('[data-testid="product-card-skeleton"]')).toHaveCount(0);
  await page.addStyleTag({ content: FREEZE_CSS });
}

test.describe('ProductCard — wrap de bolinhas (visual regression)', () => {
  for (const vp of VIEWPORTS) {
    test(`viewport ${vp.name}: até ${SAMPLE_COUNT} cards com overflow`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, '/catalogo');
      await settleCatalog(page);

      const cardsWithOverflow = page.locator(
        '[data-testid="product-card"]:has([data-testid="color-swatches-overflow"])',
      );
      const total = await cardsWithOverflow.count();
      test.skip(total === 0, 'Nenhum card com overflow no dataset atual.');

      const sample = Math.min(SAMPLE_COUNT, total);
      for (let i = 0; i < sample; i++) {
        const card = cardsWithOverflow.nth(i);
        await card.scrollIntoViewIfNeeded();

        const swatchGroup = card.locator('[role="radiogroup"]').first();
        await expect(swatchGroup).toBeVisible();

        // Valida invariante (visíveis + chip = total real conhecido pelo aria-label do group)
        const aria = (await swatchGroup.getAttribute('aria-label')) ?? '';
        const declaredTotal = Number(/(\d+)\s+cor/i.exec(aria)?.[1] ?? '0');
        expect(declaredTotal).toBeGreaterThan(0);

        const chip = card.getByTestId('color-swatches-overflow');
        const chipText = (await chip.textContent()) ?? '';
        const hidden = Number(chipText.replace(/\D/g, ''));
        const visibleSwatches = await card
          .locator('[data-testid^="color-swatch-"]')
          .count();
        expect(visibleSwatches + hidden).toBe(declaredTotal);

        await expect(swatchGroup).toHaveScreenshot(
          `swatch-wrap-${vp.name}-sample-${i}.png`,
          { maxDiffPixelRatio: 0.02 },
        );
      }
    });
  }
});
