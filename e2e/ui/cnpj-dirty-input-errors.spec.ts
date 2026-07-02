/**
 * E2E: CNPJs com espaços, traços e caracteres extras que, após normalizar,
 * NÃO formam um CNPJ válido — devem exibir mensagem inline e NÃO persistir.
 *
 * Cobre o mesmo SSOT usado em fornecedor (SupplierFormDialog +
 * useSuppliersManager) e produto (BasicDataTab + useNewSupplierForm).
 *
 * Também intercepta a rede: nenhum POST/PATCH/PUT com `cnpj` pode sair.
 */
import { test, expect } from '@playwright/test';

interface DirtyCase {
  label: string;
  initial: string;
  errorRegex: RegExp;
}

// Todos os casos abaixo têm caracteres "sujos" (espaços/traços/letras/símbolos)
// E, após normalizar, resultam em CNPJ inválido — logo, devem falhar inline.
const DIRTY_INVALID: DirtyCase[] = [
  { label: 'espaços + poucos dígitos', input: '  02 931 668 000  ', errorRegex: /14 d[ií]gitos/i } as never,
  { label: 'traços + poucos dígitos', input: '02-931-668-000', errorRegex: /14 d[ií]gitos/i } as never,
  { label: 'letras + poucos dígitos', input: '02.abc.668/0001', errorRegex: /14 d[ií]gitos/i } as never,
  { label: 'símbolos + poucos dígitos', input: '02@931#668$0001', errorRegex: /14 d[ií]gitos/i } as never,
  { label: 'mascarado com DV errado', input: '02.931.668/0001-00', errorRegex: /inv[aá]lido/i } as never,
  { label: 'traços com todos-iguais', input: '11-11-11-11-11-11-11', errorRegex: /inv[aá]lido/i } as never,
  { label: 'NBSP + poucos dígitos', input: '02.931.668/00\u00A001', errorRegex: /14 d[ií]gitos/i } as never,
].map((c) => ({ label: c.label, initial: (c as { input: string }).input, errorRegex: (c as { errorRegex: RegExp }).errorRegex }));

for (const c of DIRTY_INVALID) {
  test(`CNPJ sujo inválido — ${c.label} → erro inline + nada persistido`, async ({
    page,
  }) => {
    const mutationBodies: string[] = [];
    await page.route('**/*', async (route) => {
      const req = route.request();
      if (['POST', 'PATCH', 'PUT'].includes(req.method())) {
        const body = req.postData();
        if (body && /cnpj/i.test(body)) mutationBodies.push(body);
      }
      await route.continue();
    });

    await page.goto(
      `/__test/cnpj-form?initial=${encodeURIComponent(c.initial)}`,
      { waitUntil: 'domcontentloaded' },
    );
    await page.getByTestId('cnpj-harness-ready').waitFor();
    await page.getByTestId('cnpj-submit').click();

    await expect(page.getByTestId('cnpj-error')).toBeVisible();
    await expect(page.getByTestId('cnpj-error')).toContainText(c.errorRegex);
    await expect(page.getByTestId('cnpj-saved-payload')).toHaveCount(0);

    const payload = await page.evaluate(() => window.__lastCnpjPayload);
    expect(payload).toBeUndefined();

    // Nenhuma mutação real deve ter saído com máscara nem com o input sujo.
    for (const body of mutationBodies) {
      expect(body).not.toMatch(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
      expect(body, 'nenhuma mutação deve sair para CNPJ inválido').toBe('');
    }
  });
}
