/**
 * Regressão: o item "Modo Apresentação" foi removido do DropdownMenu do
 * QuoteViewPage. Esta spec abre o menu de ações no harness
 * `/__visual/quote-view-order` (espelho 1:1, sem dependência de seed/auth)
 * em light/dark × desktop/mobile, e garante que:
 *   - O trigger é clicável e tem nome acessível "Mais opções".
 *   - "Editar", "Duplicar" e "Histórico" continuam presentes com nomes acessíveis.
 *   - "Modo Apresentação" NÃO aparece em nenhuma combinação.
 */
import { test, expect, type Page } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/__visual/quote-view-order';

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 375, height: 667 },
] as const;

async function openMenu(page: Page, theme: 'light' | 'dark') {
  await gotoAndSettle(page, theme === 'dark' ? `${ROUTE}?theme=dark` : ROUTE);
  await expect(page.getByTestId('quote-view-order-harness')).toBeVisible();

  const trigger = page.getByTestId('quote-actions-trigger');
  // A11y: trigger precisa estar habilitado e ter accessible name.
  await expect(trigger).toBeEnabled();
  await expect(trigger).toHaveAccessibleName(/mais opções/i);

  await trigger.click();
  await expect(page.getByTestId('quote-actions-menu')).toBeVisible();
}

for (const vp of VIEWPORTS) {
  for (const theme of ['light', 'dark'] as const) {
    test(`DropdownMenu sem "Modo Apresentação" — ${theme} · ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openMenu(page, theme);

      // A11y: cada item visível precisa expor accessible name correspondente.
      for (const label of ['Editar', 'Duplicar', 'Histórico'] as const) {
        const item = page.getByRole('menuitem', { name: new RegExp(`^${label}$`, 'i') });
        await expect(item).toBeVisible();
        await expect(item).toHaveAccessibleName(new RegExp(label, 'i'));
      }

      // Ausência absoluta de "Modo Apresentação" em qualquer lugar da página
      // (menu, DOM oculto, tooltip, sr-only).
      await expect(page.getByText(/Modo Apresentação/i)).toHaveCount(0);
      await expect(
        page.getByRole('menuitem', { name: /Modo Apresentação/i }),
      ).toHaveCount(0);
    });
  }
}
