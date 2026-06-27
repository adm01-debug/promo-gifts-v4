/**
 * Regressão: o item "Modo Apresentação" foi removido do DropdownMenu do
 * QuoteViewPage. Esta spec abre o menu de ações no harness
 * `/__visual/quote-view-order` (espelho 1:1, sem dependência de seed/auth)
 * em light/dark × desktop/mobile, e garante que:
 *   - O trigger é clicável e tem nome acessível "Mais opções".
 *   - "Editar", "Duplicar" e "Histórico" continuam presentes com nomes acessíveis.
 *   - "Modo Apresentação" NÃO aparece em nenhuma combinação.
 *   - Navegação por teclado (Enter + setas) funciona e nunca destaca o item removido.
 *   - Snapshot visual do menu em mobile 375x667 (light + dark) — regressão UI.
 */
import { test, expect, type Page } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/__visual/quote-view-order';

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 375, height: 667 },
] as const;

async function openHarness(page: Page, theme: 'light' | 'dark') {
  await gotoAndSettle(page, theme === 'dark' ? `${ROUTE}?theme=dark` : ROUTE);
  await expect(page.getByTestId('quote-view-order-harness')).toBeVisible();
}

async function openMenuViaClick(page: Page) {
  const trigger = page.getByTestId('quote-actions-trigger');
  await expect(trigger).toBeEnabled();
  await expect(trigger).toHaveAccessibleName(/mais opções/i);
  await trigger.click();
  await expect(page.getByTestId('quote-actions-menu')).toBeVisible();
}

for (const vp of VIEWPORTS) {
  for (const theme of ['light', 'dark'] as const) {
    test(`DropdownMenu sem "Modo Apresentação" — ${theme} · ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openHarness(page, theme);
      await openMenuViaClick(page);

      for (const label of ['Editar', 'Duplicar', 'Histórico'] as const) {
        const item = page.getByRole('menuitem', { name: new RegExp(`^${label}$`, 'i') });
        await expect(item).toBeVisible();
        await expect(item).toHaveAccessibleName(new RegExp(label, 'i'));
      }

      await expect(page.getByText(/Modo Apresentação/i)).toHaveCount(0);
      await expect(
        page.getByRole('menuitem', { name: /Modo Apresentação/i }),
      ).toHaveCount(0);
    });
  }
}

for (const theme of ['light', 'dark'] as const) {
  test(`navegação por teclado (Enter + setas) não expõe "Modo Apresentação" — ${theme}`, async ({ page }) => {
    await openHarness(page, theme);

    // Foca o trigger e abre o menu apenas com teclado.
    await page.getByTestId('quote-actions-trigger').focus();
    await expect(page.getByTestId('quote-actions-trigger')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('quote-actions-menu')).toBeVisible();

    // Percorre TODOS os itens com ↓ e coleta o accessible name do item focado.
    const collected: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      await page.keyboard.press('ArrowDown');
      const focusedName = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return (el?.textContent ?? '').trim();
      });
      if (focusedName) collected.push(focusedName);
    }

    // Nenhum item destacado pode ser "Modo Apresentação".
    for (const name of collected) {
      expect(name).not.toMatch(/Modo Apresentação/i);
    }
    // Sanidade: os 3 itens esperados aparecem na varredura.
    expect(collected.join(' | ')).toMatch(/Editar/);
    expect(collected.join(' | ')).toMatch(/Duplicar/);
    expect(collected.join(' | ')).toMatch(/Histórico/);

    // Escape fecha o menu sem efeitos colaterais.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('quote-actions-menu')).toHaveCount(0);
  });
}

test.describe('snapshot visual — DropdownMenu mobile 375x667', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`menu aberto — ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await openHarness(page, theme);
      await openMenuViaClick(page);

      // Estabiliza animação Radix antes do snapshot.
      await page.mouse.move(0, 0);
      const menu = page.getByTestId('quote-actions-menu');
      await expect(menu).toBeVisible();

      await expect(menu).toHaveScreenshot(`quote-actions-menu-${theme}-mobile.png`, {
        animations: 'disabled',
        maxDiffPixelRatio: Number(
          process.env[`VISUAL_THRESHOLD_QUOTE_MENU_${theme.toUpperCase()}_MOBILE`] ?? '0.02',
        ),
      });
    });
  }
});
