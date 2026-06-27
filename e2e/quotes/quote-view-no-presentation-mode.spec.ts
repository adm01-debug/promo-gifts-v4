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

async function installDeleteSpy(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __deleteQuoteCalls: string[] }).__deleteQuoteCalls = [];
    (window as unknown as { __deleteQuoteSpy: (id: string) => Promise<void> }).__deleteQuoteSpy =
      async () => {
        // Resolve assíncrono para exercitar o caminho `await` do harness.
        await Promise.resolve();
      };
  });
}

const readDeleteCalls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __deleteQuoteCalls?: string[] }).__deleteQuoteCalls ?? []);

for (const theme of ['light', 'dark'] as const) {
  test(`"Excluir" abre confirmação acessível, chama deleteQuote(id) 1x, dispara toast e redireciona — ${theme}`, async ({
    page,
  }) => {
    await installDeleteSpy(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await openHarness(page, theme);

    const expectedId = await page
      .getByTestId('quote-view-order-harness')
      .getAttribute('data-quote-id');
    expect(expectedId).toBeTruthy();

    await openMenuViaClick(page);
    await page.getByTestId('quote-actions-delete').click();

    // A11y: AlertDialog com nome e descrição acessíveis.
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleName(/excluir orçamento\?/i);
    await expect(dialog).toHaveAccessibleDescription(/excluir este orçamento/i);

    // Foco inicial vai para "Cancelar" (escolha segura em ação destrutiva).
    const cancel = page.getByTestId('quote-delete-cancel');
    const confirm = page.getByTestId('quote-delete-confirm');
    await expect(cancel).toBeFocused();
    await expect(cancel).toHaveAccessibleName(/cancelar/i);
    await expect(confirm).toHaveAccessibleName(/excluir/i);

    await confirm.click();

    // Spy: deleteQuote chamado exatamente 1x com o id correto.
    await expect.poll(() => readDeleteCalls(page)).toEqual([expectedId]);

    // Toast de sucesso renderizado por sonner.
    await expect(page.getByText(/Orçamento excluído/i).first()).toBeVisible();

    // Redirecionamento: pode cair em /orcamentos ou em /login (rota protegida
    // sem auth no projeto chromium-public). O que importa é sair do harness.
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 5000 })
      .not.toBe('/__visual/quote-view-order');
    expect(new URL(page.url()).pathname).toMatch(/orcamentos|login|auth/);
  });

  test(`"Excluir" com Cancelar não chama deleteQuote e mantém rota — ${theme}`, async ({ page }) => {
    await installDeleteSpy(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await openHarness(page, theme);
    await openMenuViaClick(page);

    await page.getByTestId('quote-actions-delete').click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByTestId('quote-delete-cancel').click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);

    expect(await readDeleteCalls(page)).toEqual([]);
    expect(new URL(page.url()).pathname).toBe('/__visual/quote-view-order');
  });
}


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

    for (let i = 0; i < 4; i += 1) {
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
    expect(joined).toMatch(/Excluir/);
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
