/**
 * E2E: fluxo de "editar fornecedor" com CNPJ mascarado pré-carregado.
 *
 * Simula (via `/__test/cnpj-form?initial=02.931.668/0001-88`) a abertura
 * do formulário em modo Editar com CNPJ já persistido — possivelmente
 * mascarado no BD. Valida que:
 *   1) O input já abre com a máscara `02.931.668/0001-88`.
 *   2) O estado bruto interno é dígitos-only (`02931668000188`) — mesmo
 *      que o valor da query venha mascarado.
 *   3) Ao "Salvar", o payload enviado contém somente dígitos.
 *   4) O card selecionado e o histórico do dropdown mantêm exatamente
 *      a mesma máscara, sem drift.
 */
import { test, expect } from '@playwright/test';

const MASKED = '02.931.668/0001-88';
const DIGITS = '02931668000188';

test.describe('CNPJ — editar fornecedor (preload mascarado)', () => {
  test('abre com máscara, normaliza para dígitos, salva payload dígitos-only', async ({
    page,
  }) => {
    await page.goto(`/__test/cnpj-form?initial=${encodeURIComponent(MASKED)}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.getByTestId('cnpj-harness-ready').waitFor();

    const input = page.getByTestId('cnpj-input');

    // 1) Input abre já com a máscara idêntica.
    await expect(input).toHaveValue(MASKED);

    // 2) Estado bruto interno é dígitos-only.
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

    // 4) Card e histórico exibem a MESMA máscara.
    const cardText = (await page.getByTestId('cnpj-selected-card').innerText()).trim();
    const historyText = (await page.getByTestId('cnpj-dropdown-history').innerText()).trim();
    expect(cardText).toBe(MASKED);
    expect(historyText).toBe(MASKED);
    expect(cardText).toBe(historyText);
  });

  test('preload com dígitos-only também exibe máscara consistente', async ({
    page,
  }) => {
    await page.goto(`/__test/cnpj-form?initial=${DIGITS}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.getByTestId('cnpj-harness-ready').waitFor();

    await expect(page.getByTestId('cnpj-input')).toHaveValue(MASKED);
    await expect(page.getByTestId('cnpj-state-raw')).toHaveAttribute(
      'data-cnpj-raw',
      DIGITS,
    );
  });
});
