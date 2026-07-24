/**
 * Visual snapshots — DatePickerField (Prazo p/ envio) em light + dark mode.
 *
 * Garante que o redesign iOS Calendar do trigger e do popover permaneça
 * consistente e não regrida silenciosamente (ex.: por revert do Lovable ou
 * mudança acidental de tokens). Cobre:
 *
 *  - Trigger vazio / com data / com erro
 *  - Popover aberto (calendário + rodapé "Limpar / Hoje")
 *  - Light e dark mode
 *  - Variantes compact (Prazo p/ envio) e input (De/Até)
 *
 * Para regenerar após uma mudança intencional de design:
 *   npx playwright test e2e/ui/date-picker-field-visual.spec.ts --update-snapshots
 */
import { test, expect } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

test.describe.configure({ mode: 'parallel' });

const THEMES = ['light', 'dark'] as const;
const VARIANTS = ['compact', 'input'] as const;
const VIEWPORT = { width: 480, height: 640 };

for (const theme of THEMES) {
  for (const variant of VARIANTS) {
    test.describe(`DatePickerField visual [${variant} · ${theme}]`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize(VIEWPORT);
      });

      test('trigger vazio', async ({ page }) => {
        await gotoAndSettle(
          page,
          `/__visual/date-picker-field?variant=${variant}&state=empty&theme=${theme}`,
        );
        const card = page.getByTestId('visual-date-picker-card');
        await expect(card).toBeVisible();
        await expect(card).toHaveScreenshot(`dp-${variant}-${theme}-empty.png`, {
          maxDiffPixelRatio: 0.01,
        });
      });

      test('trigger com data selecionada', async ({ page }) => {
        await gotoAndSettle(
          page,
          `/__visual/date-picker-field?variant=${variant}&state=selected&value=2026-07-11&theme=${theme}`,
        );
        const card = page.getByTestId('visual-date-picker-card');
        await expect(card.getByTestId('visual-dp-field')).toHaveText(/11\/07\/2026/);
        await expect(card).toHaveScreenshot(`dp-${variant}-${theme}-selected.png`, {
          maxDiffPixelRatio: 0.01,
        });
      });

      test('trigger em estado de erro', async ({ page }) => {
        await gotoAndSettle(
          page,
          `/__visual/date-picker-field?variant=${variant}&state=error&theme=${theme}`,
        );
        const card = page.getByTestId('visual-date-picker-card');
        await expect(card.getByTestId('visual-dp-field')).toHaveAttribute('aria-invalid', 'true');
        await expect(card).toHaveScreenshot(`dp-${variant}-${theme}-error.png`, {
          maxDiffPixelRatio: 0.01,
        });
      });

      test('popover aberto (calendário iOS + rodapé)', async ({ page }) => {
        await gotoAndSettle(
          page,
          `/__visual/date-picker-field?variant=${variant}&state=selected&value=2026-07-11&theme=${theme}`,
        );
        const trigger = page.getByTestId('visual-dp-field');
        await trigger.click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        // Aguarda estabilizar animação do popover.
        await page.waitForTimeout(200);
        await expect(dialog).toHaveScreenshot(`dp-${variant}-${theme}-popover-open.png`, {
          maxDiffPixelRatio: 0.02,
        });
      });
    });
  }
}
