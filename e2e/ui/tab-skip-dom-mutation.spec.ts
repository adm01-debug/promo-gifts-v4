/**
 * E2E — Regressão de mutação DOM durante o loop de Tab.
 *
 * Em falha, o helper `createTabTrail` anexa a trilha completa
 * (`activeElement`, `:focus-visible`, className, boxShadow) ao relatório.
 */
import { test, expect, type Page } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';
import { createTabTrail } from '../helpers/tab-trail';

const ROUTE = '/__test/tab-skip';
const RING_CLASSES =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded border px-3 py-2';

async function focusableIds(page: Page): Promise<string[]> {
  const raw = await page.getByTestId('tab-skip-ready').getAttribute('data-focusable-ids');
  expect(raw).toBeTruthy();
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

async function insertAfter(page: Page, afterTestId: string, newTestId: string, cls: string) {
  await page.evaluate(
    ({ afterTestId, newTestId, cls }) => {
      const anchor = document.querySelector<HTMLElement>(`[data-testid="${afterTestId}"]`);
      if (!anchor?.parentElement) throw new Error(`anchor ${afterTestId} sem parent`);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-testid', newTestId);
      btn.setAttribute('data-injected', 'true');
      btn.className = cls;
      btn.textContent = newTestId;
      const wrapper = document.createElement('span');
      wrapper.setAttribute('data-node', newTestId);
      wrapper.appendChild(btn);
      anchor.closest('[data-node]')?.after(wrapper);
    },
    { afterTestId, newTestId, cls },
  );
}

async function removeByTestId(page: Page, testid: string) {
  await page.evaluate((t) => {
    const el = document.querySelector<HTMLElement>(`[data-testid="${t}"]`);
    const wrapper = el?.closest('[data-node]');
    (wrapper ?? el)?.remove();
  }, testid);
}

test.describe('Tab-skip — mutação DOM durante o loop preserva foco e rings', () => {
  test('inserir focável adjacente NÃO rouba foco; próximo Tab respeita nova ordem', async ({
    page,
  }, testInfo) => {
    const trail = createTabTrail();
    try {
      await gotoAndSettle(page, ROUTE);
      await expect(page.getByTestId('tab-skip-ready')).toBeVisible();

      const ids = await focusableIds(page);
      const before = await classSnapshot(page, ids);

      await trail.init(page);
      await trail.tab(page, { expected: 'focus-1' });
      await trail.tab(page, { expected: 'focus-2' });

      await insertAfter(page, 'focus-2', 'injected-a', RING_CLASSES);

      // Foco permanece em focus-2 mesmo após a inserção (não é um passo do trail).
      expect(await focusedTestId(page)).toBe('focus-2');
      expect(await classSnapshot(page, ids)).toEqual(before);

      await trail.tab(page, { expected: 'injected-a' });
      trail.assertVisited(['focus-1', 'focus-2', 'injected-a']);

      expect(await classSnapshot(page, ids)).toEqual(before);
    } finally {
      await trail.attach(testInfo);
    }
  });

  test('remover focável adjacente não congela nem regride o loop', async ({ page }, testInfo) => {
    const trail = createTabTrail();
    try {
      await gotoAndSettle(page, ROUTE);
      await expect(page.getByTestId('tab-skip-ready')).toBeVisible();

      const ids = await focusableIds(page);

      await trail.init(page);
      await trail.tab(page, { expected: 'focus-1' });
      await trail.tab(page, { expected: 'focus-2' });
      await trail.tab(page, { expected: 'focus-3' });

      await removeByTestId(page, 'focus-4');
      expect(await focusedTestId(page)).toBe('focus-3');

      await trail.tab(page, { expected: 'focus-5' });
      trail.assertVisited(['focus-1', 'focus-2', 'focus-3', 'focus-5']);

      const remaining = ids.filter((id) => id !== 'focus-4');
      const afterRemoval = await classSnapshot(page, remaining);
      for (const id of remaining) {
        expect(afterRemoval[id]).toMatch(/focus-visible:ring-primary/);
      }
    } finally {
      await trail.attach(testInfo);
    }
  });

  test('remover o elemento focado devolve foco ao body sem drift nos demais', async ({
    page,
  }, testInfo) => {
    const trail = createTabTrail();
    try {
      await gotoAndSettle(page, ROUTE);
      await expect(page.getByTestId('tab-skip-ready')).toBeVisible();

      const ids = await focusableIds(page);
      const before = await classSnapshot(page, ids);

      await trail.init(page);
      await trail.tab(page, { expected: 'focus-1' });
      await trail.tab(page, { expected: 'focus-2' });
      await trail.tab(page, { expected: 'focus-3' });

      await removeByTestId(page, 'focus-3');

      const active = await page.evaluate(
        () => document.activeElement?.tagName?.toLowerCase() ?? null,
      );
      expect(active).toBe('body');

      const remaining = ids.filter((id) => id !== 'focus-3');
      const afterSnap = await classSnapshot(page, remaining);
      for (const id of remaining) {
        expect(afterSnap[id]).toBe(before[id]);
      }

      await trail.tab(page, { expected: 'focus-1' });
      trail.assertVisited(['focus-1', 'focus-2', 'focus-3', 'focus-1']);
    } finally {
      await trail.attach(testInfo);
    }
  });

  test('mutação em massa preserva foco e rings dos sobreviventes', async ({
    page,
  }, testInfo) => {
    const trail = createTabTrail();
    try {
      await gotoAndSettle(page, ROUTE);
      await expect(page.getByTestId('tab-skip-ready')).toBeVisible();

      const ids = await focusableIds(page);
      const survivors = ids.filter((id) => id !== 'focus-6' && id !== 'focus-7');
      const beforeSurvivors = await classSnapshot(page, survivors);

      await trail.init(page);
      await trail.tab(page, { expected: 'focus-1' });
      await trail.tab(page, { expected: 'focus-2' });

      await insertAfter(page, 'focus-1', 'injected-x1', RING_CLASSES);
      await removeByTestId(page, 'focus-6');
      await insertAfter(page, 'focus-5', 'injected-x2', RING_CLASSES);
      await removeByTestId(page, 'focus-7');

      expect(await focusedTestId(page)).toBe('focus-2');
      expect(await classSnapshot(page, survivors)).toEqual(beforeSurvivors);

      await trail.tab(page, { expected: 'focus-3' });
      await trail.tab(page, { expected: 'focus-4' });
      await trail.tab(page, { expected: 'focus-5' });
      await trail.tab(page, { expected: 'injected-x2' });

      trail.assertVisited([
        'focus-1',
        'focus-2',
        'focus-3',
        'focus-4',
        'focus-5',
        'injected-x2',
      ]);
    } finally {
      await trail.attach(testInfo);
    }
  });
});
