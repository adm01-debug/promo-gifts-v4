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

      for (const label of ['Editar', 'Duplicar', 'Excluir', 'Histórico'] as const) {
        const item = page.getByRole('menuitem', { name: new RegExp(`^${label}$`, 'i') });
        await expect(item).toBeVisible();
        await expect(item).toHaveAccessibleName(new RegExp(label, 'i'));
      }

      // Ordem: Editar → Duplicar → Excluir → Histórico.
      const itemTexts = await page
        .getByTestId('quote-actions-menu')
        .getByRole('menuitem')
        .allInnerTexts();
      const order = itemTexts.map((t) => t.trim());
      const idx = (label: string) => order.findIndex((t) => new RegExp(label, 'i').test(t));
      expect(idx('Editar')).toBeLessThan(idx('Duplicar'));
      expect(idx('Duplicar')).toBeLessThan(idx('Excluir'));
      expect(idx('Excluir')).toBeLessThan(idx('Histórico'));

      await expect(page.getByText(/Modo Apresentação/i)).toHaveCount(0);
      await expect(
        page.getByRole('menuitem', { name: /Modo Apresentação/i }),
      ).toHaveCount(0);
    });
  }
}

for (const theme of ['light', 'dark'] as const) {
  test(`"Excluir" abre confirmação, dispara toast e redireciona — ${theme}`, async ({ page }) => {
    await openHarness(page, theme);
    await openMenuViaClick(page);

    // Stub determinístico: aceita o window.confirm exibido pelo harness.
    const dialogs: string[] = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      expect(dialog.type()).toBe('confirm');
      await dialog.accept();
    });

    await page.getByTestId('quote-actions-delete').click();

    // Confirmação foi exibida com a copy esperada.
    await expect.poll(() => dialogs.length).toBeGreaterThan(0);
    expect(dialogs[0]).toMatch(/excluir este orçamento/i);

    // Toast de sucesso renderizado por sonner.
    await expect(page.getByText(/Orçamento excluído/i).first()).toBeVisible();

    // Redirecionamento para /orcamentos.
    await page.waitForURL(/\/orcamentos(\?|$|\/)/, { timeout: 5000 });
    expect(new URL(page.url()).pathname).toMatch(/^\/orcamentos\/?$/);
  });

  test(`"Excluir" com cancelamento mantém usuário na rota — ${theme}`, async ({ page }) => {
    await openHarness(page, theme);
    await openMenuViaClick(page);

    page.on('dialog', async (dialog) => {
      await dialog.dismiss();
    });

    await page.getByTestId('quote-actions-delete').click();
    await page.waitForTimeout(200);

    // Permanece no harness, sem toast.
    await expect(page.getByTestId('quote-view-order-harness')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/__visual/quote-view-order');
  });

for (const theme of ['light', 'dark'] as const) {
  test(`navegação por teclado (Enter + setas) não expõe "Modo Apresentação" — ${theme}`, async ({ page }) => {
    await openHarness(page, theme);

    // Foca o trigger e abre o menu apenas com teclado.
    await page.getByTestId('quote-actions-trigger').focus();
    await expect(page.getByTestId('quote-actions-trigger')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('quote-actions-menu')).toBeVisible();

    // Radix auto-foca o primeiro item ao abrir via teclado. Capturamos o
    // item focado inicial e depois percorremos os demais com ArrowDown,
    // aguardando o foco mudar entre as teclas (evita race com Radix).
    const readFocused = () =>
      page.evaluate(() => (document.activeElement?.textContent ?? '').trim());

    const collected: string[] = [];
    collected.push(await readFocused());

    for (let i = 0; i < 3; i += 1) {
      const prev = collected[collected.length - 1];
      await page.keyboard.press('ArrowDown');
      // Aguarda o foco realmente migrar antes de ler o próximo nome.
      await page
        .waitForFunction(
          (previous) => (document.activeElement?.textContent ?? '').trim() !== previous,
          prev,
          { timeout: 2000 },
        )
        .catch(() => {
          /* último item: foco não muda; segue para a leitura final. */
        });
      collected.push(await readFocused());
    }

    for (const name of collected) {
      expect(name).not.toMatch(/Modo Apresentação/i);
    }
    const joined = collected.join(' | ');
    expect(joined).toMatch(/Editar/);
    expect(joined).toMatch(/Duplicar/);
    expect(joined).toMatch(/Histórico/);

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
