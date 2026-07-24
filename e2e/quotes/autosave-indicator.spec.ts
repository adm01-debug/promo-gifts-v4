import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import {
  QUOTE_AUTOSAVE_STATUS_TEXT,
  FORBIDDEN_AUTOSAVE_TEXT,
  QUOTE_AUTOSAVE_ARIA_LABEL,
} from '../../src/components/quotes/quoteAutoSaveStatus';

// Captura screenshot + vídeo automaticamente em falhas (playwright.config.ts
// já tem screenshot: 'only-on-failure' e video: 'retain-on-failure').
// Forçamos trace 'on' aqui para esse spec sensível ficar com evidência completa.
test.use({ trace: 'on', screenshot: 'only-on-failure', video: 'retain-on-failure' });

const INDICATOR = '[data-testid="quote-autosave-indicator"]';
const TEXT = '[data-testid="quote-autosave-text"]';

test.describe('QuoteAutoSave — indicador de auto-save', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
    await gotoAndSettle(page, '/orcamentos/novo');
  });

  test(`nunca exibe a frase proibida "${FORBIDDEN_AUTOSAVE_TEXT}"`, async ({ page }) => {
    const body = await page.locator('body').innerText();
    expect(body).not.toContain(FORBIDDEN_AUTOSAVE_TEXT);
  });

  test('indicador possui atributos de acessibilidade (role/aria)', async ({ page }) => {
    const el = page.locator(INDICATOR).first();
    await expect(el).toBeAttached();
    await expect(el).toHaveAttribute('role', 'status');
    await expect(el).toHaveAttribute('aria-label', QUOTE_AUTOSAVE_ARIA_LABEL);
    await expect(el).toHaveAttribute('aria-atomic', 'true');
    const live = await el.getAttribute('aria-live');
    expect(['polite', 'off']).toContain(live);
  });

  test('texto exibido sempre corresponde a uma string conhecida do SSOT', async ({ page }) => {
    const el = page.locator(TEXT).first();
    if (await el.count()) {
      const text = ((await el.textContent()) ?? '').trim();
      if (text.length > 0) {
        const T = QUOTE_AUTOSAVE_STATUS_TEXT;
        const valid =
          text === T.saving ||
          text === T.savedNow ||
          text === T.savedGeneric ||
          text === T.error ||
          text === T.offline ||
          text === T.unsaved ||
          /^Salvo há \d+ min$/.test(text) ||
          /^Salvo às \d{2}:\d{2}$/.test(text);
        expect(valid, `Texto inesperado: "${text}"`).toBe(true);
        expect(text).not.toBe(FORBIDDEN_AUTOSAVE_TEXT);
      }
    }
  });

  test('transições data-status: idle → saving → saved', async ({ page }) => {
    const el = page.locator(INDICATOR).first();
    await expect(el).toBeAttached();

    // Estado inicial: idle (sem edição) ou já outro estado válido
    const initial = await el.getAttribute('data-status');
    expect(['idle', 'saving', 'saved']).toContain(initial);

    // Dispara edição em algum input de texto para acionar o debounce de auto-save
    const firstInput = page
      .locator('input[type="text"]:visible, textarea:visible')
      .first();
    if (await firstInput.count()) {
      await firstInput.click();
      await firstInput.type(' ', { delay: 50 });

      // Deve transicionar para 'saving' ou 'saved' dentro de ~5s (debounce 2s + save)
      await expect(async () => {
        const s = await el.getAttribute('data-status');
        expect(['saving', 'saved']).toContain(s);
      }).toPass({ timeout: 6000 });

      // Eventualmente chega em 'saved'
      await expect(el).toHaveAttribute('data-status', 'saved', { timeout: 6000 });

      // Texto correspondente ao estado 'saved'
      const text = ((await page.locator(TEXT).first().textContent()) ?? '').trim();
      expect(
        text === QUOTE_AUTOSAVE_STATUS_TEXT.savedNow ||
          text === QUOTE_AUTOSAVE_STATUS_TEXT.savedGeneric ||
          /^Salvo há \d+ min$/.test(text),
      ).toBe(true);
    }
  });
});
