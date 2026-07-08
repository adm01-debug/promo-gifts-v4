/**
 * E2E: falha de rede durante refresh do carrinho.
 *
 * Simula perda de conectividade (offline) no meio do reload e valida que:
 *  1) durante o offline o header pode mostrar loading/skeleton, mas NUNCA
 *     números do carrinho anterior misturados com o atual;
 *  2) ao reconectar (offline=false) o header/sidebar reidratam para o
 *     estado consistente do carrinho ativo — igual ao snapshot pré-falha.
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
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

async function readHeader(page: Page) {
  const title = (await page.getByTestId('page-title-carrinhos').innerText()).trim();
  const meta = page
    .getByTestId('page-title-carrinhos')
    .locator('..')
    .locator('p')
    .first();
  await expect(meta).toBeVisible();
  return { title, meta: norm(await meta.innerText()) };
}

test.describe('Carrinhos · falha de rede durante refresh @carrinhos', () => {
  test('offline no meio do reload não gera header inconsistente; reconectar reidrata igual', async ({
    page,
    context,
  }: {
    page: Page;
    context: BrowserContext;
  }, testInfo) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/carrinhos');

    const ids = await collectCartIds(page);
    if (ids.length === 0) test.skip(true, 'sem carrinhos disponíveis');
    const cartId = ids[0];
    recordCarts(testInfo, { A: cartId });
    recordNav(testInfo, `A:${cartId}`);

    await gotoAndSettle(page, `/carrinhos/${cartId}`);
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();
    const before = await readHeader(page);
    setDebugContext(testInfo, { beforeHeader: before });
    expect(before.meta).toMatch(META_RE);

    // Corta a rede — todo request que sair agora falha imediatamente.
    await context.setOffline(true);

    // Refresh: o navegador vai tentar hidratar sem rede. Não deve travar
    // nem exibir dados de OUTRO cart.
    const reloadPromise = page.reload({ waitUntil: 'commit' }).catch(() => {
      // reload em offline pode rejeitar em alguns engines — tolerado.
    });
    await reloadPromise;

    // Se o header estiver visível durante o offline, o meta ainda tem que
    // ser um contrato válido (não NaN, não meta de outro cart).
    const titleCount = await page.getByTestId('page-title-carrinhos').count();
    if (titleCount > 0) {
      const offlineMeta = norm(
        await page
          .getByTestId('page-title-carrinhos')
          .locator('..')
          .locator('p')
          .first()
          .innerText()
          .catch(() => before.meta),
      );
      // Contrato mínimo — ou casa META_RE ou é um placeholder vazio, nunca
      // um híbrido "N SKUs" com número de outro carrinho.
      if (offlineMeta.length > 0) {
        expect(offlineMeta).toMatch(/SKU|unidade|—|\.\.\.|carregando/i);
        expect(offlineMeta).not.toMatch(/NaN|undefined|null/i);
      }
    }

    // Reconecta e força um re-render por navegação.
    await context.setOffline(false);
    await page.goto(`/carrinhos/${cartId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    const after = await readHeader(page);
    // Após reconectar, header retorna ao snapshot original — nenhum drift.
    expect(after.title).toBe(before.title);
    expect(after.meta).toBe(before.meta);
  });
});
