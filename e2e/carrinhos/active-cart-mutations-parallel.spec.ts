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
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import { installFailureCapture } from '../helpers/attach-on-failure';

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

test.describe('Carrinhos · A→B→A→C com mutações paralelas @carrinhos', () => {
  test('DELETE/PATCH tardios nunca vazam para o header/sidebar do cart ativo', async ({ page }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/carrinhos');

    const ids = await collectCartIds(page);
    if (ids.length < 3) test.skip(true, 'precisa de 3+ carrinhos');
    const [A, B, C] = ids;

    // Snapshot canônico de cada cart (sem interferência).
    await gotoAndSettle(page, `/carrinhos/${A}`);
    const canonA = await snapshotHeader(page);
    await gotoAndSettle(page, `/carrinhos/${B}`);
    const canonB = await snapshotHeader(page);
    await gotoAndSettle(page, `/carrinhos/${C}`);
    const canonC = await snapshotHeader(page);

    // Rastreia mutações PATCH/DELETE contra cart_items e adia respostas para
    // simular resposta lenta do backend chegando após a próxima navegação.
    const observed: Array<{ method: string; url: string; delayed: boolean }> = [];
    await page.route('**/rest/v1/cart_items**', async (route) => {
      const req = route.request();
      const method = req.method();
      if (method === 'DELETE' || method === 'PATCH' || method === 'POST') {
        observed.push({ method, url: req.url(), delayed: true });
        // Atrasa 400ms — tempo suficiente para o usuário já ter trocado de cart.
        await new Promise((r) => setTimeout(r, 400));
      }
      await route.continue();
    });
    // GETs também com pequena latência para forçar sobreposição.
    await page.route('**/rest/v1/seller_carts**', async (route) => {
      if (route.request().method() === 'GET') {
        await new Promise((r) => setTimeout(r, 120));
      }
      await route.continue();
    });

    // ── Sequência A→B→A→C intercalada com mutações ────────────────────
    await page.goto(`/carrinhos/${A}`);
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    // Dispara mutação síntetica direto pelo runtime (evita depender de UI
    // exata de "remover item"). O importante é gerar tráfego concorrente
    // contra a mesma tabela durante a troca.
    void page.evaluate((cartId) => {
      // Chamada "fantasma" — não precisa completar, só criar tráfego que
      // possa retornar tarde. Se falhar, é ok — é rota mockada.
      fetch(`/rest/v1/cart_items?cart_id=eq.${cartId}`, { method: 'PATCH' }).catch(() => {});
      fetch(`/rest/v1/cart_items?cart_id=eq.${cartId}`, { method: 'DELETE' }).catch(() => {});
    }, A);

    // Troca imediata para B (respostas de A ficam voando).
    await page.goto(`/carrinhos/${B}`);
    void page.evaluate((cartId) => {
      fetch(`/rest/v1/cart_items?cart_id=eq.${cartId}`, { method: 'PATCH' }).catch(() => {});
    }, B);

    // Volta para A.
    await page.goto(`/carrinhos/${A}`);
    // Salta para C — deve ser o estado final.
    await page.goto(`/carrinhos/${C}`);

    await expect(page).toHaveURL(new RegExp(`/carrinhos/${C}$`));
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    // Assegura que já houve tráfego de mutação em voo durante a sequência.
    // (Se zero, o teste ainda passa — mas perdemos a garantia.)
    expect(observed.length).toBeGreaterThanOrEqual(1);

    // Header final DEVE ser idêntico ao snapshot canônico de C.
    const final = await snapshotHeader(page);
    expect(final.meta).toMatch(META_RE);
    expect(final.title).toBe(canonC.title);
    expect(final.meta).toBe(canonC.meta);

    // E jamais igual a A ou B (quando distintos).
    if (canonA.meta !== canonC.meta) expect(final.meta).not.toBe(canonA.meta);
    if (canonB.meta !== canonC.meta) expect(final.meta).not.toBe(canonB.meta);

    // Sidebar (quando presente) deve estar carregada e sem estado stale.
    const sidebarCount = await page.getByTestId('cart-sidebar-hero').count();
    if (sidebarCount > 0) {
      await expect(page.getByTestId('cart-checkout-cta')).toBeVisible();
    }
  });
});
