/**
 * E2E — Diferenciação clara do subtítulo:
 *   Novo · Editar Rascunho · Editar Proposta · <status>
 *
 * Não cria dados reais — usa o título h1 + subtítulo para validar copy.
 * Para os modos de edição, depende da existência prévia de pelo menos um
 * rascunho e uma proposta enviada; se não houver, o caso é skip.
 */
import { test, expect } from '../fixtures/test-base';
import { requireAuth } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';

test.describe('Quote subtítulo · diferenciação Novo/Rascunho/Enviada', () => {
  test.skip(
    ({ page: _page }, testInfo) => testInfo.project.name !== 'chromium-authed',
    'Requer auth real.',
  );
  test.beforeEach(() => requireAuth());

  test('modo Novo → h1 "Novo Orçamento" + subtítulo de prévia/fallback', async ({ page }) => {
    await gotoAndSettle(page, '/orcamentos/novo');
    const h1 = page.getByTestId('page-title-orcamento-novo');
    await expect(h1).toHaveText(/Novo Orçamento/);
    const sub = page.getByTestId('quote-number-display');
    await expect(sub).toBeVisible();
    await expect(sub).toContainText(/(Próx\.|Nº a ser gerado ao salvar)/);
  });

  test('modo Editar (rascunho ou enviada) → h1 reflete status + subtítulo com Nº NNNNN/YY · status', async ({
    page,
  }) => {
    await gotoAndSettle(page, '/orcamentos');
    // Pega o primeiro link de orçamento da listagem (qualquer status).
    const firstLink = page.locator('a[href^="/orcamentos/"][href$="/editar"], a[href*="/orcamentos/"]:not([href$="/novo"])').first();
    if ((await firstLink.count()) === 0) test.skip(true, 'Sem orçamentos para validar modo edição.');
    await firstLink.click();

    const h1 = page.getByTestId('page-title-orcamento-editar');
    await expect(h1).toBeVisible();
    const h1Text = (await h1.textContent())?.trim() ?? '';
    // Aceita "Editar Rascunho" OU "Editar Proposta · <status>" OU fallback "Editar Orçamento".
    expect(h1Text).toMatch(/Editar (Rascunho|Proposta · .+|Orçamento)/);

    const sub = page.getByTestId('quote-number-display');
    await expect(sub).toBeVisible();
    const subText = (await sub.textContent())?.trim() ?? '';
    // Em edição válida: "Nº NNNNN/YY · <Status>". Em edição sem número: "Nº indisponível".
    expect(subText).toMatch(/(Nº\s+\d{3,6}\/\d{2}(\s+·\s+\S+)?|Nº indisponível)/);
  });
});
