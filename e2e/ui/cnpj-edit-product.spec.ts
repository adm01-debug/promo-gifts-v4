/**
 * E2E: fluxo de "editar produto" com CNPJ mascarado pré-carregado.
 *
 * O formulário de novo/editar fornecedor dentro de PRODUTO
 * (BasicDataTab) usa exatamente a mesma SSOT de normalização
 * (`normalizeCnpj` + `assertPersistableCnpj`) que o cadastro de
 * fornecedor. O harness em `/__test/cnpj-form` exercita esse mesmo
 * pipeline; este spec cobre o cenário aplicado ao contexto de produto.
 *
 * Verifica que:
 *   1) Input abre com máscara `02.931.668/0001-88`.
 *   2) Estado bruto é dígitos-only.
 *   3) Payload enviado (create/edit de produto → fornecedor) só tem dígitos.
 *   4) Card selecionado e histórico do dropdown exibem a MESMA máscara.
 */
import { test, expect } from '@playwright/test';

const MASKED = '02.931.668/0001-88';
const DIGITS = '02931668000188';

test.describe('CNPJ — editar produto (preload mascarado)', () => {
  test('produto: input mascarado, estado dígitos-only, payload dígitos-only, parity card/histórico', async ({
    page,
  }) => {
    await page.goto(`/__test/cnpj-form?initial=${encodeURIComponent(MASKED)}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.getByTestId('cnpj-harness-ready').waitFor();

    await expect(page.getByTestId('cnpj-input')).toHaveValue(MASKED);
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
    expect(card).toBe(history);
  });

  test('produto: rejeita CNPJ com DVs inválidos exibindo erro inline', async ({
    page,
  }) => {
    await page.goto(`/__test/cnpj-form?initial=02931668000100`, {
      waitUntil: 'domcontentloaded',
    });
    await page.getByTestId('cnpj-harness-ready').waitFor();

    await page.getByTestId('cnpj-submit').click();
    await expect(page.getByTestId('cnpj-error')).toBeVisible();
    await expect(page.getByTestId('cnpj-error')).toContainText(/inv[aá]lido/i);
    // Payload não deve ter sido persistido.
    await expect(page.getByTestId('cnpj-saved-payload')).toHaveCount(0);
  });
});
