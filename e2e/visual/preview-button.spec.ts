/**
 * Visual regression — Preview button (QuoteViewPage)
 *
 * Roda no project `chromium-public` contra a rota dev-only
 * `/__visual/preview-button`. Baselines em
 * `e2e/visual/preview-button.spec.ts-snapshots/`.
 *
 * NOTA sobre `reduced-motion`: NÃO usamos screenshot porque
 * `animations: 'disabled'` (Playwright) já congela animações
 * independentemente da media query — o PNG ficaria idêntico ao
 * default e o teste viraria tautologia. A verificação correta é
 * semântica via `getComputedStyle(el).animationName === 'none'`.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const ROUTE = '/__visual/preview-button';
const BUTTON = '[data-testid="pdf-preview-trigger"]';

const SCREENSHOT_OPTS = {
  animations: 'disabled' as const,
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
    await page.waitForTimeout(750); // shimmer translate 700ms
    await expect(btn).toHaveScreenshot('preview-hover-light.png', SCREENSHOT_OPTS);
  });

  test('focus-visible (light) — breath pausado, sem shimmer', async ({ page }) => {
    await page.goto(ROUTE);
    await page.locator('[data-testid="anchor-before"]').focus();
    await page.keyboard.press('Shift+Tab');
    const btn = page.locator(BUTTON);
    await expect(btn).toBeFocused();
    await expect(btn).toHaveScreenshot('preview-focus-light.png', SCREENSHOT_OPTS);
  });

  test('reduced-motion — breath desativado (computed-style, sem tautologia)', async ({ page, context }) => {
    await context.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(ROUTE);
    const btn = page.locator(BUTTON);
    await expect(btn).toBeVisible();

    const reduced = await btn.evaluate((el) => ({
      root: getComputedStyle(el).animationName,
      after: getComputedStyle(el, '::after').animationName,
    }));
    expect(reduced.root, 'breath na raiz deve estar desativado').toBe('none');
    expect(reduced.after, 'breath no ::after deve estar desativado').toBe('none');

    // Sanidade reversa: sem reduced-motion, breath está ativo
    await context.emulateMedia({ reducedMotion: 'no-preference' });
    await page.reload();
    const active = await btn.evaluate((el) => ({
      root: getComputedStyle(el).animationName,
      after: getComputedStyle(el, '::after').animationName,
    }));
    expect(active.root).toBe('preview-breath');
    expect(active.after).toBe('preview-breath-border');
  });

  test('default (dark)', async ({ page }) => {
    await page.goto(`${ROUTE}?theme=dark`);
    const btn = page.locator(BUTTON);
    await expect(btn).toBeVisible();
    await expect(btn).toHaveScreenshot('preview-default-dark.png', SCREENSHOT_OPTS);
  });

  test('hover (dark)', async ({ page }) => {
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
        .withRules(['color-contrast'])
        .analyze();

      expect(
        results.violations,
        `Violações de contraste no tema ${theme}: ${JSON.stringify(results.violations, null, 2)}`,
      ).toEqual([]);
    });
  }
});
