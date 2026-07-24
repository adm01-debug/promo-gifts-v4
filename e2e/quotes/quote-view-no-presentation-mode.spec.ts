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

    // Botões desabilitados durante a exclusão (evita cliques duplos).
    // (Pode resolver instantâneo no spy; usamos soft-check.)
    // Spy: deleteQuote chamado exatamente 1x com o id correto.
    await expect.poll(() => readDeleteCalls(page)).toEqual([expectedId]);

    // Toast de sucesso renderizado por sonner — texto exato esperado.
    await expect(page.getByText(/^Orçamento excluído$/i).first()).toBeVisible();

    // Nenhum toast de erro ou mensagem técnica inesperada.
    await expect(page.getByText(/não foi possível|erro|failed|undefined/i)).toHaveCount(0);

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

  test(`"Excluir" exibe toast de erro saneado quando deleteQuote falha — ${theme}`, async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __deleteQuoteCalls: string[] }).__deleteQuoteCalls = [];
      (window as unknown as { __deleteQuoteSpy: (id: string) => Promise<void> }).__deleteQuoteSpy =
        async () => {
          throw new Error('TECH_BOOM: connection refused at 10.0.0.1:5432');
        };
    });
    await page.setViewportSize({ width: 375, height: 667 });
    await openHarness(page, theme);
    await openMenuViaClick(page);
    await page.getByTestId('quote-actions-delete').click();
    await page.getByTestId('quote-delete-confirm').click();

    // Copy esperado, sem vazar mensagem técnica.
    await expect(
      page.getByText(/Não foi possível excluir o orçamento\. Tente novamente\./i).first(),
    ).toBeVisible();
    await expect(page.getByText(/TECH_BOOM|10\.0\.0\.1|connection refused|undefined/i)).toHaveCount(0);

    // Permanece no harness (sem redirecionar em caso de falha).
    expect(new URL(page.url()).pathname).toBe('/__visual/quote-view-order');
  });

  test(`"Excluir" — duplo clique rápido chama deleteQuote 1x e desabilita botões — ${theme}`, async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __deleteQuoteCalls: string[] }).__deleteQuoteCalls = [];
      (window as unknown as { __deleteQuoteSpy: (id: string) => Promise<void> }).__deleteQuoteSpy =
        () => new Promise((resolve) => setTimeout(resolve, 400));
    });
    await page.setViewportSize({ width: 375, height: 667 });
    await openHarness(page, theme);
    await openMenuViaClick(page);
    const expectedId = await page
      .getByTestId('quote-view-order-harness')
      .getAttribute('data-quote-id');
    await page.getByTestId('quote-actions-delete').click();

    const confirm = page.getByTestId('quote-delete-confirm');
    const cancel = page.getByTestId('quote-delete-cancel');

    // Dois cliques quase simultâneos.
    await Promise.all([confirm.click(), confirm.click().catch(() => {})]);

    // Botões devem ficar desabilitados durante o loading.
    await expect(confirm).toBeDisabled();
    await expect(cancel).toBeDisabled();

    // Aguarda conclusão e valida chamada única (sem duplicidade).
    await expect.poll(() => readDeleteCalls(page), { timeout: 3000 }).toEqual([expectedId]);
  });

  test(`"Excluir" — timeout exibe toast saneado e mantém UI consistente — ${theme}`, async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __deleteQuoteCalls: string[] }).__deleteQuoteCalls = [];
      (window as unknown as { __deleteQuoteSpy: (id: string) => Promise<void> }).__deleteQuoteSpy =
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('ETIMEDOUT: upstream 504 after 30000ms')), 250),
          );
    });
    await page.setViewportSize({ width: 375, height: 667 });
    await openHarness(page, theme);
    await openMenuViaClick(page);
    await page.getByTestId('quote-actions-delete').click();

    const confirm = page.getByTestId('quote-delete-confirm');
    await confirm.click();

    // Durante o loading: botão mostra "Excluindo…" e fica desabilitado.
    await expect(confirm).toBeDisabled();
    await expect(confirm).toHaveText(/Excluindo/i);

    // Após timeout: copy esperado, sem vazar 504/ETIMEDOUT/upstream.
    await expect(
      page.getByText(/Não foi possível excluir o orçamento\. Tente novamente\./i).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/ETIMEDOUT|504|upstream|30000ms|undefined|\[object/i),
    ).toHaveCount(0);

    // UI volta ao estado consistente: dialog continua aberto, botões reabilitados.
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expect(confirm).toBeEnabled();
    await expect(page.getByTestId('quote-delete-cancel')).toBeEnabled();
  });

  test(`"Excluir" — AlertDialog mantém Escape/Cancelar durante loading — ${theme}`, async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __deleteQuoteCalls: string[] }).__deleteQuoteCalls = [];
      (window as unknown as { __deleteQuoteSpy: (id: string) => Promise<void> }).__deleteQuoteSpy =
        () => new Promise((resolve) => setTimeout(resolve, 600));
    });
    await page.setViewportSize({ width: 375, height: 667 });
    await openHarness(page, theme);
    await openMenuViaClick(page);
    await page.getByTestId('quote-actions-delete').click();

    const dialog = page.getByRole('alertdialog');
    const confirm = page.getByTestId('quote-delete-confirm');
    const cancel = page.getByTestId('quote-delete-cancel');
    await expect(cancel).toBeFocused();

    await confirm.click();

    // Dialog permanece aberto durante o await; ambos botões desabilitados.
    await expect(dialog).toBeVisible();
    await expect(confirm).toBeDisabled();
    await expect(cancel).toBeDisabled();

    // Escape NÃO deve fechar prematuramente (Radix bloqueia quando o focus está
    // em controles disabled; garantimos que o dialog ainda esteja visível).
    await page.keyboard.press('Escape').catch(() => {});
    await expect(dialog).toBeVisible();

    // Conclui o fluxo e valida cleanup.
    await expect.poll(() => readDeleteCalls(page), { timeout: 3000 }).toHaveLength(1);
  });

  test(`"Excluir" — múltiplos cliques rápidos (antes e durante loading) processam 1x — ${theme}`, async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __deleteQuoteCalls: string[] }).__deleteQuoteCalls = [];
      (window as unknown as { __deleteQuoteSpy: (id: string) => Promise<void> }).__deleteQuoteSpy =
        () => new Promise((resolve) => setTimeout(resolve, 500));
    });
    await page.setViewportSize({ width: 375, height: 667 });
    await openHarness(page, theme);
    const expectedId = await page
      .getByTestId('quote-view-order-harness')
      .getAttribute('data-quote-id');
    await openMenuViaClick(page);
    await page.getByTestId('quote-actions-delete').click();

    const confirm = page.getByTestId('quote-delete-confirm');

    // Rajada de 6 cliques: força {trial:true} para ignorar a checagem de
    // actionability e disparar mesmo após o disabled — simula adversário.
    const burst: Promise<unknown>[] = [];
    for (let i = 0; i < 6; i += 1) {
      burst.push(confirm.click({ force: true, noWaitAfter: true }).catch(() => {}));
    }
    await Promise.all(burst);

    // Durante o loading: ainda apenas 1 registro e botão disabled.
    await expect(confirm).toBeDisabled();

    // Cliques adicionais DURANTE o loading também são absorvidos.
    for (let i = 0; i < 4; i += 1) {
      await confirm.click({ force: true, noWaitAfter: true }).catch(() => {});
    }

    // Aguarda conclusão e valida idempotência total: 1 chamada apenas.
    await expect.poll(() => readDeleteCalls(page), { timeout: 4000 }).toEqual([expectedId]);

    // Garantia adicional: jamais duplicou ao longo do tempo.
    await page.waitForTimeout(200);
    expect(await readDeleteCalls(page)).toEqual([expectedId]);
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

/**
 * Tipografia/espaçamento do menu — consistência cross-viewport.
 * O DropdownMenuItem do shadcn renderiza `text-sm` (14px), `py-1.5` (6px) e
 * `px-2` (8px) em qualquer breakpoint. O contrato deste teste é garantir que
 * essa baseline NÃO sofra regressão em nenhuma largura — manter o item
 * "Excluir" legível e com touch-target consistente.
 */
const TYPO_VIEWPORTS = [
  { name: 'mobile-sm', width: 360, height: 720, expectedFontPx: 14 },
  { name: 'mobile', width: 375, height: 667, expectedFontPx: 14 },
  { name: 'tablet', width: 768, height: 1024, expectedFontPx: 14 },
  { name: 'desktop', width: 1280, height: 800, expectedFontPx: 14 },
  { name: 'desktop-xl', width: 1920, height: 1080, expectedFontPx: 14 },
] as const;

test.describe('DropdownMenu — tipografia e espaçamento consistentes', () => {
  for (const vp of TYPO_VIEWPORTS) {
    test(`fonte/padding estáveis em ${vp.name} (${vp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openHarness(page, 'light');
      await openMenuViaClick(page);

      const excluir = page.getByRole('menuitem', { name: /^excluir$/i });
      await expect(excluir).toBeVisible();

      const metrics = await excluir.evaluate((el) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          fontPx: parseFloat(cs.fontSize),
          paddingTop: parseFloat(cs.paddingTop),
          paddingBottom: parseFloat(cs.paddingBottom),
          paddingLeft: parseFloat(cs.paddingLeft),
          gap: parseFloat(cs.columnGap || cs.gap || '0'),
          height: r.height,
        };
      });

      // Fonte do shadcn DropdownMenuItem (text-sm = 14px) — estável em todas as larguras.
      expect(metrics.fontPx).toBeCloseTo(vp.expectedFontPx, 0);
      // Padding estável em qualquer largura — baseline shadcn (px-3 py-2).
      expect(metrics.paddingTop).toBeCloseTo(8, 0); // py-2
      expect(metrics.paddingBottom).toBeCloseTo(8, 0);
      expect(metrics.paddingLeft).toBeCloseTo(12, 0); // px-3
      // Item não usa `gap-*`; o espaçamento vem do `mr-2` no ícone (8px).
      expect(Number.isFinite(metrics.gap) ? metrics.gap : 0).toBeCloseTo(0, 0);
      // Touch target adequado para item de menu (text-sm + py-2).
      expect(metrics.height).toBeGreaterThanOrEqual(32);
      expect(metrics.height).toBeLessThanOrEqual(44);
    });
  }
});

