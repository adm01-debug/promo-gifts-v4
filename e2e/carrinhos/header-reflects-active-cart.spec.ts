/**
 * E2E: ao alternar de carrinho, o cabeçalho do carrinho ativo troca
 * corretamente o nome da empresa e, quando disponível, o CNPJ mascarado
 * — substitui a asserção antiga sobre ramo de atividade + "Atualizado há…".
 *
 * O cabeçalho antigo (page-title-carrinhos) foi removido; a âncora agora é
 * `active-cart-header` (Card do carrinho ativo).
 *
 * Cobre 4 cenários:
 *  - Troca de carrinho reflete no header.
 *  - Listagem exibe CNPJ mascarado quando disponível.
 *  - Placeholder "CNPJ não informado" aparece quando o CRM devolve null.
 *  - Layout do Card mantém integridade quando o subheader está ausente
 *    (altura, alinhamento vertical entre logo/nome/CNPJ e toggle de status).
 */
import { test, expect, type Route } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import {
  installFailureCapture,
  recordCarts,
  recordNav,
  setDebugContext,
} from '../helpers/attach-on-failure';

installFailureCapture(test);

// CNPJ mascarado: 00.000.000/0000-00
const CNPJ_MASK_RE = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;
const CNPJ_PLACEHOLDER = 'CNPJ não informado';

/**
 * Mocka o edge function crm-db-bridge para forçar respostas onde a empresa
 * NÃO tem CNPJ. Reutilizável entre testes.
 */
async function mockCrmWithoutCnpj(page: import('@playwright/test').Page) {
  await page.route('**/functions/v1/crm-db-bridge*', async (route: Route) => {
    const req = route.request();
    // Só interceptamos POSTs (select/select-by-id). GETs raros passam direto.
    if (req.method() !== 'POST') return route.continue();
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(req.postData() ?? '{}');
    } catch {
      /* body malformado — deixa o handler original responder */
    }
    // Para companies devolvemos sempre cnpj: null; para outras tabelas
    // deixamos o comportamento default (continue) para não quebrar o app.
    if (body.table === 'companies') {
      const stub = {
        id: (body.id as string) ?? 'stub-id',
        razao_social: 'Empresa Sem CNPJ (E2E stub)',
        nome_fantasia: 'Empresa Sem CNPJ',
        ramo_atividade: null,
        logo_url: null,
        cnpj: null,
      };
      const payload =
        body.operation === 'select_by_id'
          ? { data: stub }
          : { data: [stub] };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(payload),
      });
    }
    return route.continue();
  });
}

test.describe('Carrinhos · cabeçalho reflete carrinho ativo @carrinhos', () => {
  test('troca nome da empresa (e CNPJ, quando disponível) ao alternar de carrinho', async ({
    page,
  }, testInfo) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/carrinhos');

    const rows = page.locator('[data-testid^="cart-row-"]').filter({
      hasNot: page.locator('[data-testid^="cart-row-open-"]'),
    });
    const total = await rows.count();
    if (total < 2) {
      test.skip(true, 'precisa de ao menos 2 carrinhos para validar alternância');
    }

    const ids: string[] = [];
    for (let i = 0; i < Math.min(total, 2); i++) {
      const tid = await rows.nth(i).getAttribute('data-testid');
      const id = tid?.replace('cart-row-', '');
      if (id) ids.push(id);
    }
    expect(ids.length).toBe(2);
    recordCarts(testInfo, { A: ids[0], B: ids[1] });

    const readHeader = async () => {
      await expect(page.getByTestId('active-cart-header')).toBeVisible();
      const name = (await page.getByTestId('active-cart-company-name').innerText()).trim();
      const cnpjSpan = page.getByTestId('active-cart-cnpj');
      const state = (await cnpjSpan.count()) > 0
        ? await cnpjSpan.getAttribute('data-cnpj-state')
        : null;
      const cnpj = (await cnpjSpan.count()) > 0
        ? (await cnpjSpan.innerText()).trim()
        : null;
      return { name, cnpj, state };
    };

    // Abre carrinho A
    recordNav(testInfo, `A:${ids[0]}`);
    await gotoAndSettle(page, `/carrinhos/${ids[0]}`);
    await expect(page).toHaveURL(new RegExp(`/carrinhos/${ids[0]}`));
    const a = await readHeader();
    setDebugContext(testInfo, { headerA: a });

    // O cabeçalho NÃO deve mais exibir textos legados (ramo/atualizado há).
    const headerText = (await page.getByTestId('active-cart-header').innerText()).toLowerCase();
    expect(headerText).not.toMatch(/atualizado há/);
    expect(headerText).not.toContain('energia solar');

    // Quando o estado é "present", a máscara deve bater; quando é "missing",
    // deve exibir exatamente o placeholder canônico.
    if (a.state === 'present') expect(a.cnpj).toMatch(CNPJ_MASK_RE);
    if (a.state === 'missing') expect(a.cnpj).toBe(CNPJ_PLACEHOLDER);

    // Abre carrinho B
    recordNav(testInfo, `B:${ids[1]}`);
    await gotoAndSettle(page, `/carrinhos/${ids[1]}`);
    await expect(page).toHaveURL(new RegExp(`/carrinhos/${ids[1]}`));
    const b = await readHeader();
    setDebugContext(testInfo, { headerB: b });
    if (b.state === 'present') expect(b.cnpj).toMatch(CNPJ_MASK_RE);
    if (b.state === 'missing') expect(b.cnpj).toBe(CNPJ_PLACEHOLDER);

    // Nome da empresa OU CNPJ DEVE mudar entre carrinhos distintos.
    expect(a.name !== b.name || a.cnpj !== b.cnpj).toBeTruthy();
  });

  test('listagem exibe CNPJ mascarado quando disponível @carrinhos', async ({ page }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/carrinhos');

    const cnpjCells = page.locator('[data-testid^="cart-row-cnpj-"]');
    const count = await cnpjCells.count();
    if (count === 0) {
      test.skip(true, 'nenhum carrinho listado com CNPJ do CRM disponível');
    }

    // Toda célula renderizada deve seguir a máscara canônica.
    for (let i = 0; i < Math.min(count, 5); i++) {
      const txt = (await cnpjCells.nth(i).innerText()).trim();
      expect(txt).toMatch(CNPJ_MASK_RE);
    }
  });

  test('placeholder "CNPJ não informado" quando CRM devolve null @carrinhos', async ({ page }) => {
    await loginAs(page, 'seller');
    await mockCrmWithoutCnpj(page);
    await gotoAndSettle(page, '/carrinhos');

    const rows = page.locator('[data-testid^="cart-row-"]').filter({
      hasNot: page.locator('[data-testid^="cart-row-open-"]'),
    });
    if ((await rows.count()) === 0) {
      test.skip(true, 'nenhum carrinho disponível para inspecionar o header');
    }

    const firstTid = await rows.first().getAttribute('data-testid');
    const id = firstTid?.replace('cart-row-', '');
    expect(id).toBeTruthy();
    await gotoAndSettle(page, `/carrinhos/${id}`);

    const cnpjSpan = page.getByTestId('active-cart-cnpj');
    await expect(cnpjSpan).toBeVisible();
    await expect(cnpjSpan).toHaveAttribute('data-cnpj-state', 'missing');
    await expect(cnpjSpan).toHaveText(CNPJ_PLACEHOLDER);
  });

  test('layout do header permanece íntegro sem CNPJ do CRM @carrinhos', async ({ page }) => {
    await loginAs(page, 'seller');
    await mockCrmWithoutCnpj(page);
    await gotoAndSettle(page, '/carrinhos');

    const rows = page.locator('[data-testid^="cart-row-"]').filter({
      hasNot: page.locator('[data-testid^="cart-row-open-"]'),
    });
    if ((await rows.count()) === 0) {
      test.skip(true, 'nenhum carrinho disponível para validar layout');
    }
    const firstTid = await rows.first().getAttribute('data-testid');
    const id = firstTid?.replace('cart-row-', '');
    await gotoAndSettle(page, `/carrinhos/${id}`);

    const card = page.getByTestId('active-cart-header');
    const toggle = page.locator('[role="radiogroup"][aria-label="Status do carrinho"]').first();

    await expect(card).toBeVisible();
    await expect(toggle).toBeVisible();

    // Card conserva altura mínima razoável (mesmo sem o CNPJ, o Card mantém
    // p-4 + h2 + logo 48px). Definimos um piso conservador de 64px para
    // detectar colapso do flexbox.
    const cardBox = await card.boundingBox();
    expect(cardBox).not.toBeNull();
    expect(cardBox!.height).toBeGreaterThanOrEqual(64);

    // Toggle e h2 permanecem verticalmente centralizados dentro do Card:
    // a diferença entre o centro vertical de cada um e o centro do Card
    // não deve ultrapassar 40% da altura do Card (tolerância folgada,
    // que ainda falha se algum item cair para fora do flex row).
    const titleBox = await page.getByTestId('active-cart-company-name').boundingBox();
    const toggleBox = await toggle.boundingBox();
    expect(titleBox).not.toBeNull();
    expect(toggleBox).not.toBeNull();

    const cardCenterY = cardBox!.y + cardBox!.height / 2;
    const titleCenterY = titleBox!.y + titleBox!.height / 2;
    const toggleCenterY = toggleBox!.y + toggleBox!.height / 2;
    const tolerance = cardBox!.height * 0.4;

    expect(Math.abs(titleCenterY - cardCenterY)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(toggleCenterY - cardCenterY)).toBeLessThanOrEqual(tolerance);

    // O subheader existe (placeholder) e permanece dentro dos limites do Card.
    const cnpjSpan = page.getByTestId('active-cart-cnpj');
    const cnpjBox = await cnpjSpan.boundingBox();
    expect(cnpjBox).not.toBeNull();
    expect(cnpjBox!.y).toBeGreaterThanOrEqual(cardBox!.y - 1);
    expect(cnpjBox!.y + cnpjBox!.height).toBeLessThanOrEqual(cardBox!.y + cardBox!.height + 1);
  });
});
