/**
 * E2E — Elementos não-tabuláveis não entram no loop de Tab.
 *
 * Em caso de falha, o helper `createTabTrail` anexa `tab-trail.txt` e
 * `tab-trail.json` ao relatório do Playwright com a sequência completa
 * de `document.activeElement` (testid, tagName, `:focus-visible`, className,
 * boxShadow) e o esperado por passo.
 */
import { test, expect, type Page } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';
import { createTabTrail } from '../helpers/tab-trail';

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
  test('Tab visita apenas os focáveis, na ordem, sem drift de className', async ({
    page,
  }, testInfo) => {
    const trail = createTabTrail();
    try {
      await gotoAndSettle(page, ROUTE);
      await expect(page.getByTestId('tab-skip-ready')).toBeVisible();

      const ids = await focusableIds(page);
      expect(ids.length).toBeGreaterThanOrEqual(4);

      const before = await classSnapshot(page, ids);

      await trail.init(page);
      // Passos suficientes para cobrir todos os focáveis + margem de wrap.
      const maxSteps = ids.length + SKIP_IDS.length + 4;
      for (let i = 0; i < maxSteps; i++) {
        const expectedId = i < ids.length ? ids[i] : null;
        await trail.tab(page, { expected: expectedId });
        if (
          trail.visited().filter((v): v is string => v !== null).length >= ids.length
        ) {
          break;
        }
      }

      // Nenhum "skip-*" apareceu na trilha.
      const visitedNonNull = trail.visited().filter((v): v is string => v !== null);
      const skipHits = visitedNonNull.filter((id) =>
        (SKIP_IDS as readonly string[]).includes(id),
      );
      expect(skipHits, `Tab parou em elementos não-tabuláveis: ${skipHits.join(',')}`).toEqual([]);

      // Ordem exata dos focáveis.
      trail.assertVisited(ids);

      // Zero drift de className.
      expect(await classSnapshot(page, ids)).toEqual(before);
    } finally {
      await trail.attach(testInfo);
    }
  });

  test('Shift+Tab também pula os mesmos elementos (ordem reversa)', async ({
    page,
  }, testInfo) => {
    const trail = createTabTrail();
    try {
      await gotoAndSettle(page, ROUTE);
      await expect(page.getByTestId('tab-skip-ready')).toBeVisible();

      const ids = await focusableIds(page);
      const before = await classSnapshot(page, ids);
      const reversed = [...ids].reverse();

      // Avança até o último focável (Tab N vezes) — registra na trilha.
      await trail.init(page);
      for (let i = 0; i < ids.length; i++) {
        await trail.tab(page, { expected: ids[i] });
      }
      expect(trail.steps[trail.steps.length - 1]!.activeTestId).toBe(
        ids[ids.length - 1],
      );

      // Agora percorre reverso com Shift+Tab.
      const maxSteps = ids.length + SKIP_IDS.length + 4;
      for (let i = 1; i < maxSteps; i++) {
        const expectedId = i < reversed.length ? reversed[i] : null;
        await trail.shiftTab(page, { expected: expectedId });
        if (
          trail.visited().filter((v): v is string => v !== null).length >=
          ids.length + reversed.length - 1
        ) {
          break;
        }
      }

      // A trilha reversa (a partir do último focável) bate com `reversed`.
      const visitedNonNull = trail.visited().filter((v): v is string => v !== null);
      const reverseSlice = visitedNonNull.slice(ids.length - 1, ids.length * 2 - 1);
      if (reverseSlice.join('|') !== reversed.join('|')) {
        // Reaproveita o formatador do helper via assertVisited (falha rica).
        trail.assertVisited([...ids, ...reversed.slice(1)]);
      }

      const skipHits = visitedNonNull.filter((id) =>
        (SKIP_IDS as readonly string[]).includes(id),
      );
      expect(skipHits, `Shift+Tab parou em não-tabulável: ${skipHits.join(',')}`).toEqual([]);
      expect(await classSnapshot(page, ids)).toEqual(before);
    } finally {
      await trail.attach(testInfo);
    }
  });

  test('elementos skip-* nunca casam :focus-visible durante o percurso', async ({
    page,
  }, testInfo) => {
    const trail = createTabTrail();
    try {
      await gotoAndSettle(page, ROUTE);
      await expect(page.getByTestId('tab-skip-ready')).toBeVisible();

      const ids = await focusableIds(page);

      await trail.init(page);
      for (let i = 0; i < ids.length + 2; i++) {
        await trail.tab(page, { expected: ids[i] ?? null });
      }

      // Nenhum SKIP_ID aparece com focusVisible=true em NENHUM passo.
      const leaks = trail.steps.filter(
        (s) => s.activeTestId && (SKIP_IDS as readonly string[]).includes(s.activeTestId) && s.focusVisible,
      );
      if (leaks.length > 0) {
        throw new Error(
          `elementos skip-* vazaram :focus-visible em ${leaks.length} passo(s): ` +
            leaks.map((s) => `#${s.index}=${s.activeTestId}`).join(', '),
        );
      }
    } finally {
      await trail.attach(testInfo);
    }
  });
});
