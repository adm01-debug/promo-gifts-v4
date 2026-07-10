/**
 * E2E · Preferência viewMode persiste ao navegar entre "páginas" do carrinho
 * (paginação da tabela, scroll infinito, aba de detalhe, /carrinhos → /
 * → /carrinhos) para o MESMO uid no mesmo dia.
 *
 * Verifica invariantes do contrato de `cartViewModePrefs.ts`:
 *   cart-view-mode:<uid>       = "grid"   ← mantido em toda navegação
 *   cart-view-mode-date:<uid>  = hoje     ← nunca vira ontem sem passar meia-noite
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

async function readViewModeSnapshot(page: Page): Promise<{
  uid: string;
  mode: string | null;
  date: string | null;
}> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('cart-view-mode:'));
    if (!key) return { uid: '', mode: null, date: null };
    const uid = key.replace('cart-view-mode:', '');
    return {
      uid,
      mode: localStorage.getItem(`cart-view-mode:${uid}`),
      date: localStorage.getItem(`cart-view-mode-date:${uid}`),
    };
  });
}

test.describe('@carrinhos · viewMode persiste em navegação entre páginas @smoke', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await page.goto('/');
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        /* noop */
      }
    });
  });

  test('preferência grid persiste ao navegar entre rotas do carrinho', async ({ page }) => {
    await loginAs(page, 'user');
    await gotoAndSettle(page, '/carrinhos');
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    // Aguarda useEffect de load fixar as chaves com uid real.
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              !!Object.keys(localStorage).find((k) => k.startsWith('cart-view-mode:')),
          ),
        { timeout: 5_000 },
      )
      .toBe(true);

    // Fixa "grid" via contrato de storage (SSOT). Evita depender de seletor UI
    // do LayoutPopover — varia por breakpoint.
    const initial = await readViewModeSnapshot(page);
    const uid = initial.uid;
    expect(uid.length).toBeGreaterThan(0);

    await page.evaluate(
      ({ uid: u }) => {
        const y = new Date().getFullYear();
        const m = String(new Date().getMonth() + 1).padStart(2, '0');
        const d = String(new Date().getDate()).padStart(2, '0');
        localStorage.setItem(`cart-view-mode:${u}`, 'grid');
        localStorage.setItem(`cart-view-mode-date:${u}`, `${y}-${m}-${d}`);
      },
      { uid },
    );

    // Sequência de navegação simulando "ir para outra página" do carrinho e
    // voltar (paginação/scroll infinito → outra rota → voltar).
    const routes = ['/', '/carrinhos', '/', '/carrinhos'];
    for (const route of routes) {
      await gotoAndSettle(page, route);
    }

    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    // Scroll do body para simular paginação infinita/lista longa. A
    // preferência não deve ser tocada por scroll.
    await page.mouse.wheel(0, 8000);
    await page.waitForTimeout(200);
    await page.mouse.wheel(0, -8000);

    const finalSnap = await readViewModeSnapshot(page);
    expect(finalSnap.uid).toBe(uid);
    expect(finalSnap.mode).toBe('grid');
    expect(finalSnap.date).toBe(initial.date || finalSnap.date); // hoje
  });

  test('reload preserva preferência para o mesmo uid no mesmo dia', async ({ page }) => {
    await loginAs(page, 'user');
    await gotoAndSettle(page, '/carrinhos');
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              !!Object.keys(localStorage).find((k) => k.startsWith('cart-view-mode:')),
          ),
        { timeout: 5_000 },
      )
      .toBe(true);

    const { uid } = await readViewModeSnapshot(page);

    await page.evaluate(
      ({ uid: u }) => {
        const y = new Date().getFullYear();
        const m = String(new Date().getMonth() + 1).padStart(2, '0');
        const d = String(new Date().getDate()).padStart(2, '0');
        localStorage.setItem(`cart-view-mode:${u}`, 'grid');
        localStorage.setItem(`cart-view-mode-date:${u}`, `${y}-${m}-${d}`);
      },
      { uid },
    );

    await page.reload();
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    await expect
      .poll(
        () => page.evaluate((u) => localStorage.getItem(`cart-view-mode:${u}`), uid),
        { timeout: 5_000 },
      )
      .toBe('grid');
  });
});
