/**
 * QuoteItemsTable · coluna "Personalização" removida.
 *
 * Garante que, na visualização do orçamento, o header e as células da
 * coluna "Personalização" não aparecem (foi removida — técnicas ficam
 * apenas no sheet "Detalhes"). Valida em 320/375/768.
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
  test(`sem header/células de Personalização @ ${vp.name}px`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await open(page);

    // Header: nenhum <th> com texto "Personalização".
    const headerCount = await page
      .locator('th', { hasText: /^\s*Personalização\s*$/ })
      .count();
    expect(
      headerCount,
      `coluna "Personalização" não deveria existir no header (encontradas: ${headerCount})`,
    ).toBe(0);

    // Conteúdo da tabela: também não deve haver chips de técnica
    // (✦ <nome>) renderizados em nenhuma célula visível.
    const techniqueChipCount = await page
      .locator('table')
      .getByText(/^\s*✦\s/)
      .count();
    expect(
      techniqueChipCount,
      `nenhum chip de técnica deveria aparecer na tabela (encontrados: ${techniqueChipCount})`,
    ).toBe(0);
  });
}
