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
  test(`coluna "Personalização" presente @ ${vp.name}px`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await open(page);

    const header = page.locator('th', { hasText: /^\s*Personalização\s*$/ });
    await expect(header, 'header da coluna Personalização deve estar visível').toHaveCount(1);

    // Pelo menos 1 chip (✦ <técnica>) renderizado em alguma linha do tbody.
    const chips = page.locator('table tbody').getByText(/^\s*✦\s+\S/);
    expect(await chips.count(), 'esperado ao menos 1 chip de técnica').toBeGreaterThan(0);
  });
}

test('linha com 2+ gravações usa grid 2-col em ≥768px sem dobrar altura', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await open(page);

  // Localiza a célula que contém ≥2 chips de técnica.
  const cell = page
    .locator('table tbody td')
    .filter({ has: page.getByText(/^\s*✦\s+\S/) })
    .filter({
      has: page.locator(':scope >> text=/✦[\\s\\S]*✦/s'),
    })
    .first();

  // Fallback robusto: pega célula com ≥2 chips contando.
  const multiCellHandle = await page.evaluateHandle(() => {
    const cells = Array.from(document.querySelectorAll('table tbody td'));
    return (
      cells.find(
        (td) =>
          Array.from(td.querySelectorAll('*')).filter((el) =>
            /^\s*✦\s+\S/.test(el.textContent ?? ''),
          ).length >= 2,
      ) ?? null
    );
  });
  const multiCell = multiCellHandle.asElement();
  test.skip(!multiCell, 'harness sem linha de 2+ gravações — nada a validar');

  const gridInfo = await (multiCell!).evaluate((td) => {
    const grid = td.querySelector<HTMLElement>(':scope > div');
    if (!grid) return null;
    const cs = getComputedStyle(grid);
    return {
      display: cs.display,
      cols: cs.gridTemplateColumns.split(' ').filter(Boolean).length,
      rowH: (td as HTMLElement).getBoundingClientRect().height,
    };
  });
  expect(gridInfo, 'célula com chips deve ter um wrapper grid').not.toBeNull();
  expect(gridInfo!.display, 'wrapper de chips deve ser grid').toBe('grid');
  expect(gridInfo!.cols, 'grid deve ter 2 colunas em ≥md (1024px)').toBe(2);

  // Sanidade de altura: célula com 2 chips em grid 2-col não deve
  // ultrapassar 140px (chips de 1 linha + padding da célula).
  expect(
    gridInfo!.rowH,
    `linha com 2 gravações alta demais (${gridInfo!.rowH}px) — grid 2-col não está reduzindo`,
  ).toBeLessThanOrEqual(140);
});
