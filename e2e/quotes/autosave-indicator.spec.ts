import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

test.describe('Auto-save indicator (QuoteAutoSave)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('nunca exibe a frase "Salvo automaticamente"', async ({ page }) => {
    await gotoAndSettle(page, '/orcamentos/novo');
    // Aguarda render do builder
    await page.waitForLoadState('domcontentloaded');
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('Salvo automaticamente');
  });

  test('mostra status válidos quando há atividade', async ({ page }) => {
    await gotoAndSettle(page, '/orcamentos/novo');

    // Após qualquer edição/render, qualquer texto exibido pelo indicador
    // deve estar no conjunto válido — nunca o fallback removido.
    const validPatterns = [
      /Salvando\.\.\./,
      /Salvo agora/,
      /Salvo há \d+ min/,
      /Salvo às \d{2}:\d{2}/,
      /Alterações não salvas/,
      /Offline/,
      /Erro ao salvar/,
    ];

    // Aguarda eventual aparição (timeout curto, não obrigatório)
    const indicator = page.locator('span.text-muted-foreground').first();
    if (await indicator.count()) {
      const text = (await indicator.textContent())?.trim() ?? '';
      if (text.length > 0) {
        expect(validPatterns.some((re) => re.test(text))).toBe(true);
        expect(text).not.toBe('Salvo automaticamente');
      }
    }
  });
});
