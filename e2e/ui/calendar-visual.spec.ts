import { test, expect, type Locator } from '@playwright/test';
import { TID } from '../fixtures/selectors';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/__visual/calendar';
const CARD = TID('visual-calendar-card');

const VIEWPORTS = [
  { name: 'mobile', width: 320, height: 812 },
  { name: 'md', width: 768, height: 1024 },
  { name: 'xl', width: 1280, height: 900 },
] as const;

/**
 * Cenários adicionais do calendário "Condições":
 * - Meses com layouts distintos (28/30/31 dias, ano bissexto, virada de ano)
 * - Estados de seleção (nenhum, primeiro dia, último dia)
 */
const SCENARIOS = [
  { name: 'jul-2026-selected-day3', query: 'month=2026-07&selected=day-3' },
  { name: 'feb-2025-28d-no-selection', query: 'month=2025-02&selected=none' },
  { name: 'feb-2024-leap-selected-first', query: 'month=2024-02&selected=first' },
  { name: 'apr-2026-30d-selected-last', query: 'month=2026-04&selected=last' },
  { name: 'dec-2026-year-turn-selected-day31', query: 'month=2026-12&selected=day-31' },
] as const;

type CalendarMetrics = {
  card: { width: number; height: number };
  table: { left: number; right: number };
  firstCell: { left: number };
  lastCell: { right: number };
  hasOverflow: boolean;
};

async function readMetrics(card: Locator) {
  return card.evaluate((el): CalendarMetrics => {
    const cardRect = el.getBoundingClientRect();
    const table = el.querySelector('[role="grid"]');
    if (!table) throw new Error('Calendar grid não encontrado');

    const tableRect = table.getBoundingClientRect();
    const rows = Array.from(el.querySelectorAll<HTMLElement>('tr'))
      .filter((row) => row.getBoundingClientRect().width > 0);
    const firstSevenCellRects = rows
      .flatMap((row) => Array.from(row.children))
      .slice(0, 7)
      .map((cell) => cell.getBoundingClientRect());

    if (firstSevenCellRects.length !== 7) {
      throw new Error(`Esperava 7 células no cabeçalho, recebi ${firstSevenCellRects.length}`);
    }

    const firstCell = firstSevenCellRects[0];
    const lastCell = firstSevenCellRects[6];

    return {
      card: { width: cardRect.width, height: cardRect.height },
      table: { left: tableRect.left, right: tableRect.right },
      firstCell: { left: firstCell.left },
      lastCell: { right: lastCell.right },
      hasOverflow:
        tableRect.left < cardRect.left ||
        tableRect.right > cardRect.right ||
        tableRect.top < cardRect.top ||
        tableRect.bottom > cardRect.bottom,
    };
  });
}

test.describe('Calendar — baselines PNG e distribuição responsiva', () => {
  for (const vp of VIEWPORTS) {
    test(`${vp.name}: números ocupam as bordas internas sem alterar o card`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, ROUTE);

      const card = page.locator(CARD);
      await expect(card).toBeVisible();

      const metrics = await readMetrics(card);
      expect(metrics.card.width).toBe(240);
      expect(metrics.card.height).toBeGreaterThan(0);
      expect(metrics.hasOverflow).toBe(false);
      expect(Math.abs(metrics.firstCell.left - metrics.table.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(metrics.lastCell.right - metrics.table.right)).toBeLessThanOrEqual(1);

      await expect(card).toHaveScreenshot(`calendar-${vp.name}.png`, {
        animations: 'disabled',
        caret: 'hide',
        maxDiffPixelRatio: 0.02,
        scale: 'css',
      });
    });
  }
});

test.describe('Calendar — cenários "Condições" (meses + seleção)', () => {
  for (const sc of SCENARIOS) {
    test(`cenário: ${sc.name}`, async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await gotoAndSettle(page, `${ROUTE}?${sc.query}`);

      const card = page.locator(CARD);
      await expect(card).toBeVisible();

      const metrics = await readMetrics(card);
      expect(metrics.card.width).toBe(240);
      expect(metrics.hasOverflow).toBe(false);

      await expect(card).toHaveScreenshot(`calendar-scenario-${sc.name}.png`, {
        animations: 'disabled',
        caret: 'hide',
        maxDiffPixelRatio: 0.02,
        scale: 'css',
      });
    });
  }
});
