/**
 * E2E: fluxo de normalização de CNPJ.
 *
 * Valida em `/__test/cnpj-form`:
 *   1) Digitar `02.931.668/0001-88` (com máscara) mantém máscara idêntica no input.
 *   2) Estado interno guarda **somente dígitos** (`02931668000188`).
 *   3) Após "Salvar", o payload persistido contém apenas dígitos.
 *   4) O CNPJ exibido no "card selecionado" e no "histórico do dropdown"
 *      é exatamente `02.931.668/0001-88` — mesma string, sem drift.
 */
import { test, expect } from '@playwright/test';

const MASKED = '02.931.668/0001-88';
const DIGITS = '02931668000188';

test.describe('CNPJ — normalização e paridade de exibição', () => {
  test('digita máscara, salva dígitos, exibe máscara idêntica em card + histórico', async ({
    page,
  }) => {
    await page.goto('/__test/cnpj-form', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('cnpj-harness-ready').waitFor();

    const input = page.getByTestId('cnpj-input');
    await input.click();
    // Digitar o CNPJ mascarado — a máscara é reaplicada no render.
    await input.fill(MASKED);

    // 1) Input mostra exatamente a string mascarada.
    await expect(input).toHaveValue(MASKED);

    // 2) Estado bruto é dígitos-only e passa isNormalizedCnpj.
    const stateRaw = page.getByTestId('cnpj-state-raw');
    await expect(stateRaw).toHaveAttribute('data-cnpj-raw', DIGITS);
    await expect(stateRaw).toHaveAttribute('data-cnpj-is-normalized', 'true');

    // 3) Salvar → payload persistido tem apenas dígitos.
    await page.getByTestId('cnpj-submit').click();
    const savedBox = page.getByTestId('cnpj-saved-payload');
    await expect(savedBox).toBeVisible();
    await expect(savedBox).toHaveAttribute('data-cnpj-persisted', DIGITS);
    await expect(savedBox).toHaveAttribute('data-cnpj-digits-only', 'true');

    const winPayload = await page.evaluate(() => window.__lastCnpjPayload);
    expect(winPayload?.cnpj).toBe(DIGITS);
    expect(/^\d+$/.test(winPayload?.cnpj ?? '')).toBe(true);

    // 4) Card selecionado + histórico do dropdown mostram a MESMA máscara.
    const cardText = await page.getByTestId('cnpj-selected-card').innerText();
    const historyText = await page
      .getByTestId('cnpj-dropdown-history')
      .innerText();
    expect(cardText.trim()).toBe(MASKED);
    expect(historyText.trim()).toBe(MASKED);
    expect(cardText.trim()).toBe(historyText.trim());
  });

  test('input sujo (espaços/letras) ainda armazena apenas dígitos', async ({
    page,
  }) => {
    await page.goto('/__test/cnpj-form', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('cnpj-harness-ready').waitFor();

    const input = page.getByTestId('cnpj-input');
    await input.fill('  02abc.931.668/0001-88xyz  ');

    // Máscara re-renderizada limpa qualquer caractere não-dígito.
    await expect(input).toHaveValue(MASKED);

    await page.getByTestId('cnpj-submit').click();
    const winPayload = await page.evaluate(() => window.__lastCnpjPayload);
    expect(winPayload?.cnpj).toBe(DIGITS);
    expect(winPayload?.digitsOnly).toBe(true);
  });
});
