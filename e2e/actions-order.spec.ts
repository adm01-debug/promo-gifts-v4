import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * E2E: valida a ordem padronizada dos botões de ação na visualização em lista
 * e na tabela do catálogo, e também que cada tooltip e aria-label aparecem
 * corretamente ao passar o mouse (hover) e ao focar (focus via teclado).
 *
 * Ordem oficial (esquerda → direita):
 *   1 - Carrinho
 *   2 - Orçamento
 *   3 - Coleção
 *   4 - Favoritar
 *   5 - Comparar
 *   6 - Quick View
 *   7 - Compartilhar
 */

const EXPECTED_ACTIONS: ReadonlyArray<{ ariaLabel: string; tooltip: string }> = [
  { ariaLabel: 'Adicionar ao Carrinho', tooltip: 'Adicionar ao Carrinho' },
  { ariaLabel: 'Orçamento', tooltip: 'Orçamento' },
  { ariaLabel: 'Coleção', tooltip: 'Coleção' },
  { ariaLabel: 'Favoritar', tooltip: 'Favoritar' },
  { ariaLabel: 'Comparar', tooltip: 'Comparar' },
  { ariaLabel: 'Quick View', tooltip: 'Quick View' },
  { ariaLabel: 'Compartilhar', tooltip: 'Compartilhar' },
];

async function gotoCatalog(page: Page) {
  await page.goto('/produtos');
  // Aguarda algum botão de favoritar aparecer — sinal de que a lista renderizou.
  await page.waitForSelector('[data-testid="product-favorite"]', { timeout: 20_000 });
}

/**
 * Retorna os botões de ação do primeiro item da lista/tabela, na ordem do DOM.
 * Garante que a barra esteja "aberta" para que botões hidden:sm:flex apareçam.
 */
async function getFirstRowActionButtons(page: Page): Promise<Locator> {
  // Hover no primeiro item para forçar group-hover:opacity-100
  const firstRow = page.locator('[data-testid="product-favorite"]').first().locator('xpath=ancestor::*[contains(@class,"group")][1]');
  await firstRow.scrollIntoViewIfNeeded();
  await firstRow.hover();
  // Container de ações contém o botão "Favoritar"
  const actionsBar = firstRow
    .locator('div')
    .filter({ has: page.locator('[data-testid="product-favorite"]') })
    .last();
  return actionsBar.locator('button:visible');
}

async function assertOrderAndA11y(page: Page, buttons: Locator) {
  const count = await buttons.count();
  expect(count, 'esperado 7 botões de ação visíveis na ordem oficial').toBe(EXPECTED_ACTIONS.length);

  for (let i = 0; i < EXPECTED_ACTIONS.length; i++) {
    const expected = EXPECTED_ACTIONS[i];
    const btn = buttons.nth(i);

    // 1. aria-label correto na posição i
    await expect(btn, `botão #${i + 1} deve ter aria-label "${expected.ariaLabel}"`).toHaveAttribute(
      'aria-label',
      expected.ariaLabel,
    );

    // 2. Tooltip aparece no hover (Radix renderiza role="tooltip" no portal)
    await btn.hover();
    const hoverTooltip = page.getByRole('tooltip', { name: expected.tooltip });
    await expect(
      hoverTooltip.first(),
      `tooltip "${expected.tooltip}" deve aparecer ao passar o mouse no botão #${i + 1}`,
    ).toBeVisible({ timeout: 2_000 });

    // Move o mouse para fora para resetar antes do próximo passo
    await page.mouse.move(0, 0);
    await expect(hoverTooltip.first()).toBeHidden({ timeout: 2_000 });

    // 3. Tooltip aparece no focus via teclado
    await btn.focus();
    const focusTooltip = page.getByRole('tooltip', { name: expected.tooltip });
    await expect(
      focusTooltip.first(),
      `tooltip "${expected.tooltip}" deve aparecer ao focar (teclado) o botão #${i + 1}`,
    ).toBeVisible({ timeout: 2_000 });

    // Tira o foco
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  }
}

test.describe('Catálogo — ações do produto: ordem + tooltip/aria-label', () => {
  test('Visualização em lista (desktop): ordem oficial + tooltip no hover e focus', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 800 });
    await gotoCatalog(page);

    // Garantir que estamos no modo lista (se houver toggle)
    const listToggle = page.getByRole('button', { name: /Lista/i }).first();
    if (await listToggle.isVisible().catch(() => false)) {
      await listToggle.click();
    }

    const buttons = await getFirstRowActionButtons(page);
    await assertOrderAndA11y(page, buttons);
  });

  test('Visualização em tabela: ordem oficial + tooltip no hover e focus', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 800 });
    await gotoCatalog(page);

    // Trocar para tabela se houver toggle
    const tableToggle = page.getByRole('button', { name: /Tabela|Tabular/i }).first();
    if (await tableToggle.isVisible().catch(() => false)) {
      await tableToggle.click();
      // Espera renderizar
      await page.waitForTimeout(300);
    }

    const buttons = await getFirstRowActionButtons(page);
    await assertOrderAndA11y(page, buttons);
  });
});
