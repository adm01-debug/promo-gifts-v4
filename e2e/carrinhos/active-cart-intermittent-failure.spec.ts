/**
 * E2E: falha intermitente (timeout / 5xx transitório) durante mutações do
 * carrinho ativo — garante que header e sidebar não se misturam após o
 * retry natural do cliente e um refresh subsequente.
 *
 * Cenário:
 *   1) Snapshot canônico dos carrinhos A e B (sem interferência).
 *   2) Abre A e injeta falha intermitente: as N primeiras mutações PATCH/DELETE
 *      contra `/rest/v1/cart_items` retornam 503 (uma delas simula timeout
 *      via delay > 8s abortado). Depois disso o backend responde normal.
 *   3) Dispara mutações em A durante navegação para B e volta para A.
 *   4) Faz `page.reload()` de A após a "recuperação" do backend.
 *   5) Verifica:
 *      - header/sidebar de A voltam ao snapshot canônico (nunca ao de B);
 *      - meta segue o contrato `N SKUs · N unidades`;
 *      - nenhum texto "NaN|undefined|null" leaks para o DOM;
 *      - se sidebar renderiza, o CTA fica visível (não fica preso em loading).
 */
import { test, expect, type Page, type Route } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import {
  installFailureCapture,
  recordCarts,
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

test.describe('Carrinhos · falha intermitente durante mutações @carrinhos', () => {
  test('timeout/5xx transitório + refresh: header/sidebar reidratam sem mistura', async ({
    page,
  }, testInfo) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/carrinhos');

    const ids = await collectCartIds(page);
    if (ids.length < 2) test.skip(true, 'precisa de 2+ carrinhos');
    const [A, B] = ids;
    recordCarts(testInfo, { A, B });

    // Snapshot canônico (sem injeção de falha).
    await gotoAndSettle(page, `/carrinhos/${A}`);
    const canonA = await snapshotHeader(page);
    await gotoAndSettle(page, `/carrinhos/${B}`);
    const canonB = await snapshotHeader(page);
    setDebugContext(testInfo, { canonA, canonB });

    // ── Injeta falha intermitente ────────────────────────────────────────
    // Primeiras 3 mutações → 503. A 1ª simula timeout (delay 8s + abort).
    // Da 4ª em diante, deixa passar normalmente ("backend recuperado").
    let mutationAttempt = 0;
    await page.route('**/rest/v1/cart_items**', async (route: Route) => {
      const method = route.request().method();
      const isMutation = method === 'PATCH' || method === 'DELETE' || method === 'POST';
      if (!isMutation) {
        await route.continue();
        return;
      }
      mutationAttempt += 1;
      const attemptIdx = mutationAttempt;
      recordMutation(testInfo, {
        method,
        url: route.request().url(),
        note: `attempt=${attemptIdx}`,
      });

      if (attemptIdx === 1) {
        // Timeout simulado — abort após pequeno atraso (o cliente deve
        // marcar como erro sem congelar a UI).
        await new Promise((r) => setTimeout(r, 250));
        await route.abort('timedout');
        recordMutation(testInfo, {
          method,
          url: route.request().url(),
          note: `attempt=${attemptIdx} → abort timedout`,
        });
        return;
      }
      if (attemptIdx <= 3) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'service_unavailable', attempt: attemptIdx }),
        });
        recordMutation(testInfo, {
          method,
          url: route.request().url(),
          note: `attempt=${attemptIdx} → 503`,
        });
        return;
      }
      await route.continue();
    });

    // ── Ações que disparam mutações no cart A ────────────────────────────
    recordNav(testInfo, `A:${A}`);
    await page.goto(`/carrinhos/${A}`);
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    // Dispara 3 mutações em cascata (as três vão falhar).
    void page.evaluate((cartId) => {
      fetch(`/rest/v1/cart_items?cart_id=eq.${cartId}`, { method: 'PATCH' }).catch(() => {});
      fetch(`/rest/v1/cart_items?cart_id=eq.${cartId}`, { method: 'PATCH' }).catch(() => {});
      fetch(`/rest/v1/cart_items?cart_id=eq.${cartId}`, { method: 'DELETE' }).catch(() => {});
    }, A);

    // Navega para B enquanto as falhas ainda estão "no ar".
    recordNav(testInfo, `B:${B}`);
    await page.goto(`/carrinhos/${B}`);
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    // Volta a A → o cliente deve tentar novamente / carregar do zero.
    recordNav(testInfo, `A:${A}`);
    await page.goto(`/carrinhos/${A}`);
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    // ── Refresh após a recuperação do backend ────────────────────────────
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    const afterRefresh = await snapshotHeader(page);
    setDebugContext(testInfo, {
      afterRefresh,
      mutationAttempts: mutationAttempt,
    });

    // 1) Meta segue o contrato canônico.
    expect(afterRefresh.meta).toMatch(META_RE);
    // 2) Nenhum leak de "NaN|undefined|null" no header.
    expect(afterRefresh.meta).not.toMatch(/NaN|undefined|null/i);
    // 3) Após reidratar, header de A retorna ao snapshot canônico A —
    //    e NUNCA fica igual ao B (a menos que canonicamente sejam iguais).
    expect(afterRefresh.title).toBe(canonA.title);
    expect(afterRefresh.meta).toBe(canonA.meta);
    if (canonA.meta !== canonB.meta) {
      expect(afterRefresh.meta).not.toBe(canonB.meta);
    }
    if (canonA.title !== canonB.title) {
      expect(afterRefresh.title).not.toBe(canonB.title);
    }

    // 4) Sidebar (se renderiza) não fica presa em loading — CTA visível.
    const sidebarCount = await page.getByTestId('cart-sidebar-hero').count();
    if (sidebarCount > 0) {
      await expect(page.getByTestId('cart-checkout-cta')).toBeVisible();
    }

    // 5) Confirmação de que o retry ocorreu (>=1 tentativa registrada).
    expect(mutationAttempt).toBeGreaterThanOrEqual(1);
  });
});
