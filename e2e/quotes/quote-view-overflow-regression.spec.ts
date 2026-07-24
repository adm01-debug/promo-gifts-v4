/**
 * Regressões de layout que QUEBRAM o sticky da sidebar e o thead sticky.
 *
 * Contexto: o CSS spec promove `overflow-x: hidden` (e quaisquer valores
 * ≠ `visible`/`clip`) para `overflow-y: auto` quando o eixo oposto não é
 * `visible`. Isso cria um scroll container intermediário entre `<html>` e
 * `<aside>`, anulando `position: sticky`. Esta spec varre todos os ancestrais
 * e falha se algum violar essa invariante.
 *
 * Também valida que NENHUM ancestral introduz containing block via
 * `transform`/`filter`/`perspective`/`contain: paint|layout|strict`, o que
 * quebraria sticky silenciosamente.
 */
import { test, expect, type Page } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/__visual/quote-view-order';
const SAFE_OVERFLOW = new Set(['visible', 'clip']);
const BAD_CB = ['transform', 'filter', 'perspective', 'contain'];

async function open(page: Page, width = 1280, height = 900) {
  await page.setViewportSize({ width, height });
  await gotoAndSettle(page, ROUTE);
  await expect(page.getByTestId('quote-view-order-harness')).toBeVisible();
}

test('@smoke nenhum ancestral da sidebar quebra sticky via overflow ou containing block', async ({
  page,
}) => {
  await open(page);
  const violations = await page.evaluate(({ badCb }) => {
    const aside = document.querySelector('aside');
    if (!aside) return [{ tag: 'NO_ASIDE', issues: ['<aside> não encontrado'] }];
    const out: { tag: string; issues: string[] }[] = [];
    let el: HTMLElement | null = aside.parentElement;
    while (el && el !== document.documentElement) {
      const cs = getComputedStyle(el);
      const issues: string[] = [];
      if (!['visible', 'clip'].includes(cs.overflowX)) issues.push(`overflow-x=${cs.overflowX}`);
      if (!['visible', 'clip'].includes(cs.overflowY)) issues.push(`overflow-y=${cs.overflowY}`);
      for (const prop of badCb) {
        const v = (cs as unknown as Record<string, string>)[prop];
        if (!v || v === 'none' || v === 'normal') continue;
        if (prop === 'contain' && !/(paint|layout|strict|content)/.test(v)) continue;
        issues.push(`${prop}=${v}`);
      }
      if (issues.length) {
        out.push({
          tag: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${
            el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/).slice(0, 2).join('.') : ''
          }`,
          issues,
        });
      }
      el = el.parentElement;
    }
    return out;
  }, { badCb: BAD_CB });

  expect(
    violations,
    `Ancestrais da <aside> quebram sticky:\n${JSON.stringify(violations, null, 2)}`,
  ).toEqual([]);
});

test('@smoke sticky da sidebar sobrevive em múltiplas resoluções', async ({ page }) => {
  for (const [w, h] of [
    [1024, 768],
    [1280, 900],
    [1440, 1024],
    [1920, 1080],
  ] as const) {
    await open(page, w, h);
    const aside = page.locator('aside').first();
    const pos = await aside.evaluate((el) => getComputedStyle(el).position);
    expect(pos, `viewport ${w}x${h}: aside.position=${pos}`).toBe('sticky');
    const brand = page.getByTestId('sidebar-brand-header').first();
    const before = await brand.boundingBox();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const after = await brand.boundingBox();
    expect(before && after).toBeTruthy();
    expect(
      Math.abs(after!.y - before!.y),
      `viewport ${w}x${h}: brand moveu ${before!.y}→${after!.y}`,
    ).toBeLessThanOrEqual(2);
  }
});

test('teclado: setas/PageDown/Home/End movem o scroll interno e anunciam estado', async ({
  page,
}) => {
  await open(page);
  const scroller = page
    .getByTestId('quote-items-table-fixture-many')
    .getByTestId('quote-items-table-scroll');
  await expect(scroller).toHaveAttribute('data-inner-scroll', 'true');
  await scroller.focus();

  await expect(scroller).toHaveAttribute('data-scroll-at-top', 'true');

  // ArrowDown move ao menos uma linha
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(
    (el) => (el as HTMLDivElement).scrollTop > 0,
    await scroller.elementHandle(),
    { timeout: 1500 },
  );

  // End vai ao final e dispara anúncio "Fim da lista"
  await page.keyboard.press('End');
  await expect(scroller).toHaveAttribute('data-scroll-at-bottom', 'true');
  const status = scroller.locator('xpath=following-sibling::*[@role="status"]').first();
  await expect(status).toHaveText(/Fim da lista/i);

  // Home volta ao topo
  await page.keyboard.press('Home');
  await expect(scroller).toHaveAttribute('data-scroll-at-top', 'true');
});

test('@smoke thead permanece sticky durante rolagem interna em md e lg', async ({ page }) => {
  for (const [w, h] of [
    [768, 900],
    [1280, 900],
  ] as const) {
    await open(page, w, h);
    const scroller = page
      .getByTestId('quote-items-table-fixture-many')
      .getByTestId('quote-items-table-scroll');
    const thead = scroller.locator('thead').first();
    await scroller.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    const tBox = await thead.boundingBox();
    const sBox = await scroller.boundingBox();
    expect(tBox && sBox).toBeTruthy();
    expect(
      Math.abs(tBox!.y - sBox!.y),
      `viewport ${w}x${h}: thead descolou (${tBox!.y} vs ${sBox!.y})`,
    ).toBeLessThanOrEqual(2);
  }
});

test('Tab percorre controles dentro da região rolável sem perder foco após scroll', async ({
  page,
}) => {
  await open(page);
  const scroller = page
    .getByTestId('quote-items-table-fixture-many')
    .getByTestId('quote-items-table-scroll');

  // Foca o scroller e tabula para o primeiro controle interativo interno.
  await scroller.focus();
  await expect(scroller).toBeFocused();

  // Tab move para dentro: ao menos um focável (botão da QuoteItemDetailSheet).
  await page.keyboard.press('Tab');
  const firstFocusContained = await scroller.evaluate(
    (el) => !!document.activeElement && el.contains(document.activeElement),
  );
  expect(firstFocusContained, 'Tab deveria entrar na região rolável').toBe(true);

  // Continua tabulando 4x; cada foco deve permanecer no DOM e visível.
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    const stillVisible = await page.evaluate(() => {
      const ae = document.activeElement as HTMLElement | null;
      if (!ae) return false;
      const r = ae.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    expect(stillVisible, `Tab #${i + 2}: foco perdeu visibilidade`).toBe(true);
  }

  // Após muda de estado de rolagem (End), o foco atual NÃO deve ser resetado
  // para body — o navegador preserva foco; validamos que continua dentro do
  // documento e que o scroller mantém data-scroll-at-bottom.
  const activeBefore = await page.evaluate(() => document.activeElement?.tagName ?? null);
  await scroller.focus();
  await page.keyboard.press('End');
  await expect(scroller).toHaveAttribute('data-scroll-at-bottom', 'true');
  const activeAfter = await page.evaluate(() => document.activeElement?.tagName ?? null);
  expect(activeAfter).not.toBeNull();
  expect(activeAfter).not.toBe('BODY');
  expect(activeBefore).not.toBeNull();
});

