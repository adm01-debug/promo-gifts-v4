/**
 * E2E: criar produto com CNPJ mascarado.
 *
 * O harness `/__test/cnpj-form` exercita a mesma SSOT (`normalizeCnpj` +
 * `assertPersistableCnpj`) usada em BasicDataTab do fluxo "Novo Produto".
 * Aqui simulamos criar (sem `?initial`), digitando um CNPJ mascarado.
 */
import { test, expect } from '@playwright/test';

const MASKED = '02.931.668/0001-88';
const DIGITS = '02931668000188';

test.describe('CNPJ — criar produto (input mascarado)', () => {
  test('digita mascarado, salva dígitos-only, card + histórico com mesma máscara', async ({
    page,
  }) => {
    await page.goto('/__test/cnpj-form', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('cnpj-harness-ready').waitFor();

    const input = page.getByTestId('cnpj-input');
    await input.fill(MASKED);
    await expect(input).toHaveValue(MASKED);

    await expect(page.getByTestId('cnpj-state-raw')).toHaveAttribute(
      'data-cnpj-raw',
      DIGITS,
    );

    await page.getByTestId('cnpj-submit').click();
    const saved = page.getByTestId('cnpj-saved-payload');
    await expect(saved).toBeVisible();
    await expect(saved).toHaveAttribute('data-cnpj-persisted', DIGITS);
    await expect(saved).toHaveAttribute('data-cnpj-digits-only', 'true');

    const payload = await page.evaluate(() => window.__lastCnpjPayload);
    expect(payload?.cnpj).toBe(DIGITS);
    expect(/^\d+$/.test(payload?.cnpj ?? '')).toBe(true);

    const card = (await page.getByTestId('cnpj-selected-card').innerText()).trim();
    const history = (
      await page.getByTestId('cnpj-dropdown-history').innerText()
    ).trim();
    expect(card).toBe(MASKED);
    expect(history).toBe(MASKED);
  });
});
