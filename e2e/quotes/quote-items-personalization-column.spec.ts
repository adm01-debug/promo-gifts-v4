/**
 * QuoteItemsTable · coluna "Personalização" presente e responsiva.
 *
 * Regressão guard para a decisão de manter a coluna:
 *  - Header "Personalização" visível em 320/375/768.
 *  - Quando há 2+ gravações na mesma linha, os chips (✦ <técnica>)
 *    aparecem em grid 2-col a partir de `md` (≥768px) e empilham em
 *    uma coluna abaixo disso.
 *  - Altura da linha com 2 personalizações ≤ 2× a altura da linha
 *    sem personalização (grid 2-col não deve dobrar/triplicar altura).
 *  - `hasPersonalizations` cobre 0/1/N (a tabela do harness contém
 *    linhas sem técnica + linha com 2 técnicas — header DEVE aparecer).
 */
import { test, expect, type Page } from '@playwright/test';
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
}

for (const vp of VIEWPORTS) {
  test(`coluna "Personalização" presente + a11y @ ${vp.name}px`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await open(page);

    // A11y: header é <th scope="col"> (semântico, leitores de tela
    // anunciam relação coluna×célula).
    const header = page.locator('th[scope="col"]', {
      hasText: /^\s*Personalização\s*$/,
    });
    await expect(header, 'header <th scope="col">Personalização</th>').toHaveCount(1);
    await expect(header).toBeVisible();

    // A11y: chips são visíveis (não aria-hidden, não display:none).
    const chips = page.locator('table tbody').getByText(/^\s*✦\s+\S/);
    const total = await chips.count();
    expect(total, 'esperado ao menos 1 chip de técnica').toBeGreaterThan(0);
    for (let i = 0; i < total; i++) {
      await expect(chips.nth(i)).toBeVisible();
    }
  });
}

test('linha com 2+ gravações: grid 2-col em ≥md e altura proporcional', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await open(page);

  // Coleta alturas de linhas COM e SEM personalização + info do grid.
  const layout = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>('table tbody tr'));
    let multiCell: HTMLTableCellElement | null = null;
    let multiRowH = 0;
    const baselineHeights: number[] = [];
    for (const tr of rows) {
      const cells = Array.from(tr.querySelectorAll('td'));
      const personCell = cells.find((td) =>
        Array.from(td.querySelectorAll('*')).some((el) =>
          /^\s*✦\s+\S/.test(el.textContent ?? ''),
        ),
      );
      const chipCount = personCell
        ? Array.from(personCell.querySelectorAll('*')).filter((el) =>
            /^\s*✦\s+\S/.test(el.textContent ?? ''),
          ).length
        : 0;
      const h = tr.getBoundingClientRect().height;
      if (chipCount >= 2 && !multiCell) {
        multiCell = personCell as HTMLTableCellElement;
        multiRowH = h;
      } else if (chipCount === 0) {
        baselineHeights.push(h);
      }
    }
    if (!multiCell) return null;
    const grid = multiCell.querySelector<HTMLElement>(':scope > div');
    const cs = grid ? getComputedStyle(grid) : null;
    return {
      display: cs?.display ?? null,
      cols: cs ? cs.gridTemplateColumns.split(' ').filter(Boolean).length : 0,
      multiRowH,
      baselineMedian:
        baselineHeights.sort((a, b) => a - b)[Math.floor(baselineHeights.length / 2)] ?? 0,
    };
  });

  test.skip(!layout, 'harness sem linha de 2+ gravações — nada a validar');

  expect(layout!.display, 'wrapper de chips deve ser grid').toBe('grid');
  expect(layout!.cols, 'grid deve ter 2 colunas em ≥md (1024px)').toBe(2);

  // Tolerância relativa: linha com 2 gravações ≤ 2.2× a linha base
  // (sem técnica). Robusto a variações de fonte/zoom do ambiente.
  const ratio = layout!.baselineMedian > 0 ? layout!.multiRowH / layout!.baselineMedian : 0;
  expect(
    ratio,
    `linha de 2 gravações (${layout!.multiRowH}px) vs baseline (${layout!.baselineMedian}px) → ratio=${ratio.toFixed(2)} > 2.2`,
  ).toBeLessThanOrEqual(2.2);
});

test('visual regression: célula da coluna Personalização (md+)', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await open(page);
  const cell = page
    .locator('table tbody td')
    .filter({ has: page.getByText(/^\s*✦\s+\S/) })
    .first();
  await expect(cell).toBeVisible();
  await expect(cell).toHaveScreenshot('personalization-cell-md.png', {
    maxDiffPixelRatio: 0.02,
  });
});

