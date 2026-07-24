/**
 * E2E matrix consolidado — 20 inputs × harness /__test/cnpj-form.
 * Cobre criar + editar (via ?initial=) num único spec.
 * Também intercepta o "salvar" para provar que o payload em
 * window.__lastCnpjPayload é sempre dígitos-only (ou null).
 */
import { test, expect } from '@playwright/test';

interface Row {
  label: string;
  input: string;
  ok: boolean;
  expected?: string;
  errRe?: RegExp;
}

const MATRIX: Row[] = [
  { label: 'mascarado canônico', input: '02.931.668/0001-88', ok: true, expected: '02931668000188' },
  { label: 'dígitos-only', input: '02931668000188', ok: true, expected: '02931668000188' },
  { label: 'com espaços', input: '02 931 668 0001 88', ok: true, expected: '02931668000188' },
  { label: 'com traços', input: '02-931-668-0001-88', ok: true, expected: '02931668000188' },
  { label: 'com letras', input: '02.931.668/0001-88X', ok: true, expected: '02931668000188' },
  { label: 'com NBSP', input: '02.931.668/0001-88\u00A0', ok: true, expected: '02931668000188' },
  { label: 'zero-width', input: '02\u200D.931.668/0001-88', ok: true, expected: '02931668000188' },
  { label: 'CNPJ válido 2', input: '11.222.333/0001-81', ok: true, expected: '11222333000181' },
  { label: 'DV inválido', input: '02931668000100', ok: false, errRe: /inv[aá]lido/i },
  { label: 'menos de 14', input: '02931668000', ok: false, errRe: /14 d[ií]gitos/i },
  { label: 'todos-iguais', input: '11111111111111', ok: false, errRe: /inv[aá]lido/i },
  { label: 'só letras', input: 'ABCDEFGHIJKLMN', ok: false, errRe: /14 d[ií]gitos/i },
  { label: 'string espaços', input: '     ', ok: false, errRe: /14 d[ií]gitos/i },
];

for (const row of MATRIX) {
  test(`CNPJ matrix — ${row.label}`, async ({ page }) => {
    // Interceptação de rede: qualquer POST/PATCH que carregue cnpj
    // NÃO pode conter máscara. Registramos requests para inspeção.
    const seenBodies: string[] = [];
    await page.route('**/*', async (route) => {
      const req = route.request();
      if (['POST', 'PATCH', 'PUT'].includes(req.method())) {
        const body = req.postData();
        if (body && /cnpj/i.test(body)) seenBodies.push(body);
      }
      await route.continue();
    });

    await page.goto(`/__test/cnpj-form?initial=${encodeURIComponent(row.input)}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.getByTestId('cnpj-harness-ready').waitFor();
    await page.getByTestId('cnpj-submit').click();

    if (row.ok) {
      const saved = page.getByTestId('cnpj-saved-payload');
      await expect(saved).toBeVisible();
      await expect(saved).toHaveAttribute('data-cnpj-persisted', row.expected!);
      await expect(saved).toHaveAttribute('data-cnpj-digits-only', 'true');
      const payload = await page.evaluate(() => window.__lastCnpjPayload);
      expect(payload?.cnpj).toBe(row.expected);
      expect(/^\d{14}$/.test(payload?.cnpj ?? '')).toBe(true);
    } else {
      await expect(page.getByTestId('cnpj-error')).toBeVisible();
      await expect(page.getByTestId('cnpj-error')).toContainText(row.errRe!);
      await expect(page.getByTestId('cnpj-saved-payload')).toHaveCount(0);
    }

    // Nenhum body de mutação real deve conter máscara
    for (const b of seenBodies) {
      expect(b, `payload contém máscara: ${b}`).not.toMatch(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
    }
  });
}
