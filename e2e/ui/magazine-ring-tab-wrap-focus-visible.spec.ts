/**
 * E2E — Wrap de Tab/Shift+Tab mantém `:focus-visible` verdadeiro nas fronteiras
 * (último → primeiro e primeiro → último) sem drift de rings.
 *
 * Cobre o lado positivo que jsdom não consegue simular (heurística de
 * modalidade de teclado): em Chromium real, Tab por teclado ativa
 * `:focus-visible`, portanto a classe `focus-visible:ring-primary` DEVE
 * pintar um box-shadow não vazio no elemento focado. Após ciclar por todos
 * os thumbs e retornar via wrap, os `className` declarativos permanecem
 * idênticos ao snapshot inicial — nada muta em resposta ao Tab.
 *
 * Usa o harness dev-only `/__test/magazine-ring` (SSOT do ring do PreviewSidebar).
 */
import { test, expect, type Page } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

const COUNT = 4;
const ROUTE = `/__test/magazine-ring?count=${COUNT}&active=-1&highlight=-1&focus=-1`;

async function classNamesSnapshot(page: Page): Promise<string[]> {
  return page.evaluate((n) => {
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
      const el = document.querySelector<HTMLButtonElement>(`[data-testid="thumb-${i}"]`);
      out.push(el?.className ?? '');
    }
    return out;
  }, COUNT);
}

async function focusedTestId(page: Page): Promise<string | null> {
  return page.evaluate(
    () => (document.activeElement as HTMLElement | null)?.getAttribute('data-testid') ?? null,
  );
}

async function isFocusVisible(page: Page, testid: string): Promise<boolean> {
  return page.locator(`[data-testid="${testid}"]`).evaluate((el) => el.matches(':focus-visible'));
}

async function ringBoxShadow(page: Page, testid: string): Promise<string> {
  return page
    .locator(`[data-testid="${testid}"]`)
    .evaluate((el) => getComputedStyle(el).boxShadow);
}

test.describe('Magazine ring — Tab/Shift+Tab wrap preserva :focus-visible sem drift', () => {
  test('Tab a partir do último wrap para o primeiro; ring pintado nas duas fronteiras', async ({
    page,
  }) => {
    await gotoAndSettle(page, ROUTE);
    await expect(page.getByTestId('harness-ready')).toBeVisible();

    const snapshotBefore = await classNamesSnapshot(page);

    // Tab N vezes → foca o último thumb (thumb-<COUNT-1>).
    for (let i = 0; i < COUNT; i++) {
      await page.keyboard.press('Tab');
    }
    const lastId = `thumb-${COUNT - 1}`;
    expect(await focusedTestId(page)).toBe(lastId);
    expect(await isFocusVisible(page, lastId)).toBe(true);

    const shadowLast = await ringBoxShadow(page, lastId);
    expect(shadowLast, 'esperado ring pintado no último elemento').not.toBe('none');
    expect(shadowLast).toMatch(/rgb/);

    // Tab de novo — sai do último. Em Chromium headless, o foco pode ir
    // para `body` (fronteira do documento) antes de wrap para o primeiro.
    // Continuamos pressionando Tab até que thumb-0 receba o foco.
    for (let step = 0; step < COUNT + 2; step++) {
      const id = await focusedTestId(page);
      if (id === 'thumb-0') break;
      await page.keyboard.press('Tab');
    }
    expect(await focusedTestId(page)).toBe('thumb-0');
    expect(await isFocusVisible(page, 'thumb-0')).toBe(true);

    const shadowFirst = await ringBoxShadow(page, 'thumb-0');
    expect(shadowFirst, 'esperado ring pintado no primeiro elemento após wrap').not.toBe('none');

    // Nenhum className foi mutado durante o wrap.
    const snapshotAfter = await classNamesSnapshot(page);
    expect(snapshotAfter).toEqual(snapshotBefore);
  });

  test('Shift+Tab a partir do primeiro wrap para o último; ring pintado sem drift', async ({
    page,
  }) => {
    await gotoAndSettle(page, ROUTE);
    await expect(page.getByTestId('harness-ready')).toBeVisible();

    const snapshotBefore = await classNamesSnapshot(page);

    // Foca o primeiro thumb.
    await page.keyboard.press('Tab');
    expect(await focusedTestId(page)).toBe('thumb-0');
    expect(await isFocusVisible(page, 'thumb-0')).toBe(true);

    // Shift+Tab até thumb-<COUNT-1> (pode passar por body na fronteira).
    const lastId = `thumb-${COUNT - 1}`;
    for (let step = 0; step < COUNT + 2; step++) {
      const id = await focusedTestId(page);
      if (id === lastId) break;
      await page.keyboard.press('Shift+Tab');
    }
    expect(await focusedTestId(page)).toBe(lastId);
    expect(await isFocusVisible(page, lastId)).toBe(true);

    const shadow = await ringBoxShadow(page, lastId);
    expect(shadow, 'esperado ring pintado no último após wrap reverso').not.toBe('none');

    const snapshotAfter = await classNamesSnapshot(page);
    expect(snapshotAfter).toEqual(snapshotBefore);
  });

  test('ciclo completo Tab→wrap→Tab preserva ring em cada fronteira', async ({ page }) => {
    await gotoAndSettle(page, ROUTE);
    await expect(page.getByTestId('harness-ready')).toBeVisible();

    const snapshotBefore = await classNamesSnapshot(page);

    // 2 voltas completas — força passar 2× por cada fronteira.
    for (let loop = 0; loop < 2; loop++) {
      for (let i = 0; i < COUNT; i++) {
        // avança até o próximo thumb (tolerando body na fronteira).
        for (let step = 0; step < 3; step++) {
          await page.keyboard.press('Tab');
          const id = await focusedTestId(page);
          if (id && id.startsWith('thumb-')) break;
        }
        const focused = await focusedTestId(page);
        expect(focused).toMatch(/^thumb-\d+$/);
        expect(await isFocusVisible(page, focused!)).toBe(true);
        expect(await ringBoxShadow(page, focused!)).not.toBe('none');
      }
    }

    // Zero drift declarativo após múltiplas passagens pela fronteira.
    expect(await classNamesSnapshot(page)).toEqual(snapshotBefore);
  });
});
