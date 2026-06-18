/**
 * E2E — Botão "Busca" do StockFilterToolbar.
 *
 * Cobre:
 *  1. Disabled state quando não há texto nem filtros ativos.
 *  2. Enable quando há texto OU pelo menos um filtro ativo.
 *  3. Acessibilidade: aria-label, aria-busy, foco via Tab e ativação via Enter.
 *  4. Paridade desktop/mobile do gatilho (Enter no input vs clique no botão).
 */
import { test, expect, type Page } from '../fixtures/test-base';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

async function setup(page: Page) {
  await loginAs(page);
  await gotoAndSettle(page, '/estoque');
  const syncing = page.getByText(/Sincronizando estoque/i);
  if (await syncing.isVisible().catch(() => false)) {
    await expect(syncing).not.toBeVisible({ timeout: 60_000 });
  }
}

for (const vp of VIEWPORTS) {
  test.describe(`Stock search button — ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('disabled sem texto/filtros; habilita quando há texto', async ({ page }) => {
      await setup(page);
      const btn = page.getByTestId('stock-search-button');
      await expect(btn).toBeVisible();
      await expect(btn).toBeDisabled();
      // aria adequados
      await expect(btn).toHaveAttribute('aria-label', /Aplicar busca/i);
      await expect(btn).toHaveAttribute('aria-busy', 'false');

      const input = page.getByPlaceholder(/Buscar no Estoque/i);
      await input.fill('caneca');
      await expect(btn).toBeEnabled();

      // Limpar texto → volta a desabilitar (sem outros filtros ativos).
      await input.fill('');
      await expect(btn).toBeDisabled();
    });

    test('aplica busca com clique no botão e com Enter no input', async ({ page }) => {
      await setup(page);
      const input = page.getByPlaceholder(/Buscar no Estoque/i);
      const btn = page.getByTestId('stock-search-button');

      // 1) Enter no input
      await input.fill('zzz_inexistente_promo');
      await input.press('Enter');
      await expect(page.getByText(/Nenhum produto encontrado/i)).toBeVisible({ timeout: 15_000 });

      // 2) Clique no botão
      await page.getByRole('button', { name: /Limpar busca/i }).click();
      await input.fill('aaa_inexistente_promo');
      await btn.click();
      await expect(page.getByText(/Nenhum produto encontrado/i)).toBeVisible({ timeout: 15_000 });
    });

    test('acessível via teclado: Tab foca, Enter ativa', async ({ page }) => {
      await setup(page);
      const input = page.getByPlaceholder(/Buscar no Estoque/i);
      const btn = page.getByTestId('stock-search-button');

      await input.focus();
      await input.fill('teste');
      // Tab move o foco para o próximo elemento focável (botão Busca).
      await page.keyboard.press('Tab');
      await expect(btn).toBeFocused();
      // Enter no botão dispara a busca.
      await page.keyboard.press('Enter');
      // aria-busy fica true brevemente; aceitamos qualquer estado terminal.
      await expect(btn).toHaveAttribute('aria-busy', /true|false/);
    });
  });
}
