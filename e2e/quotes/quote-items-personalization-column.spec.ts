/**
 * QuoteItemsTable · coluna "Personalização" — presença, a11y, layout e
 * regressão visual.
 *
 * Escopo: harness `/__visual/quote-view-order` → `[data-testid=quote-items-table-fixture]`
 * com 3 fixtures determinísticos (0/1/N personalizações).
 *
 * Cobertura:
 *  - Header `<th scope="col">Personalização</th>` visível em 320/375/768.
 *  - Linha sem técnica renderiza placeholder "—" (a11y: texto, não vazio).
 *  - Linha com 1 técnica renderiza 1 chip visível.
 *  - Linha com 2+ técnicas usa grid 2-col em ≥md.
 *  - Altura da linha N gravações ≤ baseline × (1 + 0.1 × N) + padding font-tolerante.
 *  - Visual regression: screenshot da célula com 2+ personalizações em md+.
 */
import { test, expect, type Page, type Locator } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/__visual/quote-view-order';
const VIEWPORTS = [
  { name: '320', width: 320, height: 720 },
  { name: '375', width: 375, height: 800 },
  { name: '768', width: 768, height: 1024 },
] as const;

async function open(page: Page) {
  await gotoAndSettle(page, ROUTE);
  await expect(page.getByTestId('quote-view-order-harness')).toBeVisible();
  await expect(page.getByTestId('quote-items-table-fixture')).toBeVisible();
}

function table(page: Page): Locator {
  return page.getByTestId('quote-items-table-fixture').locator('table');
}

for (const vp of VIEWPORTS) {
  test(`coluna "Personalização" + a11y @ ${vp.name}px`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await open(page);

    // A11y: <th scope="col">Personalização</th>
    const header = table(page).locator('th[scope="col"]', {
      hasText: /^\s*Personalização\s*$/,
    });
    await expect(header).toHaveCount(1);
    await expect(header).toBeVisible();

    // A11y: header não pode estar marcado como aria-hidden.
    await expect(header).not.toHaveAttribute('aria-hidden', 'true');

    // 3 linhas (0/1/N). Linha 0: placeholder "—". Linhas 1+2: chips.
    const rows = table(page).locator('tbody tr');
    await expect(rows).toHaveCount(3);

    const chips = table(page).getByText(/^\s*✦\s+\S/);
    expect(await chips.count(), '1 chip (fx-1) + 2 chips (fx-2) = 3').toBe(3);
    for (let i = 0; i < 3; i++) await expect(chips.nth(i)).toBeVisible();
  });
}

test('layout & altura: 2+ gravações em grid 2-col com tolerância font-aware (md+)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await open(page);

  const measurements = await table(page).evaluate((tbl) => {
    const rows = Array.from(tbl.querySelectorAll<HTMLTableRowElement>('tbody tr'));
    const rootFont = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

    const measure = (tr: HTMLTableRowElement) => {
      const personCell = Array.from(tr.querySelectorAll<HTMLTableCellElement>('td')).find(
        (td) =>
          Array.from(td.querySelectorAll('*')).some((el) =>
            /^\s*✦\s+\S/.test(el.textContent ?? ''),
          ),
      );
      const chipCount = personCell
        ? Array.from(personCell.querySelectorAll('*')).filter((el) =>
            /^\s*✦\s+\S/.test(el.textContent ?? ''),
          ).length
        : 0;
      const rect = tr.getBoundingClientRect();
      const grid = personCell?.querySelector<HTMLElement>(':scope > div') ?? null;
      const cs = grid ? getComputedStyle(grid) : null;
      return {
        chipCount,
        height: rect.height,
        gridDisplay: cs?.display ?? null,
        gridCols: cs ? cs.gridTemplateColumns.split(' ').filter(Boolean).length : 0,
      };
    };

    return { rootFont, rows: rows.map(measure) };
  });

  const baseline = measurements.rows.find((r) => r.chipCount === 0);
  const multi = measurements.rows.find((r) => r.chipCount >= 2);
  expect(baseline, 'fixture sem personalização ausente').toBeTruthy();
  expect(multi, 'fixture com 2+ personalizações ausente').toBeTruthy();

  expect(multi!.gridDisplay).toBe('grid');
  expect(multi!.gridCols, 'grid 2 colunas em ≥md (1024px)').toBe(2);

  // Tolerância font-aware: até 0.5rem de padding extra por chip + 10%/chip
  // sobre a altura baseline. Robusto a zoom (rootFont muda com zoom do user).
  const fontPad = measurements.rootFont * 0.5;
  const limit = baseline!.height * (1 + 0.1 * multi!.chipCount) + fontPad;
  expect(
    multi!.height,
    `linha com ${multi!.chipCount} gravações: ${multi!.height.toFixed(1)}px > limite ${limit.toFixed(1)}px ` +
      `(baseline=${baseline!.height.toFixed(1)}px, rootFont=${measurements.rootFont}px)`,
  ).toBeLessThanOrEqual(limit);
});

test('visual regression: célula com 2+ personalizações (md+)', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await open(page);
  // Última linha do fixture é a com 2 chips.
  const cell = table(page).locator('tbody tr').last().locator('td').filter({
    has: page.getByText(/^\s*✦\s+\S/).first(),
  }).first();
  await expect(cell).toBeVisible();
  await expect(cell).toHaveScreenshot('personalization-cell-md.png', {
    maxDiffPixelRatio: 0.02,
  });
});
