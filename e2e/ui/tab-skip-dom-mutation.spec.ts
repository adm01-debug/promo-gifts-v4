/**
 * E2E — Regressão de mutação DOM durante o loop de Tab.
 *
 * Insere e remove elementos focáveis no meio do percurso de Tab e verifica:
 *  M1) O elemento atualmente focado NÃO perde o foco quando um irmão é
 *      adicionado ou removido em outro ponto do documento.
 *  M2) O `className` (ring declarativo) de TODOS os focáveis pré-existentes
 *      permanece idêntico ao snapshot capturado antes da mutação — não há
 *      efeito colateral de mutação DOM sobre o ring dos vizinhos.
 *  M3) Após a inserção, o próximo Tab visita o elemento recém-inserido na
 *      posição correta da ordem tab natural (source order).
 *  M4) Após a remoção do focável ADJACENTE ao atual, o próximo Tab pula
 *      diretamente para o subsequente sem regressar nem congelar.
 *  M5) Remover o próprio elemento focado devolve o foco a `document.body`
 *      (comportamento padrão do navegador) — o loop continua no próximo Tab
 *      e nenhum outro elemento tem seu className mutado por consequência.
 *
 * Harness: `/__test/tab-skip` (sem auth, DOM manipulado via `page.evaluate`
 * para não conflitar com o reconciler do React).
 */
import { test, expect, type Page } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

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

/** Insere um <button> focável logo APÓS o elemento com o testid indicado. */
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
      // Espelha o padrão do harness: cada nó vive dentro de um <span data-node>.
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
  test('M1+M2+M3 — inserir focável adjacente NÃO rouba foco nem muta rings; próximo Tab respeita a nova ordem', async ({
    page,
  }) => {
    await gotoAndSettle(page, ROUTE);
    await expect(page.getByTestId('tab-skip-ready')).toBeVisible();

    const ids = await focusableIds(page);
    const before = await classSnapshot(page, ids);

    // Foca `focus-2` (2 Tabs — o loop pula os "skip-*" naturalmente).
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    expect(await focusedTestId(page)).toBe('focus-2');

    // Injeta um focável logo após focus-2, ANTES do próximo Tab.
    await insertAfter(page, 'focus-2', 'injected-a', RING_CLASSES);

    // M1: foco permanece em focus-2.
    expect(await focusedTestId(page)).toBe('focus-2');

    // M2: nenhum className pré-existente foi mutado.
    expect(await classSnapshot(page, ids)).toEqual(before);

    // M3: o próximo Tab visita o elemento recém-inserido.
    await page.keyboard.press('Tab');
    expect(await focusedTestId(page)).toBe('injected-a');

    // Snapshot dos pré-existentes CONTINUA idêntico após o foco migrar.
    expect(await classSnapshot(page, ids)).toEqual(before);
  });

  test('M4 — remover focável adjacente ao atual não congela nem regride o loop', async ({
    page,
  }) => {
    await gotoAndSettle(page, ROUTE);
    await expect(page.getByTestId('tab-skip-ready')).toBeVisible();

    const ids = await focusableIds(page);

    // Foca focus-3.
    for (let i = 0; i < 3; i++) await page.keyboard.press('Tab');
    expect(await focusedTestId(page)).toBe('focus-3');

    // Remove focus-4 (adjacente subsequente).
    await removeByTestId(page, 'focus-4');

    // Foco permanece em focus-3.
    expect(await focusedTestId(page)).toBe('focus-3');

    // Snapshot dos remanescentes: className preservado.
    const remaining = ids.filter((id) => id !== 'focus-4');
    const afterRemoval = await classSnapshot(page, remaining);
    for (const id of remaining) {
      expect(afterRemoval[id]).toMatch(/focus-visible:ring-primary/);
    }

    // Próximo Tab pula focus-4 (removido) e vai direto para focus-5.
    await page.keyboard.press('Tab');
    expect(await focusedTestId(page)).toBe('focus-5');
  });

  test('M5 — remover o elemento focado devolve foco ao body sem drift nos demais', async ({
    page,
  }) => {
    await gotoAndSettle(page, ROUTE);
    await expect(page.getByTestId('tab-skip-ready')).toBeVisible();

    const ids = await focusableIds(page);
    const before = await classSnapshot(page, ids);

    // Foca focus-3.
    for (let i = 0; i < 3; i++) await page.keyboard.press('Tab');
    expect(await focusedTestId(page)).toBe('focus-3');

    // Remove o próprio elemento focado.
    await removeByTestId(page, 'focus-3');

    // Foco cai em body (comportamento padrão do navegador).
    const active = await page.evaluate(() => document.activeElement?.tagName?.toLowerCase() ?? null);
    expect(active).toBe('body');

    // Nenhum outro focável teve className mutado.
    const remaining = ids.filter((id) => id !== 'focus-3');
    const afterSnap = await classSnapshot(page, remaining);
    for (const id of remaining) {
      expect(afterSnap[id]).toBe(before[id]);
    }

    // Próximo Tab retoma o loop a partir do primeiro focável do documento.
    await page.keyboard.press('Tab');
    expect(await focusedTestId(page)).toBe('focus-1');
  });

  test('mutação em massa (add + remove intercalados) preserva foco e rings dos sobreviventes', async ({
    page,
  }) => {
    await gotoAndSettle(page, ROUTE);
    await expect(page.getByTestId('tab-skip-ready')).toBeVisible();

    const ids = await focusableIds(page);
    const survivors = ids.filter((id) => id !== 'focus-6' && id !== 'focus-7');
    const beforeSurvivors = await classSnapshot(page, survivors);

    // Foca focus-2.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    expect(await focusedTestId(page)).toBe('focus-2');

    // Add + remove em 4 pontos distintos do documento, sem re-focar nada.
    await insertAfter(page, 'focus-1', 'injected-x1', RING_CLASSES);
    await removeByTestId(page, 'focus-6');
    await insertAfter(page, 'focus-5', 'injected-x2', RING_CLASSES);
    await removeByTestId(page, 'focus-7');

    // Foco continua em focus-2 (nenhuma mutação tocou o elemento ativo).
    expect(await focusedTestId(page)).toBe('focus-2');

    // Sobreviventes mantêm className.
    expect(await classSnapshot(page, survivors)).toEqual(beforeSurvivors);

    // Loop continua consistente — os próximos Tabs visitam a nova ordem
    // sem parar em nenhum "skip-*" nem em nós removidos.
    const visited: string[] = [];
    const skipIds = new Set([
      'skip-disabled',
      'skip-aria-disabled',
      'skip-hidden',
      'skip-display-none',
      'skip-visibility-hidden',
      'skip-inert-child',
      'skip-offscreen',
      'focus-6',
      'focus-7',
    ]);
    for (let i = 0; i < 10 && visited.length < 4; i++) {
      await page.keyboard.press('Tab');
      const id = await focusedTestId(page);
      if (!id) continue;
      expect(skipIds.has(id), `Tab pousou em elemento inválido: ${id}`).toBe(false);
      if (visited[visited.length - 1] !== id) visited.push(id);
    }

    // Esperado: focus-3, focus-4, focus-5, injected-x2 (nessa ordem).
    expect(visited.slice(0, 4)).toEqual(['focus-3', 'focus-4', 'focus-5', 'injected-x2']);
  });
});
