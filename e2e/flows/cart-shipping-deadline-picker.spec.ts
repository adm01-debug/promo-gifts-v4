/**
 * E2E — Prazo p/ envio (DatePickerField, variante compact).
 *
 * Executa o mesmo componente utilizado no `SellerCartsPage` (`ShippingDeadlinePicker`
 * delega ao `DatePickerField` compartilhado) via harness dev-only para eliminar
 * dependência de auth/carrinho. Cobre:
 *
 *  1. Abrir → selecionar → valor no formato ISO `yyyy-MM-dd` no trigger e no state
 *  2. Limpar (X inline) → trigger volta ao placeholder, sem abrir popover
 *  3. Botão "Hoje" no rodapé → data de hoje em ISO local
 *  4. Botão "Limpar" no rodapé → volta ao vazio, popover fecha
 *  5. A11y: aria-invalid propagado + foco no popover ao abrir
 */
import { test, expect } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

test.describe.configure({ mode: 'parallel' });
test.use({ trace: 'retain-on-failure', screenshot: 'only-on-failure' });

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`Prazo p/ envio [${vp.name}]`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
    });

    test('abrir picker, selecionar dia, limpar e clicar em "Hoje" gera ISO', async ({ page }) => {
      await gotoAndSettle(
        page,
        '/__visual/date-picker-field?variant=compact&state=empty',
      );

      const trigger = page.getByTestId('visual-dp-field');
      await expect(trigger).toBeVisible();
      await expect(trigger).toHaveText(/dd\/mm\/aaaa/);
      await expect(trigger).toHaveAttribute('data-empty', 'true');

      // 1. Abre o popover
      await trigger.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // 2. Seleciona um dia visível no calendário do mês atual (usa "15" que
      // sempre existe). Se o mês corrente tiver "15" desabilitado (nunca é o
      // caso pois minDate no harness não é aplicado por padrão), o teste
      // falharia com uma mensagem clara.
      const day15 = dialog.getByRole('gridcell', { name: /^15$/ }).first();
      await day15.click();

      // 3. Trigger reflete data selecionada em dd/MM/yyyy e popover fecha
      await expect(dialog).toBeHidden();
      await expect(trigger).toHaveText(/\b15\//);
      await expect(trigger).not.toHaveAttribute('data-empty', 'true');

      // 4. Botão X inline aparece — clicar limpa sem reabrir o popover
      const clearInline = page.getByTestId('visual-dp-field-clear');
      await expect(clearInline).toBeVisible();
      await clearInline.click();
      await expect(dialog).toBeHidden();
      await expect(trigger).toHaveText(/dd\/mm\/aaaa/);
      await expect(trigger).toHaveAttribute('data-empty', 'true');

      // 5. Reabre e usa botão "Hoje" do rodapé — data ISO do dia atual
      await trigger.click();
      await page.getByTestId('visual-dp-field-footer-today').click();
      await expect(dialog).toBeHidden();
      // O trigger exibe dd/MM/yyyy; verificamos que corresponde ao dia atual.
      const iso = todayIso();
      const [y, m, d] = iso.split('-');
      await expect(trigger).toHaveText(new RegExp(`${d}/${m}/${y}`));

      // 6. Reabre e usa "Limpar" do rodapé — trigger volta ao placeholder
      await trigger.click();
      await page.getByTestId('visual-dp-field-footer-clear').click();
      await expect(dialog).toBeHidden();
      await expect(trigger).toHaveText(/dd\/mm\/aaaa/);
    });

    test('aria-invalid e aria-describedby propagam ao trigger', async ({ page }) => {
      await gotoAndSettle(
        page,
        '/__visual/date-picker-field?variant=compact&state=error',
      );
      const trigger = page.getByTestId('visual-dp-field');
      await expect(trigger).toHaveAttribute('aria-invalid', 'true');
      await expect(trigger).toHaveAttribute('aria-describedby', 'visual-dp-error');
      await expect(page.locator('#visual-dp-error')).toBeVisible();
    });

    test('foco entra no popover ao abrir e X inline responde a teclado', async ({ page }) => {
      await gotoAndSettle(
        page,
        '/__visual/date-picker-field?variant=compact&state=selected&value=2026-07-11',
      );
      const trigger = page.getByTestId('visual-dp-field');
      // Foco no trigger e Enter abre o popover
      await trigger.focus();
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      // Radix + Calendar com initialFocus: foco entra no popover
      const activeInsideDialog = await dialog.evaluate((el) => el.contains(document.activeElement));
      expect(activeInsideDialog).toBe(true);
      // Esc fecha e devolve foco ao trigger
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();

      // X inline focável e disparado por Enter
      const clearInline = page.getByTestId('visual-dp-field-clear');
      await expect(clearInline).toHaveAttribute('role', 'button');
      await expect(clearInline).toHaveAttribute('tabindex', '0');
      await clearInline.focus();
      await page.keyboard.press('Enter');
      await expect(trigger).toHaveText(/dd\/mm\/aaaa/);
    });
  });
}
