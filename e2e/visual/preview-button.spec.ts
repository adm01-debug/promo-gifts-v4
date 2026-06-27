/**
 * Visual regression — Preview button (QuoteViewPage)
 *
 * Roda no project `chromium-public` (sem auth) contra a rota dev-only
 * `/__visual/preview-button`. Baselines versionadas em
 * `e2e/visual/preview-button.spec.ts-snapshots/`.
 *
 * Cobertura:
 *   1. default  — breath ativo, tema light
 *   2. hover    — shimmer + breath pausado
 *   3. focus    — focus-visible + breath pausado, shimmer NÃO dispara
 *   4. reduced-motion — breath desativado (motion-reduce)
 *   5. dark     — paridade visual em tema escuro
 *   6. axe      — contraste WCAG AA em light e dark
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const ROUTE = '/__visual/preview-button';
const BUTTON = '[data-testid="pdf-preview-trigger"]';

// Estabilidade: zera animações no momento do snapshot (não no axe).
const SCREENSHOT_OPTS = {
  animations: 'disabled' as const,
  // Tolerância pequena para diferenças sub-pixel de renderização
  maxDiffPixelRatio: 0.02,
};

test.describe('Preview button — visual regression', () => {
  test('default (light, idle)', async ({ page }) => {
    await page.goto(ROUTE);
    const btn = page.locator(BUTTON);
    await expect(btn).toBeVisible();
    await expect(btn).toHaveScreenshot('preview-default-light.png', SCREENSHOT_OPTS);
  });

  test('hover (light) — shimmer ativo, breath pausado', async ({ page }) => {
    await page.goto(ROUTE);
    const btn = page.locator(BUTTON);
    await btn.hover();
    // Espera o shimmer atingir o pico (translate 700ms)
    await page.waitForTimeout(750);
    await expect(btn).toHaveScreenshot('preview-hover-light.png', SCREENSHOT_OPTS);
  });

  test('focus-visible (light) — breath pausado, sem shimmer', async ({ page }) => {
    await page.goto(ROUTE);
    // Tab a partir da âncora garante focus-visible (vs. focus programático)
    await page.locator('[data-testid="anchor-before"]').focus();
    await page.keyboard.press('Shift+Tab');
    const btn = page.locator(BUTTON);
    await expect(btn).toBeFocused();
    await expect(btn).toHaveScreenshot('preview-focus-light.png', SCREENSHOT_OPTS);
  });

  test('reduced-motion (light) — breath desativado', async ({ page, context }) => {
    await context.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(ROUTE);
    const btn = page.locator(BUTTON);
    await expect(btn).toBeVisible();
    await expect(btn).toHaveScreenshot('preview-reduced-motion-light.png', SCREENSHOT_OPTS);
  });

  test('dark theme — default', async ({ page }) => {
    await page.goto(`${ROUTE}?theme=dark`);
    const btn = page.locator(BUTTON);
    await expect(btn).toBeVisible();
    await expect(btn).toHaveScreenshot('preview-default-dark.png', SCREENSHOT_OPTS);
  });

  test('dark theme — hover', async ({ page }) => {
    await page.goto(`${ROUTE}?theme=dark`);
    const btn = page.locator(BUTTON);
    await btn.hover();
    await page.waitForTimeout(750);
    await expect(btn).toHaveScreenshot('preview-hover-dark.png', SCREENSHOT_OPTS);
  });
});

test.describe('Preview button — contraste (axe-core)', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`contraste WCAG 2.1 AA — tema ${theme}`, async ({ page }) => {
      const url = theme === 'dark' ? `${ROUTE}?theme=dark` : ROUTE;
      await page.goto(url);
      await expect(page.locator(BUTTON)).toBeVisible();

      const results = await new AxeBuilder({ page })
        .include('[data-testid="visual-harness-root"]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        // Foco da regra: cor/contraste e estouro de texto
        .withRules(['color-contrast'])
        .analyze();

      expect(
        results.violations,
        `Violações de contraste no tema ${theme}: ${JSON.stringify(results.violations, null, 2)}`,
      ).toEqual([]);
    });
  }
});
