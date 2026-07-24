/**
 * E2E — Catálogo • Primeiro login do dia (PO rule)
 *
 * Regra: no primeiro acesso DO DIA ao catálogo, os defaults são restaurados:
 *  - viewMode  → 'grid'      (localStorage `catalog-view-mode`)
 *  - colunas   → 6           (localStorage `product-grid-columns`)
 *  - sortBy    → 'newest'    (sessionStorage `catalog:sortBy` limpo → hook cai em 'newest')
 *  - marca em localStorage `catalog:daily-reset:last-date` = YYYY-MM-DD de hoje
 *
 * Implementação em src/hooks/products/dailyCatalogDefaults.ts.
 * Este spec simula o "primeiro acesso do dia" limpando as 3 chaves ANTES da
 * navegação para /produtos e verifica o efeito colateral idempotente do reset.
 *
 * Política E2E: seletores SSOT (Sel.catalog.sortTrigger), login via loginAs,
 * navegação via gotoAndSettle — sem waitForTimeout.
 */
import { test, expect } from "../fixtures/test-base";
import { Sel } from "../fixtures/selectors";
import { loginAs } from "../helpers/auth";
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

test.describe("Catálogo • Primeiro acesso do dia restaura defaults (grid 6 col + Mais recentes)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test("simula primeiro login do dia: aplica grid, 6 colunas e ordenação 'newest'", async ({ page }) => {
    // Simula estado "sujo" de outro dia: usuário tinha list/2cols/price-asc.
    await gotoAndSettle(page, CATALOG_ROUTE);
    await page.evaluate(
      ({ daily, view, cols, sort }) => {
        try {
          localStorage.setItem(view, "list");
          localStorage.setItem(cols, "2");
          sessionStorage.setItem(sort, "price-asc");
          localStorage.removeItem(daily); // garante "primeiro acesso do dia"
        } catch {
          /* noop */
        }
      },
      { daily: DAILY_RESET_KEY, view: VIEW_MODE_KEY, cols: COLUMNS_KEY, sort: SORT_SESSION_KEY },
    );

    // Re-navega — ensureDailyCatalogDefaults roda no mount do useCatalogState.
    await gotoAndSettle(page, CATALOG_ROUTE);
    await waitForTestIdVisible(page, "catalog-sort-trigger");

    // Asserts deterministas via storage (SSOT do hook).
    const snapshot = await page.evaluate(
      ({ daily, view, cols, sort }) => ({
        daily: localStorage.getItem(daily),
        view: localStorage.getItem(view),
        cols: localStorage.getItem(cols),
        sort: sessionStorage.getItem(sort),
      }),
      { daily: DAILY_RESET_KEY, view: VIEW_MODE_KEY, cols: COLUMNS_KEY, sort: SORT_SESSION_KEY },
    );

    expect(snapshot.daily).toBe(todayKey());
    expect(snapshot.view).toBe("grid");
    expect(snapshot.cols).toBe("6");
    // sortBy de sessão é limpo → hook cai em 'newest' (default).
    expect(snapshot.sort === null || snapshot.sort === "newest").toBe(true);

    // Sanity visual: trigger de ordenação está montado e seletor de colunas visível.
    await expect(page.locator(Sel.catalog.sortTrigger)).toBeVisible();
    await expect(page.locator('[data-testid="column-selector"]')).toBeVisible();
  });

  test("segundo acesso no mesmo dia preserva preferências do usuário (no-op)", async ({ page }) => {
    await gotoAndSettle(page, CATALOG_ROUTE);

    // Marca como já resetado hoje + define preferências customizadas.
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

    await gotoAndSettle(page, CATALOG_ROUTE);
    await waitForTestIdVisible(page, "catalog-sort-trigger");

    const snapshot = await page.evaluate(
      ({ view, cols, sort }) => ({
        view: localStorage.getItem(view),
        cols: localStorage.getItem(cols),
        sort: sessionStorage.getItem(sort),
      }),
      { view: VIEW_MODE_KEY, cols: COLUMNS_KEY, sort: SORT_SESSION_KEY },
    );

    expect(snapshot.view).toBe("list");
    expect(snapshot.cols).toBe("3");
    expect(snapshot.sort).toBe("price-asc");
  });
});
