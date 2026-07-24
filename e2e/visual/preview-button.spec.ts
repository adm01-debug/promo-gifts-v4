/**
 * Visual regression — Preview button (QuoteViewPage)
 *
 * Thresholds por estado via env (ratio 0–1). Padrão = 0.02.
 *   VISUAL_THRESHOLD_DEFAULT
 *   VISUAL_THRESHOLD_PREVIEW_DEFAULT_LIGHT
 *   VISUAL_THRESHOLD_PREVIEW_HOVER_LIGHT
 *   VISUAL_THRESHOLD_PREVIEW_FOCUS_LIGHT
 *   VISUAL_THRESHOLD_PREVIEW_DEFAULT_DARK
 *   VISUAL_THRESHOLD_PREVIEW_HOVER_DARK
 *   VISUAL_THRESHOLD_QUOTE_TIMELINE_DARK
 *
 * Reduced-motion: validação semântica via getComputedStyle
 * (não usa screenshot p/ evitar tautologia com animations:'disabled').
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const ROUTE = '/__visual/preview-button';
const BUTTON = '[data-testid="pdf-preview-trigger"]';

const DEFAULT_RATIO = Number(process.env.VISUAL_THRESHOLD_DEFAULT ?? '0.02');

function ratio(envKey: string): number {
  const v = process.env[envKey];
  return v === undefined || v === '' ? DEFAULT_RATIO : Number(v);
}

const opts = (envKey: string) => ({
  animations: 'disabled' as const,
  maxDiffPixelRatio: ratio(envKey),
});

function dumpAxe(name: string, payload: unknown) {
  const path = `test-results/axe/${name}.json`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(payload, null, 2));
}

test.describe('Preview button — visual regression', () => {
  test('default (light, idle)', async ({ page }) => {
    await page.goto(ROUTE);
    const btn = page.locator(BUTTON);
    await expect(btn).toBeVisible();
    await expect(btn).toHaveScreenshot('preview-default-light.png', opts('VISUAL_THRESHOLD_PREVIEW_DEFAULT_LIGHT'));
  });

  test('hover (light) — shimmer ativo, breath pausado', async ({ page }) => {
    await page.goto(ROUTE);
    const btn = page.locator(BUTTON);
    await btn.hover();
    await page.waitForTimeout(750);
    await expect(btn).toHaveScreenshot('preview-hover-light.png', opts('VISUAL_THRESHOLD_PREVIEW_HOVER_LIGHT'));
  });

  test('focus-visible (light) — breath pausado, sem shimmer', async ({ page }) => {
    await page.goto(ROUTE);
    await page.locator('[data-testid="anchor-before"]').focus();
    await page.keyboard.press('Shift+Tab');
    const btn = page.locator(BUTTON);
    await expect(btn).toBeFocused();
    await expect(btn).toHaveScreenshot('preview-focus-light.png', opts('VISUAL_THRESHOLD_PREVIEW_FOCUS_LIGHT'));
  });

  test('reduced-motion — breath desativado (computed-style, sem tautologia)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(ROUTE);
    const btn = page.locator(BUTTON);
    await expect(btn).toBeVisible();

    const reduced = await btn.evaluate((el) => ({
      root: getComputedStyle(el).animationName,
      after: getComputedStyle(el, '::after').animationName,
    }));
    expect(reduced.root, 'breath na raiz deve estar desativado').toBe('none');
    expect(reduced.after, 'breath no ::after deve estar desativado').toBe('none');

    await page.emulateMedia({ reducedMotion: 'no-preference' });
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
    await expect(btn).toHaveScreenshot('preview-default-dark.png', opts('VISUAL_THRESHOLD_PREVIEW_DEFAULT_DARK'));
  });

  test('hover (dark)', async ({ page }) => {
    await page.goto(`${ROUTE}?theme=dark`);
    const btn = page.locator(BUTTON);
    await btn.hover();
    await page.waitForTimeout(750);
    await expect(btn).toHaveScreenshot('preview-hover-dark.png', opts('VISUAL_THRESHOLD_PREVIEW_HOVER_DARK'));
  });

  test('quote timeline (dark) — sem moldura, contraste em fundo preto', async ({ page }) => {
    await page.goto(`${ROUTE}?theme=dark&surface=quote-timeline`);
    const timeline = page.locator('[data-testid="quote-status-timeline"]');
    if (await timeline.count()) {
      await expect(timeline).toBeVisible();
      await expect(timeline).toHaveScreenshot('quote-timeline-dark.png', opts('VISUAL_THRESHOLD_QUOTE_TIMELINE_DARK'));
    } else {
      test.skip(true, 'Harness ainda não expõe a timeline (surface=quote-timeline).');
    }
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

      dumpAxe(`preview-${theme}`, results);

      expect(
        results.violations,
        `Violações de contraste no tema ${theme}: ${JSON.stringify(results.violations, null, 2)}`,
      ).toEqual([]);
    });
  }
});
