/**
 * E2E: alternância A→B→A→C com mutações de itens em paralelo.
 *
 * Diferente do `active-cart-parallel-actions.spec.ts` (que só injetava
 * latência de GET), aqui simulamos MUTAÇÕES concorrentes:
 *   - remoção de item de um cart durante a troca
 *   - atualização de quantidade de outro cart durante a troca
 *
 * Objetivo: garantir que respostas de PATCH/DELETE tardias vindas do cart
 * anterior nunca "vazem" para o header/sidebar do cart ativo.
 *
 * Executa em DOIS viewports (desktop 1280×720 e mobile 390×844) — o layout
 * responsivo do header/sidebar difere entre eles e queremos garantir o
 * invariant em ambos.
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import {
  installFailureCapture,
  recordCarts,
  recordItems,
  recordMutation,
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

async function collectItemIds(page: Page): Promise<string[]> {
  const items = page.locator('[data-testid^="cart-item-"]');
  const count = await items.count().catch(() => 0);
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const tid = await items.nth(i).getAttribute('data-testid');
    if (tid) ids.push(tid.replace('cart-item-', ''));
  }
  return ids;
}

async function snapshotHeader(page: Page) {
  const title = (await page.getByTestId('page-title-carrinhos').innerText()).trim();
  const meta = page
    .getByTestId('page-title-carrinhos')
    .locator('..')
    .locator('p')
    .first();
  await expect(meta).toBeVisible();
  return { title, meta: norm(await meta.innerText()) };
}

const VIEWPORTS = [
  { name: 'desktop', size: { width: 1280, height: 720 } },
  { name: 'mobile', size: { width: 390, height: 844 } },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`Carrinhos · A→B→A→C · mutações paralelas · ${vp.name} @carrinhos`, () => {
    test.use({ viewport: vp.size });

    test('DELETE/PATCH tardios nunca vazam para o header/sidebar do cart ativo', async ({
      page,
    }, testInfo) => {
      setDebugContext(testInfo, { viewport: vp.name, viewportSize: vp.size });

      await loginAs(page, 'seller');
      await gotoAndSettle(page, '/carrinhos');

      const ids = await collectCartIds(page);
      if (ids.length < 3) test.skip(true, 'precisa de 3+ carrinhos');
      const [A, B, C] = ids;

      setDebugContext(testInfo, { cartA: A, cartB: B, cartC: C });

      recordCarts(testInfo, { A, B, C });

      // Snapshot canônico de cada cart (sem interferência).
      await gotoAndSettle(page, `/carrinhos/${A}`);
      const itemsA = await collectItemIds(page);
      recordItems(testInfo, 'A', itemsA);
      const canonA = await snapshotHeader(page);
      await gotoAndSettle(page, `/carrinhos/${B}`);
      const itemsB = await collectItemIds(page);
      recordItems(testInfo, 'B', itemsB);
      const canonB = await snapshotHeader(page);
      await gotoAndSettle(page, `/carrinhos/${C}`);
      const itemsC = await collectItemIds(page);
      recordItems(testInfo, 'C', itemsC);
      const canonC = await snapshotHeader(page);

      setDebugContext(testInfo, { canonA, canonB, canonC });

      // Rastreia mutações PATCH/DELETE contra cart_items e adia respostas para
      // simular resposta lenta do backend chegando após a próxima navegação.
      const observed: Array<{ method: string; url: string; delayed: boolean }> = [];
      await page.route('**/rest/v1/cart_items**', async (route) => {
        const req = route.request();
        const method = req.method();
        if (method === 'DELETE' || method === 'PATCH' || method === 'POST') {
          observed.push({ method, url: req.url(), delayed: true });
          recordMutation(testInfo, { method, url: req.url(), note: 'delayed 400ms' });
          await new Promise((r) => setTimeout(r, 400));
        }
        await route.continue();
      });
      await page.route('**/rest/v1/seller_carts**', async (route) => {
        if (route.request().method() === 'GET') {
          await new Promise((r) => setTimeout(r, 120));
        }
        await route.continue();
      });

      // ── Sequência A→B→A→C intercalada com mutações ────────────────────
      const labelOf = (id: string) => (id === A ? 'A' : id === B ? 'B' : 'C');
      const nav = async (id: string) => {
        recordNav(testInfo, `${labelOf(id)}:${id}`);
        await page.goto(`/carrinhos/${id}`);
      };

      await nav(A);
      await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

      recordMutation(testInfo, { method: 'PATCH', cart: 'A', note: 'in-page fetch' });
      recordMutation(testInfo, { method: 'DELETE', cart: 'A', note: 'in-page fetch' });
      void page.evaluate((cartId) => {
        fetch(`/rest/v1/cart_items?cart_id=eq.${cartId}`, { method: 'PATCH' }).catch(() => {});
        fetch(`/rest/v1/cart_items?cart_id=eq.${cartId}`, { method: 'DELETE' }).catch(() => {});
      }, A);

      await nav(B);
      recordMutation(testInfo, { method: 'PATCH', cart: 'B', note: 'in-page fetch' });
      void page.evaluate((cartId) => {
        fetch(`/rest/v1/cart_items?cart_id=eq.${cartId}`, { method: 'PATCH' }).catch(() => {});
      }, B);

      await nav(A);
      await nav(C);

      await expect(page).toHaveURL(new RegExp(`/carrinhos/${C}$`));
      await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

      setDebugContext(testInfo, { observedMutationsCount: observed.length });

      expect(observed.length).toBeGreaterThanOrEqual(1);

      const final = await snapshotHeader(page);
      setDebugContext(testInfo, { finalHeader: final });

      expect(final.meta).toMatch(META_RE);
      expect(final.title).toBe(canonC.title);
      expect(final.meta).toBe(canonC.meta);

      if (canonA.meta !== canonC.meta) expect(final.meta).not.toBe(canonA.meta);
      if (canonB.meta !== canonC.meta) expect(final.meta).not.toBe(canonB.meta);

      const sidebarCount = await page.getByTestId('cart-sidebar-hero').count();
      if (sidebarCount > 0) {
        await expect(page.getByTestId('cart-checkout-cta')).toBeVisible();
      }
    });
  });
}
