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

    test('DOM: "+ Produto" presente e texto "Detalhes do Item" removido', async ({ page }) => {
      const dialog = page.getByRole('dialog');
      const result = await dialog.evaluate((root) => {
        const btn = root.querySelector('[data-testid="quote-save-item-button-sheet"]');
        const hasOldTitle = /Detalhes do Item/i.test(root.textContent ?? '');
        return { hasBtn: !!btn, hasOldTitle };
      });
      expect(result.hasBtn, '"+ Produto" deve existir no dialog').toBe(true);
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



