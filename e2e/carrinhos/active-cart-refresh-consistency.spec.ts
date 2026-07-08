/**
 * E2E: consistência do header (title/meta/subtotal/unidades) após ações que
 * alteram itens do carrinho, refresh completo (F5) e retorno ao mesmo /carrinhos/:id.
 *
 * Objetivo: garantir que hidratação SSR/CSR + persistência do carrinho ativo
 * não produzem drift no header entre visitas. Se o meta mudar apenas por
 * refresh (sem ação real), o teste falha.
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

const NBSP_RE = /[\u00A0\u202F]/g;
const norm = (s: string) => s.replace(NBSP_RE, ' ').trim();
const CURRENCY_RE = /R\$[\s\u00A0\u202F]?\d{1,3}(?:\.\d{3})*,\d{2}/;
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

async function readHeader(page: Page): Promise<{ title: string; meta: string }> {
  const title = (await page.getByTestId('page-title-carrinhos').innerText()).trim();
  const meta = page
    .getByTestId('page-title-carrinhos')
    .locator('..')
    .locator('p')
    .first();
  await expect(meta).toBeVisible();
  const metaText = norm(await meta.innerText());
  return { title, meta: metaText };
}

test.describe('Carrinhos · consistência após refresh e retorno @carrinhos', () => {
  test('header (title/meta/subtotal) permanece idêntico após F5 e retorno', async ({ page }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/carrinhos');

    const ids = await collectCartIds(page);
    if (ids.length === 0) test.skip(true, 'sem carrinhos disponíveis');

    const cartId = ids[0];
    await gotoAndSettle(page, `/carrinhos/${cartId}`);
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    const before = await readHeader(page);
    // Guard: meta deve casar contrato mínimo (N SKU(s) · N unidade(s)).
    expect(before.meta).toMatch(META_RE);

    // ── Refresh completo (F5) ───────────────────────────────────────────
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();
    const afterReload = await readHeader(page);

    // Título e meta devem bater — nenhuma re-hidratação pode alterar o header.
    expect(afterReload.title).toBe(before.title);
    expect(afterReload.meta).toBe(before.meta);
    // Se havia subtotal, o formato pt-BR permanece válido.
    if (CURRENCY_RE.test(before.meta)) {
      expect(afterReload.meta).toMatch(CURRENCY_RE);
    }

    // ── Sai do carrinho e volta ─────────────────────────────────────────
    await gotoAndSettle(page, '/carrinhos');
    await gotoAndSettle(page, `/carrinhos/${cartId}`);
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();
    const afterReturn = await readHeader(page);

    expect(afterReturn.title).toBe(before.title);
    expect(afterReturn.meta).toBe(before.meta);
  });

  test('após alternar de carrinho e voltar, header não carrega dados do outro cart', async ({ page }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/carrinhos');

    const ids = await collectCartIds(page);
    if (ids.length < 2) test.skip(true, 'precisa de 2+ carrinhos');

    // Captura header do cart A.
    await gotoAndSettle(page, `/carrinhos/${ids[0]}`);
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();
    const a = await readHeader(page);

    // Vai para B.
    await gotoAndSettle(page, `/carrinhos/${ids[1]}`);
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();
    const b = await readHeader(page);

    // Volta para A — deve reproduzir o header original exatamente.
    await gotoAndSettle(page, `/carrinhos/${ids[0]}`);
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();
    const aAgain = await readHeader(page);

    expect(aAgain.title).toBe(a.title);
    expect(aAgain.meta).toBe(a.meta);

    // E o meta de B nunca deve ter "vazado" para A (se forem distintos).
    if (a.meta !== b.meta) {
      expect(aAgain.meta).not.toBe(b.meta);
    }
  });

  test('formato pt-BR de subtotal sobrevive a refresh (nenhum drift de locale)', async ({ page }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/carrinhos');

    const ids = await collectCartIds(page);
    if (ids.length === 0) test.skip(true, 'sem carrinhos');

    // Procura carrinho com subtotal > 0.
    let target: string | null = null;
    for (const id of ids) {
      await gotoAndSettle(page, `/carrinhos/${id}`);
      await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();
      const { meta } = await readHeader(page);
      if (CURRENCY_RE.test(meta)) { target = id; break; }
    }
    if (!target) test.skip(true, 'nenhum carrinho com subtotal > 0');

    await gotoAndSettle(page, `/carrinhos/${target}`);
    const before = await readHeader(page);
    const moneyBefore = before.meta.match(CURRENCY_RE)?.[0] ?? '';
    expect(moneyBefore).toMatch(/,\d{2}\b/);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();
    const after = await readHeader(page);
    const moneyAfter = after.meta.match(CURRENCY_RE)?.[0] ?? '';

    // Mesmo valor, mesmas 2 casas decimais — nenhum reformat quebra locale.
    expect(norm(moneyAfter)).toBe(norm(moneyBefore));
  });
});
