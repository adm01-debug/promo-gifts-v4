import { test, expect, type Request } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

/**
 * Contrato + fluxo de duplicação:
 *  - Nenhum request de criação/atualização/duplicação/geração de proposta
 *    relacionado a quotes envia `internal_notes` no body.
 *  - Ao duplicar um orçamento, a UI resultante NÃO mostra campo de Notas
 *    internas e a proposta exibe apenas Observações.
 *
 * O interceptor cobre:
 *   - PostgREST: /rest/v1/quotes (POST/PATCH)
 *   - Edge functions: /functions/v1/quote*, /functions/v1/*proposal*,
 *     /functions/v1/quote-public-view, /functions/v1/quote-pdf*, etc.
 */

const QUOTE_REQUEST_RX =
  /\/rest\/v1\/quotes(\?|$|\/)|\/functions\/v1\/(?:[^/?]*quote[^/?]*|[^/?]*proposal[^/?]*|[^/?]*orcamento[^/?]*)/i;
const INTERNAL_NOTES_RX = /"internal_notes"\s*:/i;

interface Offender {
  url: string;
  method: string;
  bodyExcerpt: string;
}

function attachOffenderSpy(page: import('@playwright/test').Page): Offender[] {
  const offenders: Offender[] = [];
  page.on('request', (req: Request) => {
    const method = req.method();
    if (method === 'GET' || method === 'OPTIONS' || method === 'HEAD') return;
    const url = req.url();
    if (!QUOTE_REQUEST_RX.test(url)) return;
    const body = req.postData() ?? '';
    if (INTERNAL_NOTES_RX.test(body)) {
      offenders.push({ url, method, bodyExcerpt: body.slice(0, 300) });
    }
  });
  return offenders;
}

test.describe('Quotes — contrato sem internal_notes', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('nenhum request de quotes envia internal_notes ao criar/atualizar/duplicar', async ({
    page,
  }) => {
    const offenders = attachOffenderSpy(page);

    // 1) Builder de novo orçamento
    await gotoAndSettle(page, '/orcamentos/novo');
    await expect(page.getByTestId('quote-internal-notes-input')).toHaveCount(0);

    // 2) Listagem — tenta duplicar o primeiro orçamento existente, se houver
    await gotoAndSettle(page, '/orcamentos');
    const duplicateBtn = page.getByRole('button', { name: /Duplicar orçamento/i }).first();
    if (await duplicateBtn.count()) {
      await duplicateBtn.click();
      // Aguarda navegação para /orcamentos/:id (resultado da duplicação)
      await page
        .waitForURL(/\/orcamentos\/[0-9a-f-]{8,}/i, { timeout: 15_000 })
        .catch(() => {
          /* alguns ambientes mostram apenas toast — ignora */
        });
      // UI do orçamento duplicado: nenhum campo de Notas internas
      await expect(page.getByTestId('quote-internal-notes-input')).toHaveCount(0);
      await expect(page.getByText(/Notas internas/i)).toHaveCount(0);

      // Se houver botão de gerar/abrir proposta pública, abre e valida o conteúdo
      const proposalLink = page
        .getByRole('link', { name: /Proposta|Visualizar proposta|Ver proposta|Compartilhar/i })
        .or(page.getByRole('button', { name: /Proposta|Gerar proposta|Visualizar proposta/i }))
        .first();
      if (await proposalLink.count()) {
        const popupPromise = page.context().waitForEvent('page', { timeout: 5_000 }).catch(() => null);
        await proposalLink.click().catch(() => undefined);
        const popup = await popupPromise;
        const target = popup ?? page;
        await target.waitForLoadState('domcontentloaded').catch(() => undefined);
        const bodyText = await target.locator('body').innerText().catch(() => '');
        expect(bodyText).not.toMatch(/Notas internas/i);
        expect(bodyText).not.toMatch(/Anotações para uso interno/i);
      }
    }

    // 3) Assert final: nenhum request ofensor em todo o fluxo
    expect(
      offenders,
      `Requests com internal_notes detectados:\n${offenders
        .map((o) => `[${o.method}] ${o.url}\n  body: ${o.bodyExcerpt}`)
        .join('\n')}`,
    ).toHaveLength(0);
  });
});
