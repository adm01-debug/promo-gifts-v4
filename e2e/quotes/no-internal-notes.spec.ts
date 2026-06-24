import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

/**
 * Garante que o campo "Notas internas" foi totalmente removido:
 *  - Não aparece na UI do builder.
 *  - Nenhuma request enviada ao backend inclui `internal_notes` no payload.
 */
test.describe('Quote builder — sem Notas internas', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('UI não mostra "Notas internas" e não envia internal_notes no payload', async ({
    page,
  }) => {
    const offendingRequests: Array<{ url: string; body: string }> = [];

    page.on('request', (req) => {
      const method = req.method();
      if (method === 'GET' || method === 'OPTIONS') return;
      const url = req.url();
      if (!/\/rest\/v1\/quotes|\/functions\/v1\/(?:.*quote)/.test(url)) return;
      const body = req.postData() ?? '';
      if (/"internal_notes"\s*:/i.test(body)) {
        offendingRequests.push({ url, body });
      }
    });

    await gotoAndSettle(page, '/orcamentos/novo');

    // UI: nenhum elemento de Notas internas visível
    await expect(page.getByTestId('quote-internal-notes-input')).toHaveCount(0);
    await expect(page.getByText(/Notas internas/i)).toHaveCount(0);
    await expect(
      page.getByPlaceholder(/Anotações para uso interno/i),
    ).toHaveCount(0);

    // Sanity: o campo de Observações continua existindo
    await expect(
      page
        .getByPlaceholder(/observa/i)
        .or(page.getByText(/Observações/i))
        .first(),
    ).toBeVisible();

    // Nenhum request residual incluindo internal_notes
    expect(
      offendingRequests,
      `Requests com internal_notes detectados:\n${offendingRequests
        .map((r) => `${r.url} → ${r.body.slice(0, 200)}`)
        .join('\n')}`,
    ).toHaveLength(0);
  });
});
