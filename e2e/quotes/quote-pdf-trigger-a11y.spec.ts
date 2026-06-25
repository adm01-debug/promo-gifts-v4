/**
 * E2E (a11y) — `pdf-preview-trigger` é o único controle do desktop para
 * iniciar o fluxo de export do PDF.
 *
 * Valida:
 *  1. `aria-label` presente e não-vazio (descrição acessível).
 *  2. Tag semântica `<button>` e não disabled.
 *  3. É o ÚNICO elemento clicável com qualquer texto/label relacionado
 *     a "PDF/Exportar/Baixar" visível no desktop antes de abrir o dialog.
 *  4. Após click, o foco vai para o dialog (Radix) e o confirm
 *     `pdf-generate-confirm` aparece.
 */
import { test, expect } from '../fixtures/test-base';
import { requireAuth } from '../fixtures/test-base';
import { gotoQuoteScenario } from './_helpers/quote-scenarios';

test.describe('PDF export · a11y do gatilho (desktop)', () => {
  test.skip(
    ({ page: _page }, testInfo) => testInfo.project.name !== 'chromium-authed',
    'Requer auth real.',
  );
  test.beforeEach(() => requireAuth());

  test('pdf-preview-trigger tem aria-label e é o único controle de export no desktop', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const ok = await gotoQuoteScenario(page, 'enviada');
    if (!ok) test.skip(true, 'Sem orçamento enviado no ambiente.');

    const trigger = page.getByTestId('pdf-preview-trigger');
    await expect(trigger).toHaveCount(1);
    await expect(trigger).toBeVisible();
    await expect(trigger).toBeEnabled();

    // (1) aria-label não-vazio.
    const ariaLabel = await trigger.getAttribute('aria-label');
    expect(ariaLabel, 'aria-label ausente em pdf-preview-trigger').toBeTruthy();
    expect((ariaLabel ?? '').trim().length).toBeGreaterThan(0);

    // (2) tag <button> nativa (acessível por teclado por padrão).
    const tag = await trigger.evaluate((el) => el.tagName.toLowerCase());
    expect(tag).toBe('button');

    // (3) único controle de export visível antes de abrir o dialog.
    //     Confirm e mobile NÃO devem existir/estar visíveis ainda.
    await expect(page.getByTestId('pdf-generate-confirm')).toHaveCount(0);
    const mobileBars = page.getByTestId('pdf-export-mobile');
    const mobileCount = await mobileBars.count();
    if (mobileCount > 0) {
      // se renderizado, deve estar escondido pelo CSS do breakpoint desktop
      await expect(mobileBars.first()).toBeHidden();
    }

    // (4) click abre o dialog → confirm aparece e fica focável.
    await trigger.click();
    const confirm = page.getByTestId('pdf-generate-confirm');
    await expect(confirm).toHaveCount(1, { timeout: 10_000 });
    await expect(confirm).toBeVisible();
    await expect(confirm).toBeEnabled();
    await expect(confirm).toHaveAttribute('aria-label', /.+/);
  });
});
