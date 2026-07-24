/**
 * QuoteItemEditorSheet — header order, overflow e foco em 320/375/768.
 *
 * Valida:
 *  1. DOM: botão "+ Produto" precede "Detalhes do Item" (ordem visual + leitura).
 *  2. Visual: "+ Produto" à esquerda, título à direita (centro X).
 *  3. Sem overflow horizontal do sheet em 320/375/768.
 *  4. A11y: foco inicial cai dentro do dialog; primeiro elemento focável
 *     é o botão "+ Produto" (consistente com a nova ordem de tab).
 *  5. Snapshot visual do header por viewport.
 */
import { test, expect } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/__visual/quote-item-editor-sheet';
const VIEWPORTS = [
  { name: '320', width: 320, height: 720, maxGap: 32 },
  { name: '375', width: 375, height: 800, maxGap: 32 },
  { name: '768', width: 768, height: 1024, maxGap: 32 },
  { name: '1024', width: 1024, height: 900, maxGap: 24 },
  { name: '1440', width: 1440, height: 1000, maxGap: 24 },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`QuoteItemEditorSheet @ ${vp.name}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, ROUTE);
      await page.getByTestId('open-editor-sheet').click();
      await expect(page.getByRole('dialog')).toBeVisible();
    });

    test('DOM: botão Salvar presente e texto "Detalhes do Item" removido', async ({ page }) => {
      const dialog = page.getByRole('dialog');
      const result = await dialog.evaluate((root) => {
        const btn = root.querySelector('[data-testid="quote-save-item-button-sheet"]');
        const hasOldTitle = /Detalhes do Item/i.test(root.textContent ?? '');
        return { hasBtn: !!btn, hasOldTitle };
      });
      expect(result.hasBtn, '"botão Salvar deve existir no dialog"').toBe(true);
      expect(result.hasOldTitle, '"Detalhes do Item" não deve aparecer mais').toBe(false);
    });

    test('layout: "+ Produto" alinhado à esquerda, sem overflow', async ({ page }) => {
      const dialog = page.getByRole('dialog');
      const btn = page.getByTestId('quote-save-item-button-sheet');

      const [dlgBox, btnBox] = await Promise.all([
        dialog.boundingBox(),
        btn.boundingBox(),
      ]);
      expect(dlgBox && btnBox).toBeTruthy();
      if (!dlgBox || !btnBox) return;

      // "+ Produto" deve ficar na metade esquerda do dialog.
      const btnCx = btnBox.x + btnBox.width / 2;
      expect(btnCx).toBeLessThan(dlgBox.x + dlgBox.width / 2);

      expect(dlgBox.width).toBeLessThanOrEqual(vp.width + 1);
      const { scrollW, clientW } = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      }));
      expect(scrollW).toBeLessThanOrEqual(clientW + 1);
    });

    test('a11y: foco entra no dialog e primeiro Tab focável é "+ Produto"', async ({
      page,
    }) => {
      const focusInside = await page.evaluate(() => {
        const dlg = document.querySelector('[role="dialog"]');
        return !!dlg && !!document.activeElement && dlg.contains(document.activeElement);
      });
      expect(focusInside, 'foco inicial deve estar dentro do dialog').toBe(true);

      // Radix Sheet foca o close button primeiro; o próximo Tab deve cair
      // no botão "+ Produto" (ordem visual = ordem DOM = ordem de tab).
      const reachedAddProduct = await page.evaluate(() => {
        const dlg = document.querySelector('[role="dialog"]');
        const target = dlg?.querySelector(
          '[data-testid="quote-save-item-button-sheet"]',
        ) as HTMLElement | null;
        if (!target) return false;
        const focusables = Array.from(
          dlg!.querySelectorAll<HTMLElement>(
            'button, [href], input, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => !el.hasAttribute('disabled'));
        const idx = focusables.indexOf(target);
        // "+ Produto" deve estar entre os primeiros focáveis do header (≤ 2).
        return idx >= 0 && idx <= 2;
      });
      expect(reachedAddProduct).toBe(true);
    });

    test('snapshot visual do header', async ({ page }) => {
      // Desliga animações/transições para evitar flake do glow (box-shadow blur)
      // e move o cursor para fora pra não disparar hover.
      await page.mouse.move(0, 0);
      await page.addStyleTag({
        content: `*, *::before, *::after { transition: none !important; animation: none !important; }`,
      });
      const header = page
        .getByRole('dialog')
        .locator('[data-testid="quote-save-item-button-sheet"]')
        .locator('xpath=ancestor::*[contains(@class, "flex")][1]');
      await expect(header).toBeVisible();
      expect(await header.screenshot()).toMatchSnapshot(
        `quote-item-editor-sheet-header-${vp.name}.png`,
        { maxDiffPixelRatio: 0.05, threshold: 0.25 },
      );
    });

    test('snapshot visual do corpo inteiro do sheet (sem overflow)', async ({ page }) => {
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      const box = await dialog.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
      }

      expect(await dialog.screenshot()).toMatchSnapshot(
        `quote-item-editor-sheet-body-${vp.name}.png`,
        { maxDiffPixelRatio: 0.02 },
      );
    });

    test(`layout: conteúdo preenche o sheet (sem rodapé vazio > ${vp.maxGap}px)`, async ({ page }) => {
      const dialog = page.getByRole('dialog');
      // Estabiliza fontes + 2 RAFs + animações off para evitar flake de medição.
      await page.addStyleTag({
        content: `*, *::before, *::after { transition: none !important; animation: none !important; }`,
      });
      await page.evaluate(async () => {
        // @ts-expect-error -- document.fonts pode não existir em alguns engines
        if (document.fonts?.ready) await document.fonts.ready;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      });
      const gap = await dialog.evaluate((root) => {
        const r = root.getBoundingClientRect();
        const focusables = Array.from(
          root.querySelectorAll<HTMLElement>('*'),
        ).filter((el) => {
          const b = el.getBoundingClientRect();
          return b.width > 0 && b.height > 0 && b.bottom <= r.bottom + 1;
        });
        const maxBottom = focusables.reduce(
          (acc, el) => Math.max(acc, el.getBoundingClientRect().bottom),
          r.top,
        );
        return r.bottom - maxBottom;
      });
      expect(gap, `rodapé vazio detectado: ${gap}px`).toBeLessThanOrEqual(vp.maxGap);
    });

    test('a11y: "Salvar" expõe aria-label, title e ícone decorativo', async ({ page }) => {
      const btn = page.getByTestId('quote-save-item-button-sheet');
      await expect(btn).toBeVisible();
      const aria = await btn.getAttribute('aria-label');
      expect(aria, 'aria-label deve conter "Salvar"').toMatch(/Salvar/i);
      const title = await btn.getAttribute('title');
      expect(title, 'title deve conter "Salvar"').toMatch(/Salvar/i);
      const iconAriaHidden = await btn.locator('svg').first().getAttribute('aria-hidden');
      expect(iconAriaHidden).toBe('true');
    });

    test('estado: sem item ativo, "Salvar" fica desabilitado e anuncia indisponibilidade', async ({ page }) => {
      // Harness default (sem ?withItem=1) → item=null → Salvar desabilitado.
      const btn = page.getByTestId('quote-save-item-button-sheet');
      await expect(btn).toBeDisabled();
      await expect(btn).toHaveAttribute('aria-disabled', 'true');
      const aria = await btn.getAttribute('aria-label');
      expect(aria).toMatch(/indispon[ií]vel|nenhum item/i);
    });
  });

  test.describe(`QuoteItemEditorSheet @ ${vp.name}px (com item ativo)`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, `${ROUTE}?withItem=1&longContent=1`);
      await page.getByTestId('open-editor-sheet').click();
      await expect(page.getByRole('dialog')).toBeVisible();
    });

    test('Salvar: habilitado, fecha o sheet e mantém estado fora dele', async ({ page }) => {
      const btn = page.getByTestId('quote-save-item-button-sheet');
      await expect(btn).toBeEnabled();
      await expect(btn).toHaveAttribute('aria-disabled', 'false');
      await expect(page.getByTestId('sheet-open-state')).toHaveAttribute('data-open', '1');

      await btn.click();

      // Sheet fecha → dialog desmonta → estado externo reflete o fechamento.
      await expect(page.getByRole('dialog')).toBeHidden();
      await expect(page.getByTestId('sheet-open-state')).toHaveAttribute('data-open', '0');

      // Reabrir mostra o mesmo item persistido (escolhas preservadas no harness).
      await page.getByTestId('open-editor-sheet').click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(btn).toBeEnabled();
    });

    test('a11y teclado: preço read-only NÃO entra no tab order do sheet', async ({ page }) => {
      const dialog = page.getByRole('dialog');
      const price = dialog.getByTestId('quote-item-price-display');
      await expect(price).toBeVisible();

      // Preço não deve ser focável nem por Tab nem por foco programático.
      const isFocusable = await price.evaluate((el) => {
        const tag = el.tagName.toLowerCase();
        const tabindex = el.getAttribute('tabindex');
        const nativelyFocusable = ['a', 'button', 'input', 'select', 'textarea'].includes(tag);
        return nativelyFocusable || (tabindex !== null && parseInt(tabindex, 10) >= 0);
      });
      expect(isFocusable, 'preço read-only não pode estar no tab order').toBe(false);

      // Varre a sequência de Tab dentro do dialog e garante que o preço nunca
      // recebe foco, enquanto as ações reais (Salvar, Qtd, Remover) recebem.
      const visited = await page.evaluate(async () => {
        const dlg = document.querySelector('[role="dialog"]') as HTMLElement | null;
        if (!dlg) return [];
        const tids: string[] = [];
        for (let i = 0; i < 20; i++) {
          const active = document.activeElement as HTMLElement | null;
          if (!active || !dlg.contains(active)) break;
          const tid =
            active.getAttribute('data-testid') ??
            active.closest('[data-testid]')?.getAttribute('data-testid') ??
            active.tagName.toLowerCase();
          tids.push(tid);
          // Dispara Tab nativo via KeyboardEvent é flaky — usa o helper do Playwright fora.
          break;
        }
        return tids;
      });
      // Sequência inicial mínima — basta garantir que o primeiro foco não é o preço.
      for (const tid of visited) {
        expect(tid).not.toBe('quote-item-price-display');
      }

      // Tab algumas vezes e confirma que nunca pousa no preço.
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press('Tab');
        const focusedIsPrice = await page.evaluate(
          () =>
            (document.activeElement as HTMLElement | null)?.getAttribute('data-testid') ===
            'quote-item-price-display',
        );
        expect(focusedIsPrice, `Tab #${i + 1} pousou no preço read-only`).toBe(false);
      }
    });

    test('a11y teclado: ciclo Salvar → reabrir mantém preço fora do tab order', async ({
      page,
    }) => {
      const openBtn = page.getByTestId('open-editor-sheet');
      const sheet = page.getByTestId('quote-item-editor-sheet');
      const save = page.getByTestId('quote-save-item-button-sheet');

      // Salvar fecha o sheet.
      await expect(save).toBeEnabled();
      await save.click();
      await expect(sheet).toBeHidden();

      // Reabre e revalida que o preço não entra no tab order após o ciclo.
      await openBtn.click();
      await expect(sheet).toBeVisible();
      const price = page.getByTestId('quote-item-price-display');
      await expect(price).toBeVisible();

      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
        const focusedTid = await page.evaluate(
          () =>
            (document.activeElement as HTMLElement | null)?.getAttribute('data-testid') ?? '',
        );
        expect(
          focusedTid,
          `pós-reabrir: Tab #${i + 1} pousou no preço`,
        ).not.toBe('quote-item-price-display');
      }
    });
  });


  test.describe(`QuoteItemEditorSheet @ ${vp.name}px (unsaved guard)`, () => {
    test('hasUnsavedChanges=true: ESC abre AlertDialog; cancelar mantém aberto, confirmar fecha', async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, `${ROUTE}?withItem=1&longContent=1&unsaved=1`);
      await page.getByTestId('open-editor-sheet').click();
      const sheet = page.getByTestId('quote-item-editor-sheet');
      await expect(sheet).toBeVisible();

      // ESC → AlertDialog aparece; "Continuar editando" mantém sheet aberto.
      await page.keyboard.press('Escape');
      const confirmDialog = page.getByTestId('quote-editor-unsaved-dialog');
      await expect(confirmDialog).toBeVisible();
      await expect(confirmDialog).toContainText(/n[ãa]o salvas/i);

      const dialogBox = await confirmDialog.boundingBox();
      expect(dialogBox).not.toBeNull();
      if (dialogBox) {
        const expectedWidth = Math.min(358, vp.width * 0.92);
        expect(Math.abs(dialogBox.width - expectedWidth)).toBeLessThanOrEqual(4);
      }

      for (const testId of ['quote-editor-unsaved-cancel', 'quote-editor-unsaved-confirm']) {
        const metrics = await page.getByTestId(testId).evaluate((el) => {
          const node = el as HTMLElement;
          return {
            clientWidth: node.clientWidth,
            scrollWidth: node.scrollWidth,
            whiteSpace: getComputedStyle(node).whiteSpace,
          };
        });
        expect(metrics.whiteSpace).toContain('nowrap');
        expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
      }

      await page.getByTestId('quote-editor-unsaved-cancel').click();
      await expect(confirmDialog).toBeHidden();
      await expect(sheet).toBeVisible();
      await expect(page.getByTestId('sheet-open-state')).toHaveAttribute('data-open', '1');

      // ESC → confirmar → sheet fecha.
      await page.keyboard.press('Escape');
      await expect(confirmDialog).toBeVisible();
      await page.getByTestId('quote-editor-unsaved-confirm').click();
      await expect(sheet).toBeHidden();
      await expect(page.getByTestId('sheet-open-state')).toHaveAttribute('data-open', '0');
    });

    test('Salvar (ação explícita) fecha sem confirmação, mesmo com unsaved=1', async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, `${ROUTE}?withItem=1&longContent=1&unsaved=1`);
      await page.getByTestId('open-editor-sheet').click();
      await expect(page.getByTestId('quote-item-editor-sheet')).toBeVisible();

      await page.getByTestId('quote-save-item-button-sheet').click();
      await expect(page.getByTestId('quote-editor-unsaved-dialog')).toBeHidden();
      await expect(page.getByTestId('sheet-open-state')).toHaveAttribute('data-open', '0');
    });
  });

  test.describe(`QuoteItemEditorSheet @ ${vp.name}px (persistência Salvar → reabrir)`, () => {
    test('escolhas permanecem ao reabrir após Salvar (conteúdo longo)', async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, `${ROUTE}?withItem=1&longContent=1`);

      await page.getByTestId('open-editor-sheet').click();
      const sheet = page.getByTestId('quote-item-editor-sheet');
      await expect(sheet).toBeVisible();

      // Captura uma assinatura do conteúdo (product_name + notas) antes de fechar.
      const before = await sheet.evaluate((el) => el.textContent ?? '');
      expect(before).toMatch(/Caneca cer[âa]mica/i);
      expect(before).toMatch(/Linha 1 de observação/i);

      // Salvar → fecha.
      await page.getByTestId('quote-save-item-button-sheet').click();
      await expect(sheet).toBeHidden();
      await expect(page.getByTestId('sheet-open-state')).toHaveAttribute('data-open', '0');

      // Reabrir → o mesmo item (mesmo product_name e notas) deve continuar lá.
      await page.getByTestId('open-editor-sheet').click();
      await expect(sheet).toBeVisible();
      const after = await sheet.evaluate((el) => el.textContent ?? '');
      expect(after).toMatch(/Caneca cer[âa]mica/i);
      expect(after).toMatch(/Linha 1 de observação/i);
      expect(after).toMatch(/Linha 12 de observação/i);
    });
  });
}



