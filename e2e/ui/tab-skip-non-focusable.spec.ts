/**
 * E2E — Elementos não-tabuláveis (disabled / aria-disabled+tabIndex=-1 /
 * hidden / display:none / visibility:hidden / inert / fora-do-layout com
 * tabIndex=-1) NÃO entram no loop de Tab e NÃO alteram o token declarativo
 * `focus-visible:ring-*` dos vizinhos ao serem "pulados".
 *
 * Cobre:
 *  A) Sequência de Tab visita EXATAMENTE os `data-focusable-ids` do harness,
 *     nessa ordem, sem parar em nenhum vizinho não-tabulável.
 *  B) Shift+Tab também pula os mesmos elementos (ordem reversa).
 *  C) O `className` dos vizinhos focáveis permanece idêntico ao snapshot
 *     inicial durante e após todo o percurso (zero drift).
 *  D) Os elementos "skip-*" nunca recebem foco nem `:focus-visible` durante
 *     o percurso.
 *
 * Harness: /__test/tab-skip (SSOT dev-only).
 */
import { test, expect, type Page } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/__test/tab-skip';

const SKIP_IDS = [
  'skip-disabled',
  'skip-aria-disabled',
  'skip-hidden',
  'skip-display-none',
  'skip-visibility-hidden',
  'skip-inert-child',
  'skip-offscreen',
] as const;

async function focusableIds(page: Page): Promise<string[]> {
  const raw = await page.getByTestId('tab-skip-ready').getAttribute('data-focusable-ids');
  expect(raw, 'harness expõe data-focusable-ids').toBeTruthy();
  return raw!.split(',').filter(Boolean);
}

async function focusedTestId(page: Page): Promise<string | null> {
  return page.evaluate(
    () => (document.activeElement as HTMLElement | null)?.getAttribute('data-testid') ?? null,
  );
}

async function classSnapshot(page: Page, ids: string[]): Promise<Record<string, string>> {
  return page.evaluate((list) => {
    const out: Record<string, string> = {};
    for (const id of list) {
      const el = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      out[id] = el?.className ?? '';
    }
    return out;
  }, ids);
}

test.describe('Tab-skip — disabled/aria-disabled/hidden/inert/offscreen ficam fora do loop', () => {
  test('Tab visita apenas os focáveis, na ordem, sem drift de className', async ({ page }) => {
    await gotoAndSettle(page, ROUTE);
    await expect(page.getByTestId('tab-skip-ready')).toBeVisible();

    const ids = await focusableIds(page);
    expect(ids.length).toBeGreaterThanOrEqual(4);

    const before = await classSnapshot(page, ids);
    const visited: string[] = [];
    const skipSeen: string[] = [];

    // Passos suficientes para cobrir todos os focáveis + margem de wrap
    // (Chromium pode passar por body na fronteira do documento).
    const maxSteps = ids.length + SKIP_IDS.length + 4;
    for (let i = 0; i < maxSteps && visited.length < ids.length; i++) {
      await page.keyboard.press('Tab');
      const id = await focusedTestId(page);
      if (!id) continue;
      if ((SKIP_IDS as readonly string[]).includes(id)) {
        skipSeen.push(id);
        continue;
      }
      if (ids.includes(id) && visited[visited.length - 1] !== id) {
        visited.push(id);
      }
    }

    // Ordem exata dos focáveis, sem paradas em elementos "skip-*".
    expect(visited).toEqual(ids);
    expect(skipSeen, `Tab parou em elemento não-tabulável: ${skipSeen.join(',')}`).toEqual([]);

    // Nenhum className mutou durante o percurso.
    expect(await classSnapshot(page, ids)).toEqual(before);
  });

  test('Shift+Tab também pula os mesmos elementos (ordem reversa)', async ({ page }) => {
    await gotoAndSettle(page, ROUTE);
    await expect(page.getByTestId('tab-skip-ready')).toBeVisible();

    const ids = await focusableIds(page);
    const before = await classSnapshot(page, ids);

    // Foca o último focável primeiro (avança N Tabs).
    for (let i = 0; i < ids.length; i++) {
      await page.keyboard.press('Tab');
    }
    expect(await focusedTestId(page)).toBe(ids[ids.length - 1]);

    const visitedReverse: string[] = [ids[ids.length - 1]];
    const skipSeen: string[] = [];

    const maxSteps = ids.length + SKIP_IDS.length + 4;
    for (let i = 0; i < maxSteps && visitedReverse.length < ids.length; i++) {
      await page.keyboard.press('Shift+Tab');
      const id = await focusedTestId(page);
      if (!id) continue;
      if ((SKIP_IDS as readonly string[]).includes(id)) {
        skipSeen.push(id);
        continue;
      }
      if (ids.includes(id) && visitedReverse[visitedReverse.length - 1] !== id) {
        visitedReverse.push(id);
      }
    }

    expect(visitedReverse).toEqual([...ids].reverse());
    expect(skipSeen, `Shift+Tab parou em não-tabulável: ${skipSeen.join(',')}`).toEqual([]);
    expect(await classSnapshot(page, ids)).toEqual(before);
  });

  test('elementos skip-* nunca casam :focus-visible durante o percurso', async ({ page }) => {
    await gotoAndSettle(page, ROUTE);
    await expect(page.getByTestId('tab-skip-ready')).toBeVisible();

    const ids = await focusableIds(page);

    for (let i = 0; i < ids.length + 2; i++) {
      await page.keyboard.press('Tab');
    }

    // Nenhum elemento "skip-*" no DOM deve casar :focus-visible.
    const skippedMatched = await page.evaluate((list) => {
      return list
        .map((id) => {
          const el = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
          if (!el) return null;
          try {
            return el.matches(':focus-visible') ? id : null;
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    }, SKIP_IDS as unknown as string[]);

    expect(skippedMatched).toEqual([]);
  });
});
