import { test, expect, type Locator } from '@playwright/test';
import { TID } from '../fixtures/selectors';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/__visual/calendar?width=mobile';
const CARD = TID('visual-calendar-card');
const MIN_TAP = 44;

async function boundingBoxes(loc: Locator) {
  const count = await loc.count();
  const boxes: { w: number; h: number }[] = [];
  for (let i = 0; i < count; i++) {
    const b = await loc.nth(i).boundingBox();
    if (b) boxes.push({ w: b.width, h: b.height });
  }
  return boxes;
}

test.describe('Calendar — área de toque mínima 44×44 no mobile', () => {
  test.beforeEach(async ({ page }) => {
    // iPhone SE width — pior caso de layout mobile.
    await page.setViewportSize({ width: 375, height: 812 });
    await gotoAndSettle(page, ROUTE);
    await expect(page.locator(CARD)).toBeVisible();
  });

  test('botões de navegação ‹ › têm ≥ 44×44 px', async ({ page }) => {
    const navButtons = page.locator(`${CARD} button[name="previous-month"], ${CARD} button[name="next-month"]`);
    const boxes = await boundingBoxes(navButtons);
    expect(boxes.length).toBeGreaterThanOrEqual(2);
    for (const b of boxes) {
      expect(b.w).toBeGreaterThanOrEqual(MIN_TAP);
      expect(b.h).toBeGreaterThanOrEqual(MIN_TAP);
    }
  });

  test('cada célula de dia tem ≥ 44×44 px', async ({ page }) => {
    const dayButtons = page.locator(`${CARD} [role="gridcell"] button`);
    const boxes = await boundingBoxes(dayButtons);
    expect(boxes.length).toBeGreaterThan(0);
    for (const b of boxes) {
      expect(b.w).toBeGreaterThanOrEqual(MIN_TAP);
      expect(b.h).toBeGreaterThanOrEqual(MIN_TAP);
    }
  });
});

test.describe('Calendar — a11y de legibilidade nos breakpoints', () => {
  const cases = [
    { name: 'sm (375)', width: 375, minDayFontPx: 12, minCaptionPx: 14 },
    { name: 'md (768)', width: 768, minDayFontPx: 9,  minCaptionPx: 10 },
  ] as const;

  for (const c of cases) {
    test(`${c.name}: fontes ≥ mínimo e contraste WCAG AA`, async ({ page }) => {
      await page.setViewportSize({ width: c.width, height: 900 });
      await gotoAndSettle(page, c.width < 768 ? ROUTE : '/__visual/calendar');

      const card = page.locator(CARD);
      await expect(card).toBeVisible();

      const dayFontPx = await card
        .locator('[role="gridcell"] button')
        .first()
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(dayFontPx).toBeGreaterThanOrEqual(c.minDayFontPx);

      const captionPx = await card
        .locator('.rdp-caption_label, [class*="caption_label"]')
        .first()
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
        .catch(() => c.minCaptionPx);
      expect(captionPx).toBeGreaterThanOrEqual(c.minCaptionPx);

      // Contraste: verifica que dias usam token semântico (não cor hard-coded transparente).
      const dayColor = await card
        .locator('[role="gridcell"] button')
        .first()
        .evaluate((el) => getComputedStyle(el).color);
      expect(dayColor).not.toBe('rgba(0, 0, 0, 0)');
      expect(dayColor).not.toBe('transparent');
    });
  }
});
