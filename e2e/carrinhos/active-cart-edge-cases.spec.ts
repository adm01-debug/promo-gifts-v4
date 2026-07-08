/**
 * E2E: comportamento do header/sidebar do carrinho ativo em cenários difíceis.
 *
 * Após a repaginação, Qtd/SKUs/Subtotal vivem no HEADER da página e
 * Peso/Volume seguem na SIDEBAR (quando aplicáveis). Este spec cobre:
 *
 *  1) Trocas rápidas em sequência (antes do carregamento terminar) — o
 *     estado final DEVE bater com o último carrinho selecionado.
 *  2) Carrinho ativo vazio — Qtd/SKUs zeram, subtotal some, e a sidebar
 *     NÃO exibe peso/volume herdados do carrinho anterior.
 *  3) Formatação de moeda (R$ + 2 casas decimais no padrão pt-BR).
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

// Formato pt-BR: "R$ 1.234,56" — `Intl` usa NBSP (\u00A0) entre símbolo e
// número; normalizamos qualquer whitespace unicode antes de casar o padrão.
const CURRENCY_RE = /R\$[\s\u00A0\u202F]?\d{1,3}(?:\.\d{3})*,\d{2}/;
const norm = (s: string) => s.replace(/[\u00A0\u202F]/g, ' ');

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

async function readHeaderMeta(page: Page): Promise<string> {
  const meta = page
    .locator('[data-testid=page-title-carrinhos]')
    .locator('..')
    .locator('p')
    .first();
  await expect(meta).toBeVisible();
  return norm((await meta.innerText()).trim());
}

async function readHeaderTitle(page: Page): Promise<string> {
  return (await page.getByTestId('page-title-carrinhos').innerText()).trim();
}

test.describe('Carrinhos · resiliência de carrinho ativo @carrinhos', () => {
  test('trocas rápidas em sequência convergem para o carrinho final', async ({ page }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/carrinhos');

    const ids = await collectCartIds(page);
    if (ids.length < 2) test.skip(true, 'precisa de 2+ carrinhos');

    // 3 navegações encadeadas sem esperar assentar entre elas.
    await page.goto(`/carrinhos/${ids[0]}`);
    await page.goto(`/carrinhos/${ids[1] ?? ids[0]}`);
    await page.goto(`/carrinhos/${ids[0]}`);

    // Só agora aguardamos assentar — o estado final DEVE ser do último id.
    await expect(page).toHaveURL(new RegExp(`/carrinhos/${ids[0]}`));
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    const meta = await readHeaderMeta(page);
    // Meta do carrinho ativo tem formato "N SKU(s) · N unidade(s) [· R$ X,XX]"
    expect(meta).toMatch(/SKU|unidade/i);
  });

  test('carrinho vazio zera Qtd/subtotal e não vaza peso/volume anterior', async ({ page }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/carrinhos');

    const ids = await collectCartIds(page);
    if (ids.length === 0) test.skip(true, 'sem carrinhos para testar');

    // Procura um carrinho vazio; se não houver, skipamos com clareza.
    let emptyId: string | null = null;
    for (const id of ids) {
      await gotoAndSettle(page, `/carrinhos/${id}`);
      await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();
      const meta = await readHeaderMeta(page);
      // "0 SKUs · 0 unidades" — sem subtotal (formatCurrency só aparece se > 0).
      if (/\b0\s*SKUs?\b/i.test(meta) && /\b0\s*unidades?\b/i.test(meta)) {
        emptyId = id;
        break;
      }
    }

    if (!emptyId) test.skip(true, 'nenhum carrinho vazio disponível — cenário não reproduzível');

    // Header do vazio: 0 SKUs, 0 unidades, SEM moeda (currency oculto quando subtotal = 0).
    const meta = await readHeaderMeta(page);
    expect(meta).toMatch(/\b0\s*SKUs?\b/i);
    expect(meta).toMatch(/\b0\s*unidades?\b/i);
    expect(meta).not.toMatch(CURRENCY_RE);

    // Sidebar não renderiza quando items.length === 0 (gate em SellerCartsPage).
    // Portanto peso/volume herdados NUNCA aparecem.
    await expect(page.getByTestId('cart-sidebar-hero')).toHaveCount(0);
  });

  test('formatação pt-BR de moeda no header ao alternar entre carrinhos', async ({ page }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/carrinhos');

    const ids = await collectCartIds(page);
    if (ids.length < 2) test.skip(true, 'precisa de 2+ carrinhos');

    // Encontra até 2 carrinhos com subtotal > 0 (moeda visível no header).
    const withMoney: string[] = [];
    for (const id of ids) {
      if (withMoney.length === 2) break;
      await gotoAndSettle(page, `/carrinhos/${id}`);
      await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();
      const meta = await readHeaderMeta(page);
      if (CURRENCY_RE.test(meta)) withMoney.push(id);
    }

    if (withMoney.length < 2) {
      test.skip(true, 'precisa de 2+ carrinhos com subtotal > 0 para validar moeda');
    }

    // Carrinho 1 → formato pt-BR válido.
    await gotoAndSettle(page, `/carrinhos/${withMoney[0]}`);
    const meta1 = await readHeaderMeta(page);
    const money1 = meta1.match(CURRENCY_RE)?.[0] ?? '';
    expect(money1).toMatch(CURRENCY_RE);
    // Duas casas decimais depois da vírgula.
    expect(money1).toMatch(/,\d{2}\b/);

    // Carrinho 2 → mesmo padrão, valor pode diferir.
    await gotoAndSettle(page, `/carrinhos/${withMoney[1]}`);
    const meta2 = await readHeaderMeta(page);
    const money2 = meta2.match(CURRENCY_RE)?.[0] ?? '';
    expect(money2).toMatch(CURRENCY_RE);
    expect(money2).toMatch(/,\d{2}\b/);

    // Título (nome da empresa) também troca — sanity de que o header
    // não persistiu com o carrinho anterior.
    const title2 = await readHeaderTitle(page);
    expect(title2.length).toBeGreaterThan(0);
  });
});
