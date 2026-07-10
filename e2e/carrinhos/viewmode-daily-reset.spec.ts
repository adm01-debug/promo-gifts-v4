/**
 * E2E · Reset diário + persistência do viewMode dos carrinhos.
 *
 * Contrato validado (SSOT em `src/pages/products/seller-carts/cartViewModePrefs.ts`):
 *  - Primeiro acesso do dia: viewMode reseta para "list".
 *  - Enquanto conectado no mesmo dia: a escolha do usuário é preservada.
 *  - Namespacing por uid: chaves `cart-view-mode:<uid>` e `cart-view-mode-date:<uid>`.
 *  - Reset é acionado quando a data persistida != data local corrente.
 *
 * Estratégia: em vez de esperar 24h reais, manipulamos a chave de data
 * persistida em `localStorage` para simular "ontem" e recarregamos a rota.
 * Isso é o mesmo mecanismo que o código de produção usa para decidir reset.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

test.describe('@carrinhos · viewMode reset diário + persistência @smoke', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await page.goto('/');
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        /* noop — Safari Private, etc. */
      }
    });
  });

  test('primeiro acesso do dia grava "list" com a data local corrente', async ({ page }) => {
    await loginAs(page, 'user');
    await gotoAndSettle(page, '/carrinhos');
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    // O useEffect de load é assíncrono (depende do uid) — poll até 5s.
    const state = await expect
      .poll(
        () =>
          page.evaluate(() => {
            const keys = Object.keys(localStorage).filter((k) =>
              k.startsWith('cart-view-mode'),
            );
            const uidKey = keys.find((k) => k.startsWith('cart-view-mode:'));
            const dateKey = keys.find((k) => k.startsWith('cart-view-mode-date:'));
            if (!uidKey || !dateKey) return null;
            return {
              mode: localStorage.getItem(uidKey),
              date: localStorage.getItem(dateKey),
              uid: uidKey.replace('cart-view-mode:', ''),
            };
          }),
        { timeout: 5_000 },
      )
      .not.toBeNull();

    const snapshot = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      const uidKey = keys.find((k) => k.startsWith('cart-view-mode:'))!;
      const dateKey = keys.find((k) => k.startsWith('cart-view-mode-date:'))!;
      const y = new Date().getFullYear();
      const m = String(new Date().getMonth() + 1).padStart(2, '0');
      const d = String(new Date().getDate()).padStart(2, '0');
      return {
        mode: localStorage.getItem(uidKey),
        date: localStorage.getItem(dateKey),
        expectedDate: `${y}-${m}-${d}`,
      };
    });

    expect(snapshot.mode).toBe('list');
    expect(snapshot.date).toBe(snapshot.expectedDate);
  });

  test('preferência escolhida persiste entre navegações no mesmo dia (mesmo uid)', async ({
    page,
  }) => {
    await loginAs(page, 'user');
    await gotoAndSettle(page, '/carrinhos');
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    // Aguarda o useEffect de load fixar as chaves.
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

    // Força "grid" via storage (canal público do contrato — mesmo modo que
    // o componente usa para persistir). Isso evita depender de seletor UI
    // do LayoutPopover, que varia por breakpoint.
    const uid = await page.evaluate(() => {
      const key = Object.keys(localStorage).find((k) =>
        k.startsWith('cart-view-mode:'),
      )!;
      return key.replace('cart-view-mode:', '');
    });

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

    // Navega para outra área e volta — a preferência deve permanecer.
    await gotoAndSettle(page, '/');
    await gotoAndSettle(page, '/carrinhos');
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    await expect
      .poll(
        () => page.evaluate((u) => localStorage.getItem(`cart-view-mode:${u}`), uid),
        { timeout: 5_000 },
      )
      .toBe('grid');

    // Recarrega — deve continuar "grid" (mesmo dia).
    await page.reload();
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();
    await expect
      .poll(
        () => page.evaluate((u) => localStorage.getItem(`cart-view-mode:${u}`), uid),
        { timeout: 5_000 },
      )
      .toBe('grid');
  });

  test('simulando "ontem", o próximo carregamento reseta para "list"', async ({
    page,
  }) => {
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

    const uid = await page.evaluate(() => {
      const key = Object.keys(localStorage).find((k) =>
        k.startsWith('cart-view-mode:'),
      )!;
      return key.replace('cart-view-mode:', '');
    });

    // Fixa preferência do usuário = "grid" com data = ONTEM.
    await page.evaluate(
      ({ uid: u }) => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const y = yesterday.getFullYear();
        const m = String(yesterday.getMonth() + 1).padStart(2, '0');
        const d = String(yesterday.getDate()).padStart(2, '0');
        localStorage.setItem(`cart-view-mode:${u}`, 'grid');
        localStorage.setItem(`cart-view-mode-date:${u}`, `${y}-${m}-${d}`);
      },
      { uid },
    );

    // Recarrega a rota — o useEffect deve rodar o loadCartViewMode e resetar.
    await page.reload();
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    await expect
      .poll(
        () =>
          page.evaluate((u) => {
            const y = new Date().getFullYear();
            const m = String(new Date().getMonth() + 1).padStart(2, '0');
            const d = String(new Date().getDate()).padStart(2, '0');
            return {
              mode: localStorage.getItem(`cart-view-mode:${u}`),
              date: localStorage.getItem(`cart-view-mode-date:${u}`),
              today: `${y}-${m}-${d}`,
            };
          }, uid),
        { timeout: 5_000 },
      )
      .toEqual({ mode: 'list', date: expect.any(String), today: expect.any(String) });

    const finalSnap = await page.evaluate((u) => {
      const y = new Date().getFullYear();
      const m = String(new Date().getMonth() + 1).padStart(2, '0');
      const d = String(new Date().getDate()).padStart(2, '0');
      return {
        mode: localStorage.getItem(`cart-view-mode:${u}`),
        date: localStorage.getItem(`cart-view-mode-date:${u}`),
        today: `${y}-${m}-${d}`,
      };
    }, uid);
    expect(finalSnap.mode).toBe('list');
    expect(finalSnap.date).toBe(finalSnap.today);
  });
});
