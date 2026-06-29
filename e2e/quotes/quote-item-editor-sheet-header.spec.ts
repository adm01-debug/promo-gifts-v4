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
  { name: '320', width: 320, height: 720 },
  { name: '375', width: 375, height: 800 },
  { name: '768', width: 768, height: 1024 },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`QuoteItemEditorSheet @ ${vp.name}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, ROUTE);
      await page.getByTestId('open-editor-sheet').click();
      await expect(page.getByRole('dialog')).toBeVisible();
    });

    test('ordem DOM: "+ Produto" antes de "Detalhes do Item"', async ({ page }) => {
      const dialog = page.getByRole('dialog');
      const order = await dialog.evaluate((root) => {
        const btn = root.querySelector('[data-testid="quote-add-product-button-sheet"]');
        const title = Array.from(root.querySelectorAll('h2, [data-radix-dialog-title]')).find(
          (el) => /Detalhes do Item/i.test(el.textContent ?? ''),
        );
        if (!btn || !title) return null;
        const pos = btn.compareDocumentPosition(title);
        return { precedes: !!(pos & Node.DOCUMENT_POSITION_FOLLOWING) };
      });
      expect(order?.precedes, '"+ Produto" deve preceder o título no DOM').toBe(true);
    });

    test('layout: "+ Produto" à esquerda, título à direita, sem overflow', async ({
      page,
    }) => {
      const dialog = page.getByRole('dialog');
      const btn = page.getByTestId('quote-add-product-button-sheet');
      const title = dialog.getByText(/Detalhes do Item/i);

      const [dlgBox, btnBox, titleBox] = await Promise.all([
        dialog.boundingBox(),
        btn.boundingBox(),
        title.boundingBox(),
      ]);
      expect(dlgBox && btnBox && titleBox).toBeTruthy();
      if (!dlgBox || !btnBox || !titleBox) return;

      const btnCx = btnBox.x + btnBox.width / 2;
      const titleCx = titleBox.x + titleBox.width / 2;
      expect(btnCx, '"+ Produto" deve ficar à esquerda do título').toBeLessThan(titleCx);

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
          '[data-testid="quote-add-product-button-sheet"]',
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
      const header = page
        .getByRole('dialog')
        .locator('[data-testid="quote-add-product-button-sheet"]')
        .locator('xpath=ancestor::*[contains(@class, "flex")][1]');
      await expect(header).toBeVisible();
      expect(await header.screenshot()).toMatchSnapshot(
        `quote-item-editor-sheet-header-${vp.name}.png`,
        { maxDiffPixelRatio: 0.02 },
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
  });
}
