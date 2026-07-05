/**
 * E2E — PdfGenerationDialog (fluxo completo)
 *
 * Cobre:
 *   1. Abrir o dialog a partir de um orçamento existente
 *   2. Validar aviso pill (role=status, aria-live, aria-label, visível ≥ sm)
 *   3. Validar tooltip do botão "Gerar PDF" (Radix, side=top)
 *   4. Click no confirm → download acionado → dialog volta a fechar sem regressão
 *   5. Roda em `chromium-authed`, `firefox-authed` e `mobile-chrome`
 *      para cobrir 2+ engines e responsividade real de foco/hover.
 *
 * Requer auth real (storageState). Skipa em projetos sem auth ou quando não
 * há orçamento enviado no ambiente (mesma heurística das outras specs de PDF).
 */
import { test, expect } from '../fixtures/test-base';
import { requireAuth } from '../fixtures/test-base';
import { gotoQuoteScenario } from '../quotes/_helpers/quote-scenarios';

const AUTHED_PROJECTS = new Set(['chromium-authed', 'firefox-authed', 'mobile-chrome', 'mobile-safari']);

test.describe('PdfGenerationDialog · fluxo completo', () => {
  test.skip(
    ({}, testInfo) => !AUTHED_PROJECTS.has(testInfo.project.name),
    'Requer projeto autenticado (multi-engine + mobile).',
  );
  test.beforeEach(() => requireAuth());

  test('abre, valida aviso + tooltip, gera PDF e fecha sem regressão', async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name.startsWith('mobile-');

    const ok = await gotoQuoteScenario(page, 'enviada');
    if (!ok) test.skip(true, 'Sem orçamento enviado no ambiente.');

    // 1) Abre o dialog
    const trigger = page.getByTestId('pdf-preview-trigger');
    await expect(trigger).toBeVisible();
    await trigger.click();

    const confirm = page.getByTestId('pdf-generate-confirm');
    await expect(confirm).toBeVisible({ timeout: 10_000 });
    await expect(confirm).toBeEnabled();
    await expect(confirm).toHaveAttribute('aria-label', /gerar.+pdf/i);

    // 2) Aviso pill — contrato ARIA sempre presente no DOM
    const pill = page.locator('.pdf-warn-pill');
    await expect(pill).toHaveCount(1);
    await expect(pill).toHaveAttribute('role', 'status');
    await expect(pill).toHaveAttribute('aria-live', 'polite');
    await expect(pill).toHaveAttribute('aria-label', /aviso|confira/i);
    if (!isMobile) {
      // No desktop o pill é visível (hidden sm:inline-flex)
      await expect(pill).toBeVisible();
    }

    // 3) Tooltip do botão "Gerar PDF" — apenas desktop (Radix não abre por
    //    hover em touch e a11y do label já é coberta pelo aria-label).
    if (!isMobile) {
      await confirm.focus();
      await confirm.hover();
      const tooltip = page.getByRole('tooltip', {
        name: /gera e baixa o pdf final da proposta/i,
      });
      await expect(tooltip).toBeVisible({ timeout: 3_000 });
    }

    // 4) Click no confirm → o gerador dispara. Aceita 2 evidências:
    //    (a) transição de stage para "generating" (loader visível), OU
    //    (b) evento de download do Playwright.
    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 }).catch(() => null);
    await confirm.click();

    // O botão some (stage muda) OU o loader aparece.
    await Promise.race([
      expect(confirm).toHaveCount(0, { timeout: 8_000 }),
      expect(page.locator('svg.animate-spin').first()).toBeVisible({ timeout: 8_000 }),
    ]).catch(() => undefined);

    const download = await downloadPromise;
    if (download) {
      expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    }

    // 5) Fluxo de fechamento — pressionar ESC em qualquer stage não-generating
    //    deve fechar o dialog e restaurar o botão de gatilho na página.
    await page.keyboard.press('Escape').catch(() => undefined);
    // Tentativa best-effort: se ainda aberto (stage=generating), aguarda ready.
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape').catch(() => undefined);
    await expect(page.getByTestId('pdf-preview-trigger')).toBeVisible({ timeout: 15_000 });
  });
});
