/**
 * E2E: validação de CNPJ inválido em fornecedor e produto.
 *
 * O harness `/__test/cnpj-form` compartilha a SSOT `assertPersistableCnpj`
 * usada tanto no create/editar de FORNECEDOR (SupplierFormDialog +
 * useSuppliersManager) quanto de PRODUTO (BasicDataTab +
 * useNewSupplierForm). Portanto, cobre ambos os fluxos.
 *
 * Casos cobertos:
 *   1) Não-dígitos → normalizados; se restar < 14 dígitos → erro inline.
 *   2) Quantidade de dígitos < 14 → erro inline "14 dígitos".
 *   3) DVs inválidos (14 dígitos, checksum errado) → erro "inválido".
 *   4) Todos-iguais (regra CNPJ) → erro.
 *   5) Payload NÃO é persistido em nenhum caso de erro.
 */
import { test, expect } from '@playwright/test';

interface InvalidCase {
  label: string;
  initial: string;
  errorRegex: RegExp;
}

const INVALID_CASES: InvalidCase[] = [
  {
    label: 'não-dígitos que resultam em < 14 após normalizar',
    initial: 'abc.def.ghi/jklm-no',
    errorRegex: /14 d[ií]gitos/i,
  },
  {
    label: 'menos de 14 dígitos',
    initial: '02931668000',
    errorRegex: /14 d[ií]gitos/i,
  },
  {
    label: 'DVs inválidos (14 dígitos, checksum errado)',
    initial: '02931668000100',
    errorRegex: /inv[aá]lido/i,
  },
  {
    label: 'todos-iguais (regra CNPJ)',
    initial: '11111111111111',
    errorRegex: /inv[aá]lido/i,
  },
];

test.describe('CNPJ — mensagens de erro inline (fornecedor + produto)', () => {
  for (const c of INVALID_CASES) {
    test(`rejeita: ${c.label}`, async ({ page }) => {
      await page.goto(`/__test/cnpj-form?initial=${encodeURIComponent(c.initial)}`, {
        waitUntil: 'domcontentloaded',
      });
      await page.getByTestId('cnpj-harness-ready').waitFor();

      await page.getByTestId('cnpj-submit').click();

      const error = page.getByTestId('cnpj-error');
      await expect(error).toBeVisible();
      await expect(error).toContainText(c.errorRegex);

      // Payload NÃO deve ser persistido.
      await expect(page.getByTestId('cnpj-saved-payload')).toHaveCount(0);
      const payload = await page.evaluate(() => window.__lastCnpjPayload);
      // Payload pode ter ficado de um teste anterior? Não: cada page é isolada.
      expect(payload).toBeUndefined();
    });
  }

  test('mensagem de erro é limpa ao corrigir para CNPJ válido', async ({ page }) => {
    await page.goto('/__test/cnpj-form?initial=02931668000100', {
      waitUntil: 'domcontentloaded',
    });
    await page.getByTestId('cnpj-harness-ready').waitFor();

    await page.getByTestId('cnpj-submit').click();
    await expect(page.getByTestId('cnpj-error')).toBeVisible();

    // Corrige para CNPJ válido.
    await page.getByTestId('cnpj-input').fill('02.931.668/0001-88');
    await page.getByTestId('cnpj-submit').click();

    await expect(page.getByTestId('cnpj-error')).toHaveCount(0);
    await expect(page.getByTestId('cnpj-saved-payload')).toBeVisible();
    await expect(page.getByTestId('cnpj-saved-payload')).toHaveAttribute(
      'data-cnpj-persisted',
      '02931668000188',
    );
  });
});
