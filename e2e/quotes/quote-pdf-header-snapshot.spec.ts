/**
 * E2E (visual) — Cabeçalho do PDF/preview com `quote_number` não pode
 * quebrar a numeração nos breakpoints intermediários (768 e 1024).
 *
 * Estratégia:
 *  1. Para cada largura (768px, 1024px), abre um orçamento ENVIADO,
 *     aciona `pdf-preview-trigger` para abrir o dialog de preview,
 *     localiza o cabeçalho via `data-testid="quote-number-display"`
 *     e tira screenshot SOMENTE do cabeçalho.
 *  2. Compara com baseline por breakpoint (estratégia idêntica ao
 *     spec `quote-number-subtitle.spec.ts`).
 *  3. Antes do snapshot, valida invariantes textuais (regex do número
 *     + ausência da frase legada) — falha cedo se a numeração quebrou
 *     mesmo antes do diff visual.
 */
import { test, expect } from '../fixtures/test-base';
import { requireAuth } from '../fixtures/test-base';
import {
  FORBIDDEN_PHRASE,
  QUOTE_NUMBER_REGEX,
  gotoQuoteScenario,
} from './_helpers/quote-scenarios';

// Apenas larguras intermediárias — desktop/mobile já cobertos por outro spec.
const INTERMEDIATE_BREAKPOINTS = [
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'laptop-1024', width: 1024, height: 768 },
] as const;

test.describe('PDF header · quote_number snapshot (768/1024)', () => {
  test.skip(
    ({ page: _page }, testInfo) => testInfo.project.name !== 'chromium-authed',
    'Requer auth real para preview do PDF.',
  );
  test.beforeEach(() => requireAuth());

  for (const bp of INTERMEDIATE_BREAKPOINTS) {
    test(`[${bp.name}] cabeçalho mantém numeração intacta`, async ({ page }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });

      const ok = await gotoQuoteScenario(page, 'enviada');
      if (!ok) test.skip(true, 'Sem orçamento enviado no ambiente.');

      // Abre o dialog de preview do PDF (mesma rota visual do export).
      const trigger = page.getByTestId('pdf-preview-trigger');
      if ((await trigger.count()) === 0) {
        test.skip(true, 'Trigger de preview indisponível.');
      }
      await trigger.click();

      // Localiza o cabeçalho dentro do preview.
      const header = page.getByTestId('quote-number-display').first();
      await expect(header).toBeVisible({ timeout: 10_000 });

      // Invariantes textuais — fail-fast antes do diff de pixels.
      const txt = (await header.textContent()) ?? '';
      expect(txt, 'cabeçalho não contém quote_number no formato NNNNN/YY').toMatch(
        QUOTE_NUMBER_REGEX,
      );
      expect(txt).not.toContain(FORBIDDEN_PHRASE);

      // Snapshot SOMENTE do header — robusto a mudanças no resto do dialog.
      // maxDiffPixelRatio tolera pequenas variações de antialias por DPR.
      await expect(header).toHaveScreenshot(`quote-number-header-${bp.name}.png`, {
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
      });
    });
  }
});
