/**
 * E2E — Catálogo • Logout + Login no mesmo dia (PO rule)
 *
 * Cenário: usuário entra, vê o reset diário aplicado (grid / 6 col / newest),
 * customiza preferências (list / 3 col / price-asc), sai e volta a logar no
 * MESMO dia. Esperado:
 *  - A marca diária `catalog:daily-reset:last-date` continua igual a hoje.
 *  - As preferências customizadas são preservadas (ensureDailyCatalogDefaults
 *    é no-op no segundo acesso do dia).
 *
 * Observação importante: `logout()` em e2e/helpers/auth.ts faz
 * `localStorage.clear()`. Para isolar a regra de negócio (no-op no mesmo dia)
 * do efeito colateral do helper, restauramos as 4 chaves após o re-login e
 * antes de navegar para /produtos — exatamente o estado em que o navegador
 * estaria se o logout fosse feito apenas via UI (sem clear()).
 */
import { test, expect } from "../fixtures/test-base";
import { Sel } from "../fixtures/selectors";
import { loginAs, logout } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/nav";
import { waitForTestIdVisible } from "../helpers/waits";

const CATALOG_ROUTE = "/produtos";
const DAILY_RESET_KEY = "catalog:daily-reset:last-date";
const VIEW_MODE_KEY = "catalog-view-mode";
const COLUMNS_KEY = "product-grid-columns";
const SORT_SESSION_KEY = "catalog:sortBy";

function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

test.describe("Catálogo • Logout + login no mesmo dia preserva preferências", () => {
  test("primeiro login aplica defaults, segundo login mesmo dia preserva customização", async ({ page }) => {
    // 1) Primeiro login do dia
    await loginAs(page);

    // Garante "primeiro acesso do dia" limpando a marca.
    await gotoAndSettle(page, CATALOG_ROUTE);
    await page.evaluate(
      ({ daily }) => localStorage.removeItem(daily),
      { daily: DAILY_RESET_KEY },
    );
    await gotoAndSettle(page, CATALOG_ROUTE);
    await waitForTestIdVisible(page, "catalog-sort-trigger");

    const afterFirst = await page.evaluate(
      ({ daily, view, cols, sort }) => ({
        daily: localStorage.getItem(daily),
        view: localStorage.getItem(view),
        cols: localStorage.getItem(cols),
        sort: sessionStorage.getItem(sort),
      }),
      { daily: DAILY_RESET_KEY, view: VIEW_MODE_KEY, cols: COLUMNS_KEY, sort: SORT_SESSION_KEY },
    );
    expect(afterFirst.daily).toBe(todayKey());
    expect(afterFirst.view).toBe("grid");
    expect(afterFirst.cols).toBe("6");
    expect(afterFirst.sort === null || afterFirst.sort === "newest").toBe(true);

    // 2) Usuário customiza as preferências dentro do mesmo dia.
    await page.evaluate(
      ({ view, cols, sort }) => {
        localStorage.setItem(view, "list");
        localStorage.setItem(cols, "3");
        sessionStorage.setItem(sort, "price-asc");
      },
      { view: VIEW_MODE_KEY, cols: COLUMNS_KEY, sort: SORT_SESSION_KEY },
    );

    // 3) Logout — helper limpa storage (simula encerramento de sessão).
    await logout(page);

    // 4) Re-login no MESMO dia.
    await loginAs(page);

    // Restaura o que o navegador real teria se o usuário só tivesse deslogado
    // pela UI: marca diária de hoje + preferências customizadas.
    await gotoAndSettle(page, CATALOG_ROUTE);
    await page.evaluate(
      ({ daily, view, cols, sort, today }) => {
        localStorage.setItem(daily, today);
        localStorage.setItem(view, "list");
        localStorage.setItem(cols, "3");
        sessionStorage.setItem(sort, "price-asc");
      },
      {
        daily: DAILY_RESET_KEY,
        view: VIEW_MODE_KEY,
        cols: COLUMNS_KEY,
        sort: SORT_SESSION_KEY,
        today: todayKey(),
      },
    );

    // 5) Nova entrada no catálogo — ensureDailyCatalogDefaults deve ser no-op.
    await gotoAndSettle(page, CATALOG_ROUTE);
    await waitForTestIdVisible(page, "catalog-sort-trigger");

    const afterRelogin = await page.evaluate(
      ({ daily, view, cols, sort }) => ({
        daily: localStorage.getItem(daily),
        view: localStorage.getItem(view),
        cols: localStorage.getItem(cols),
        sort: sessionStorage.getItem(sort),
      }),
      { daily: DAILY_RESET_KEY, view: VIEW_MODE_KEY, cols: COLUMNS_KEY, sort: SORT_SESSION_KEY },
    );

    expect(afterRelogin.daily).toBe(todayKey());
    expect(afterRelogin.view).toBe("list");
    expect(afterRelogin.cols).toBe("3");
    expect(afterRelogin.sort).toBe("price-asc");

    // Sanity visual.
    await expect(page.locator(Sel.catalog.sortTrigger)).toBeVisible();
    await expect(page.locator('[data-testid="column-selector"]')).toBeVisible();
  });
});
