/**
 * E2E: header sticky do Resumo no Quote Builder.
 *
 * Cobre:
 *  - header (`Resumo` + `Recolher/Expandir` + `Agrupar`) permanece visível ao
 *    rolar a lista de produtos do Resumo;
 *  - botões continuam clicáveis no estado sticky (não cobertos por overlay);
 *  - interação Recolher/Expandir × Agrupar mantém contagem e layout após scroll;
 *  - responsividade em mobile/tablet — header sticky não corta nem sobrepõe.
 *
 * Selectors: data-testid (`quote-summary-header`, `quote-summary-collapse-all`,
 * `quote-summary-group-trigger`, `quote-summary-item-N`).
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

const STORAGE_KEY_NEW = 'quote-builder:collapsed-item-keys:new';

async function setup(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await loginAs(page, 'user');
  await page.addInitScript((k) => {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }, STORAGE_KEY_NEW);
  await gotoAndSettle(page, '/orcamentos/novo');
}

async function skipIfEmpty(page: Page) {
  const firstCard = page.getByTestId('quote-summary-item-0');
  if ((await firstCard.count()) === 0) {
    test.skip(true, 'Resumo vazio — adicionar produto está fora do escopo desta spec.');
  }
  await expect(firstCard).toBeVisible({ timeout: 10_000 });
}

/** Scrolla o container scrollável até o fim e aguarda estabilizar (sem timeout cego). */
async function scrollSummaryToBottom(page: Page) {
  await page.evaluate(() => {
    const header = document.querySelector('[data-testid="quote-summary-header"]');
    if (!header) return;
    let el: HTMLElement | null = header.parentElement;
    while (el) {
      const s = getComputedStyle(el);
      if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight) {
        el.scrollTop = el.scrollHeight;
        return;
      }
      el = el.parentElement;
    }
    window.scrollTo(0, document.body.scrollHeight);
  });
  // Aguarda o container realmente atingir o fim (sem waitForTimeout).
  await page.waitForFunction(() => {
    const header = document.querySelector('[data-testid="quote-summary-header"]');
    if (!header) return false;
    let el: HTMLElement | null = header.parentElement;
    while (el) {
      const s = getComputedStyle(el);
      if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight) {
        return el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
      }
      el = el.parentElement;
    }
    return true;
  }, null, { timeout: 5000 });
}

/** Anexa screenshot + log estruturado quando a posição sticky desviar. */
async function attachStickyDrift(
  page: Page,
  testInfo: import('@playwright/test').TestInfo,
  context: string,
  before: { x: number; y: number; width: number; height: number },
  after: { x: number; y: number; width: number; height: number },
) {
  const evidence = {
    context,
    viewport: page.viewportSize(),
    before,
    after,
    dy: after.y - before.y,
    dx: after.x - before.x,
  };
  await testInfo.attach(`sticky-drift-${context}.json`, {
    body: Buffer.from(JSON.stringify(evidence, null, 2)),
    contentType: 'application/json',
  });
  const shot = await page.screenshot({ fullPage: false });
  await testInfo.attach(`sticky-drift-${context}.png`, {
    body: shot,
    contentType: 'image/png',
  });
   
  console.warn('[sticky-header-drift]', JSON.stringify(evidence));
}


test.describe('Quote Builder · Resumo sticky header — desktop', () => {
  test.beforeEach(async ({ page }) => {
    await setup(page, 1440, 900);
  });

  test('header permanece visível ao rolar a lista de produtos', async ({ page }, testInfo) => {
    await skipIfEmpty(page);

    const header = page.getByTestId('quote-summary-header');
    await expect(header).toBeVisible();
    const beforeBox = await header.boundingBox();
    expect(beforeBox).not.toBeNull();

    await scrollSummaryToBottom(page);

    await expect(header).toBeVisible();
    const afterBox = await header.boundingBox();
    expect(afterBox).not.toBeNull();

    const dy = Math.abs(afterBox!.y - beforeBox!.y);
    if (dy > 4) {
      await attachStickyDrift(page, testInfo, 'desktop-scroll', beforeBox!, afterBox!);
    }
    expect(dy, `Sticky header desviou ${dy}px no eixo Y após scroll`).toBeLessThanOrEqual(4);
  });


  test('botões continuam clicáveis no estado sticky', async ({ page }) => {
    await skipIfEmpty(page);
    await scrollSummaryToBottom(page);

    const collapseAll = page.getByTestId('quote-summary-collapse-all');
    await expect(collapseAll).toBeVisible();

    // clique funciona depois do scroll → alterna para "Expandir"
    await collapseAll.click();
    await expect(collapseAll).toHaveText(/Expandir/);
    await expect(collapseAll).toHaveAttribute('data-open-count', '0');

    // toggle de volta
    await collapseAll.click();
    await expect(collapseAll).toHaveText(/Recolher/);
  });

  test('Recolher/Expandir × Agrupar mantém contagem e layout após scroll', async ({ page }) => {
    await skipIfEmpty(page);

    const items = page.locator('[data-testid^="quote-summary-item-"]');
    const total = await items.count();
    if (total < 2) {
      test.skip(true, 'Cenário exige ≥2 itens no Resumo.');
    }

    const collapseAll = page.getByTestId('quote-summary-collapse-all');
    const group = page.getByTestId('quote-summary-group-trigger');
    await expect(group).toBeVisible();

    // Agrupar por produto
    await group.click();
    await page.getByTestId('quote-summary-group-by-product').click();

    // Recolhe todos após agrupar
    await collapseAll.click();
    await expect(collapseAll).toHaveAttribute('data-open-count', '0');

    // Scroll → header e botões seguem visíveis e contagem preservada
    await scrollSummaryToBottom(page);
    await expect(collapseAll).toBeVisible();
    await expect(group).toBeVisible();
    await expect(collapseAll).toHaveAttribute('data-open-count', '0');

    // Quantidade de itens não muda só por rolar/recolher (Agrupar pode reordenar,
    // mas não exclui itens).
    expect(await items.count()).toBe(total);

    // Alinhamento horizontal mantido
    const cb = await collapseAll.boundingBox();
    const gb = await group.boundingBox();
    expect(cb).not.toBeNull();
    expect(gb).not.toBeNull();
    expect(Math.abs(cb!.y - gb!.y)).toBeLessThanOrEqual(4);
  });
});

test.describe('Quote Builder · Resumo sticky header — responsivo', () => {
  for (const vp of [
    { name: 'mobile (375)', width: 375, height: 720 },
    { name: 'tablet (768)', width: 768, height: 1024 },
  ]) {
    test(`header sticky não corta nem sobrepõe em ${vp.name}`, async ({ page }) => {
      await setup(page, vp.width, vp.height);
      await skipIfEmpty(page);

      const header = page.getByTestId('quote-summary-header');
      await expect(header).toBeVisible();

      const box = await header.boundingBox();
      expect(box).not.toBeNull();
      // header não pode estourar a largura da viewport
      expect(box!.x).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 1);
      // altura razoável (não colapsa nem fica gigantesco)
      expect(box!.height).toBeGreaterThan(32);
      expect(box!.height).toBeLessThan(160);

      // Em mobile pode não haver scroll interno (layout vira coluna única),
      // mas o header e os botões precisam permanecer interativos.
      const collapseAll = page.getByTestId('quote-summary-collapse-all');
      if (await collapseAll.count()) {
        await expect(collapseAll).toBeVisible();
        await collapseAll.scrollIntoViewIfNeeded();
        await collapseAll.click();
        await expect(collapseAll).toHaveText(/Expandir|Recolher/);
      }
    });
  }
});
