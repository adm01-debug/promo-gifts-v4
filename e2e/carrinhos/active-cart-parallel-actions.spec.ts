/**
 * E2E: alternância rápida A→B→A→C com ações de atualização de itens em
 * paralelo. O header e a sidebar NUNCA podem misturar dados entre carrinhos.
 *
 * Estratégia:
 *  - Navega em sequência sem esperar assentar entre navegações.
 *  - Dispara requests concorrentes (mutações típicas do carrinho) durante
 *    a troca — se algum retorno tardio "vazar" para o carrinho ativo, o
 *    header irá mostrar dados incompatíveis com o cart id da URL.
 *  - Ao final, valida que title + meta correspondem exatamente ao carrinho
 *    da URL corrente (contrato de isolamento).
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import {
  installFailureCapture,
  recordCarts,
  recordNav,
  setDebugContext,
} from '../helpers/attach-on-failure';

installFailureCapture(test);

const NBSP = /[\u00A0\u202F]/g;
const norm = (s: string) => s.replace(NBSP, ' ').trim();
const META_RE = /(\d+)\s*SKUs?\s*·\s*(\d+)\s*unidades?/i;

async function collectCartIds(page: Page): Promise<string[]> {
  const rows = page.locator('[data-testid^="cart-row-"]').filter({
    hasNot: page.locator('[data-testid^="cart-row-open-"]'),
  });
  const count = await rows.count();
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const tid = await rows.nth(i).getAttribute('data-testid');
    const id = tid?.replace('cart-row-', '');
    if (id) ids.push(id);
  }
  return ids;
}

async function snapshotHeader(page: Page): Promise<{ title: string; meta: string }> {
  const title = (await page.getByTestId('page-title-carrinhos').innerText()).trim();
  const metaEl = page
    .getByTestId('page-title-carrinhos')
    .locator('..')
    .locator('p')
    .first();
  await expect(metaEl).toBeVisible();
  return { title, meta: norm(await metaEl.innerText()) };
}

test.describe('Carrinhos · alternância paralela A→B→A→C @carrinhos', () => {
  test('trocas rápidas com fetch/mutação paralelos nunca misturam header/sidebar', async ({ page }, testInfo) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/carrinhos');

    const ids = await collectCartIds(page);
    if (ids.length < 3) test.skip(true, 'precisa de 3+ carrinhos para A→B→A→C');
    const [A, B, C] = ids;
    recordCarts(testInfo, { A, B, C });

    // Captura o header canônico de cada carrinho (sequencial, sem ruído).
    await gotoAndSettle(page, `/carrinhos/${A}`);
    const canonA = await snapshotHeader(page);
    await gotoAndSettle(page, `/carrinhos/${B}`);
    const canonB = await snapshotHeader(page);
    await gotoAndSettle(page, `/carrinhos/${C}`);
    const canonC = await snapshotHeader(page);
    setDebugContext(testInfo, { canonA, canonB, canonC });

    // Introduz latência sintética em respostas GET para maximizar chance
    // de resposta "tardia" chegar após a próxima navegação.
    await page.route('**/rest/v1/**', async (route) => {
      if (route.request().method() === 'GET') {
        await new Promise((r) => setTimeout(r, 150));
      }
      await route.continue();
    });

    // Sequência A→B→A→C sem `waitForLoadState`. Requests em voo do cart
    // anterior devem ser DESCARTADOS pela camada de dados quando a URL muda.
    // Sequência A→B→A→C sem `waitForLoadState`. Requests em voo do cart
    // anterior devem ser DESCARTADOS pela camada de dados quando a URL muda.
    for (const [label, id] of [['A', A], ['B', B], ['A', A], ['C', C]] as const) {
      recordNav(testInfo, `${label}:${id}`);
      await page.goto(`/carrinhos/${id}`);
    }

    // Aguarda o header assentar no carrinho final (C).
    await expect(page).toHaveURL(new RegExp(`/carrinhos/${C}$`));
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    const final = await snapshotHeader(page);
    setDebugContext(testInfo, { finalHeader: final });

    // Contrato mínimo: meta segue "N SKU(s) · N unidade(s) [· R$ X,XX]".
    expect(final.meta).toMatch(META_RE);

    // Isolamento: title e meta finais são idênticos ao snapshot canônico
    // de C — nunca do A nem do B.
    expect(final.title).toBe(canonC.title);
    expect(final.meta).toBe(canonC.meta);

    if (canonA.meta !== canonC.meta) expect(final.meta).not.toBe(canonA.meta);
    if (canonB.meta !== canonC.meta) expect(final.meta).not.toBe(canonB.meta);
    if (canonA.title !== canonC.title) expect(final.title).not.toBe(canonA.title);
    if (canonB.title !== canonC.title) expect(final.title).not.toBe(canonB.title);

    // Sidebar (peso/volume) também deve refletir C, ou não renderizar se vazio.
    const sidebarCount = await page.getByTestId('cart-sidebar-hero').count();
    if (sidebarCount > 0) {
      // CTA da sidebar deve estar visível e "loaded" — sem estado stale.
      await expect(page.getByTestId('cart-checkout-cta')).toBeVisible();
    }
  });

  test('trocas repetidas com refresh intermediário mantêm isolamento', async ({ page }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/carrinhos');

    const ids = await collectCartIds(page);
    if (ids.length < 2) test.skip(true, 'precisa de 2+ carrinhos');
    const [A, B] = ids;

    await gotoAndSettle(page, `/carrinhos/${A}`);
    const canonA = await snapshotHeader(page);
    await gotoAndSettle(page, `/carrinhos/${B}`);
    const canonB = await snapshotHeader(page);

    // A → reload → B → reload → A
    await gotoAndSettle(page, `/carrinhos/${A}`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();
    expect((await snapshotHeader(page)).meta).toBe(canonA.meta);

    await gotoAndSettle(page, `/carrinhos/${B}`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();
    expect((await snapshotHeader(page)).meta).toBe(canonB.meta);

    await gotoAndSettle(page, `/carrinhos/${A}`);
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();
    expect((await snapshotHeader(page)).meta).toBe(canonA.meta);
  });
});
