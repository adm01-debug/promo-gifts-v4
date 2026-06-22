/**
 * E2E — Swatch → QuickView nas views Lista e Tabela.
 *
 * Garante para /produtos em ambos os modos (list/table):
 *  1. Clique numa bolinha de cor abre o QuickView posicionado naquela cor
 *     (header "Cor: <nome>" + botão "Todas as cores" visível).
 *  2. Clique em "Todas as cores" limpa a seleção dentro do QuickView
 *     (header volta a "Cor" e botão some).
 *  3. Clique na imagem/thumb abre o QuickView com a cor previamente
 *     selecionada na linha (paridade com swatch).
 *  4. A11y: swatches expõem role="radio" + aria-label "Opção de cor: ..."
 *     e respondem a Enter e Space (cobre `onSelect` no `ProductColorSwatches`).
 *  5. Foco visível: tabular para o swatch o deixa como `document.activeElement`.
 *  6. Foco restaurado ao fechar o QuickView via Escape.
 *
 * Skipa graciosamente quando a rota não retorna cards com cores (sem dados/auth).
 */
import { test, expect, requireAuth } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/produtos';

const VIEWS = [
  {
    mode: 'list' as const,
    toggleTid: 'view-mode-list',
    rowSelector: '[data-testid="product-list-item-thumb"]',
  },
  {
    mode: 'table' as const,
    toggleTid: 'view-mode-table',
    // Em tabela, o trigger de QuickView por imagem é a thumb da row;
    // qualquer ancestral clicável funciona — aqui usamos a célula da imagem.
    rowSelector: 'div[data-index]',
  },
];


test.describe('Swatch → QuickView (Lista e Tabela)', () => {
  test.beforeEach(() => requireAuth());

  for (const v of VIEWS) {
    test(`[${v.mode}] swatch abre QV na cor + "Todas as cores" limpa + foto usa cor selecionada`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1366, height: 900 });
      await gotoAndSettle(page, ROUTE);

      const toggle = page.locator(`[data-testid="${v.toggleTid}"]`).first();
      if (await toggle.count()) {
        await toggle.click().catch(() => undefined);
      }

      // Aguarda alguma row aparecer.
      const rows = page.locator(v.rowSelector);
      await rows.first().waitFor({ timeout: 10_000 }).catch(() => undefined);
      const total = await rows.count();
      test.skip(total === 0, `Sem itens em ${ROUTE} (${v.mode}).`);

      // Localiza a primeira row que tenha pelo menos 2 swatches (para garantir
      // "Todas as cores" + escolha consistente). Cai para qualquer row com 1
      // swatch se nenhuma tiver 2.
      const swatchSel = '[data-testid^="color-swatch-"]';
      let rowIdx = -1;
      let rowSwatches = 0;
      const sample = Math.min(total, 20);
      for (let i = 0; i < sample; i++) {
        const n = await rows.nth(i).locator(swatchSel).count();
        if (n >= 2) {
          rowIdx = i;
          rowSwatches = n;
          break;
        }
        if (n >= 1 && rowIdx === -1) {
          rowIdx = i;
          rowSwatches = n;
        }
      }
      test.skip(rowIdx === -1, `Sem rows com cores em ${ROUTE} (${v.mode}).`);

      const row = rows.nth(rowIdx);
      const firstSwatch = row.locator(swatchSel).first();

      // ── A11y: role + aria-label canônicos ─────────────────────────────────
      await expect(firstSwatch).toHaveAttribute('role', 'radio');
      const aria = await firstSwatch.getAttribute('aria-label');
      expect(aria ?? '').toMatch(/Op[cç][aã]o de cor:/i);
      const colorName = (
        await firstSwatch.getAttribute('data-color-name')
      )?.trim();
      expect(colorName, 'swatch precisa expor data-color-name').toBeTruthy();

      // ── 1) Click no swatch abre QV posicionado na cor ─────────────────────
      await firstSwatch.scrollIntoViewIfNeeded();
      await firstSwatch.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 8_000 });

      // Header "Cor: <name>" (case-insensitive).
      const colorHeader = dialog.getByText(/^Cor:\s*/i).first();
      await expect(colorHeader).toBeVisible();
      await expect(colorHeader).toContainText(new RegExp(colorName!, 'i'));

      // Botão "Todas as cores" presente.
      const clearBtn = dialog.getByTestId('quickview-clear-color');
      await expect(clearBtn).toBeVisible();

      // ── 2) "Todas as cores" limpa a seleção ───────────────────────────────
      await clearBtn.click();
      await expect(clearBtn).toBeHidden();
      // Header colapsa para "Cor" (sem ":") — checagem por regex específica.
      await expect(dialog.locator('p').filter({ hasText: /^Cor$/ }).first()).toBeVisible();

      // Fecha QV.
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden({ timeout: 5_000 });

      // ── 3) Foto/thumb abre QV usando a cor selecionada na row ─────────────
      // A seleção via swatch persistiu (via store + URL). Agora basta clicar
      // numa região "imagem" da row.
      const thumb =
        v.mode === 'list'
          ? row // a row em list já É o thumb (testid product-list-item-thumb)
          : row.locator('img').first();
      // Em tabela a imagem está dentro da row; clique no <img> propaga ao
      // handler de QV via `handleOpenQV` no ProductTableRow.
      if (await thumb.count()) {
        await thumb.first().click({ position: { x: 8, y: 8 } });
        await expect(dialog).toBeVisible({ timeout: 8_000 });
        // A cor ativa deve refletir a última escolhida (mesmo nome).
        await expect(dialog.getByText(/^Cor:\s*/i).first()).toContainText(
          new RegExp(colorName!, 'i'),
        );
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden({ timeout: 5_000 });
      }

      // ── 4) Teclado: Enter no swatch abre QV ───────────────────────────────
      if (rowSwatches >= 1) {
        await firstSwatch.focus();
        // Foco visível: o elemento focado é exatamente o swatch.
        const isFocused = await firstSwatch.evaluate(
          (el) => el === document.activeElement,
        );
        expect(isFocused).toBe(true);
        await page.keyboard.press('Enter');
        await expect(dialog).toBeVisible({ timeout: 8_000 });
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden({ timeout: 5_000 });

        // ── 5) Space também abre QV ────────────────────────────────────────
        await firstSwatch.focus();
        await page.keyboard.press(' ');
        await expect(dialog).toBeVisible({ timeout: 8_000 });

        // ── 6) Foco restaurado ao fechar via Escape ─────────────────────────
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden({ timeout: 5_000 });
        // Aguarda 2 frames para Radix restaurar o foco.
        await page.evaluate(
          () =>
            new Promise<void>((r) =>
              requestAnimationFrame(() => requestAnimationFrame(() => r())),
            ),
        );
        // O foco volta para o swatch OU para um ancestral (Radix re-foca o
        // trigger original — aceitamos ambos).
        const focusOk = await page.evaluate((tid) => {
          const a = document.activeElement;
          if (!a) return false;
          return (
            a.getAttribute('data-testid')?.startsWith(tid) ||
            !!a.closest(`[data-testid^="${tid}"]`)
          );
        }, 'color-swatch-');
        expect(focusOk).toBe(true);
      }

      // ── 7) Tab percorre os swatches em ordem ──────────────────────────────
      if (rowSwatches >= 2) {
        await firstSwatch.focus();
        await page.keyboard.press('Tab');
        const nextIsSwatch = await page.evaluate(() => {
          const a = document.activeElement as HTMLElement | null;
          return !!a?.getAttribute('data-testid')?.startsWith('color-swatch-');
        });
        expect(nextIsSwatch, 'Tab deve mover para o próximo swatch').toBe(true);
      }

      // ── 8) Estoque muda ao alternar cor e ao limpar via "Todas as cores" ─
      const allSwatches = row.locator(swatchSel);
      const n = await allSwatches.count();
      if (n >= 2) {
        await allSwatches.nth(0).click();
        await expect(dialog).toBeVisible({ timeout: 8_000 });
        const stockBadge = dialog.getByTestId('quickview-stock');
        await expect(stockBadge).toBeVisible();
        const colorId0 = await stockBadge.getAttribute('data-color-id');
        expect(colorId0, 'estoque deve refletir cor selecionada').toBeTruthy();

        const dialogSwatches = dialog.locator(swatchSel);
        if ((await dialogSwatches.count()) >= 2) {
          await dialogSwatches.nth(1).click();
          await expect
            .poll(async () => stockBadge.getAttribute('data-color-id'))
            .not.toBe(colorId0);
        }

        // "Todas as cores" reseta color-id para vazio (estoque total).
        const clear = dialog.getByTestId('quickview-clear-color');
        if (await clear.count()) {
          await clear.click();
          await expect
            .poll(async () => stockBadge.getAttribute('data-color-id'))
            .toBe('');
        }

        // ── 9) Fecha QV pelo backdrop e foco restaura para o swatch ────────
        await firstSwatch.evaluate((el) =>
          el.setAttribute('data-focus-marker', '1'),
        );
        await page.mouse.click(5, 5);
        await expect(dialog).toBeHidden({ timeout: 5_000 });
        await page.evaluate(
          () =>
            new Promise<void>((r) =>
              requestAnimationFrame(() => requestAnimationFrame(() => r())),
            ),
        );
        const restored = await page.evaluate(() => {
          const a = document.activeElement as HTMLElement | null;
          if (!a) return false;
          return (
            a.getAttribute('data-focus-marker') === '1' ||
            !!a.closest('[data-focus-marker="1"]') ||
            !!a.getAttribute('data-testid')?.startsWith('color-swatch-')
          );
        });
        expect(restored, 'foco deve restaurar para um swatch').toBe(true);
      }
    });
  }
});

