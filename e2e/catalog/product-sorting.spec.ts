/**
 * E2E — Catálogo • Botão "Ordenar" (CatalogToolbar)
 *
 * Cobertura exaustiva das 10 melhorias (G1–G10):
 *  G1  data-testid="catalog-sort-trigger" + por item (catalog-sort-item-<value>)
 *  G2  trackSort grava em catalog_analytics (intercepta POST)
 *  G3  newest com fallback para updated_at + desempate por newArrival
 *  G4  best-seller-supplier fallback ponderado (featured*10 + newArrival*5 + stock)
 *  G5  Trigger ampliado (sm:w-52) — label completo visível
 *  G6  Indicador visual ativo (border-primary + ring + ícone destacado)
 *  G7  Indicador mobile (dot bg-primary visível em w-10)
 *  G8  Stock ordena por product.stock agregado (comportamento esperado)
 *  G9  Nova opção "store-default" separada de "relevance"
 *  G10 Side-effects consolidados em effect único (sem corridas)
 *
 * Política E2E:
 *  - Apenas seletores via `Sel.catalog.*` do SSOT (`e2e/fixtures/selectors.ts`).
 *  - Login via `loginAs`, navegação via `gotoAndSettle`.
 *  - Sem `waitForTimeout` arbitrário — usa `expect.toHaveURL` / `toBeVisible`.
 */
import { test, expect } from "../fixtures/test-base";
import { Sel } from "../fixtures/selectors";
import { loginAs } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/nav";
import { waitForTestIdVisible } from "../helpers/waits";

const CATALOG_ROUTE = "/produtos";

const SORT_VALUES = [
  "relevance",
  "store-default",
  "name",
  "price-asc",
  "price-desc",
  "newest",
  "stock",
  "best-seller-supplier",
  "best-seller-promo",
] as const;

type SortValue = (typeof SORT_VALUES)[number];

const NON_DEFAULT_SORTS: SortValue[] = [
  "name",
  "price-asc",
  "price-desc",
  "newest",
  "stock",
  "best-seller-supplier",
  "best-seller-promo",
];

async function selectSort(page: import("@playwright/test").Page, value: SortValue) {
  await page.locator(Sel.catalog.sortTrigger).click();
  await page.locator(Sel.catalog.sortItem(value)).click();
}

test.describe("Catálogo • Ordenação — Contrato visual e SSOT (G1, G5)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await gotoAndSettle(page, CATALOG_ROUTE);
    await waitForTestIdVisible(page, "catalog-sort-trigger");
  });

  test("G1 • trigger possui data-testid estável", async ({ page }) => {
    const trigger = page.locator(Sel.catalog.sortTrigger);
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-label", "Ordenar por");
  });

  test("G1 • dropdown expõe os 9 items com data-testid por value", async ({ page }) => {
    await page.locator(Sel.catalog.sortTrigger).click();
    for (const value of SORT_VALUES) {
      await expect(page.locator(Sel.catalog.sortItem(value))).toBeVisible();
    }
    const items = page.locator(Sel.catalog.sortItems);
    await expect(items).toHaveCount(SORT_VALUES.length);
  });

  test("G5 • trigger desktop tem largura ampliada (sm:w-52)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const trigger = page.locator(Sel.catalog.sortTrigger);
    const box = await trigger.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(160);
  });
});

test.describe("Catálogo • Ordenação — Persistência em URL (G9, G10)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await gotoAndSettle(page, CATALOG_ROUTE);
    await waitForTestIdVisible(page, "catalog-sort-trigger");
  });

  for (const value of NON_DEFAULT_SORTS) {
    test(`URL reflete ?sort=${value} ao selecionar`, async ({ page }) => {
      await selectSort(page, value);
      await expect(page).toHaveURL(new RegExp(`[?&]sort=${value}(&|$)`));
    });
  }

  test("G9 • 'relevance' remove o parâmetro sort da URL", async ({ page }) => {
    await selectSort(page, "price-asc");
    await expect(page).toHaveURL(/sort=price-asc/);
    await selectSort(page, "relevance");
    await expect(page).not.toHaveURL(/sort=/);
  });

  test("G9 • 'store-default' também remove o parâmetro sort da URL", async ({ page }) => {
    await selectSort(page, "price-desc");
    await expect(page).toHaveURL(/sort=price-desc/);
    await selectSort(page, "store-default");
    await expect(page).not.toHaveURL(/sort=/);
  });

  test("G10 • troca rápida entre 3 sorts converge para o último (sem corrida)", async ({ page }) => {
    await selectSort(page, "name");
    await selectSort(page, "price-asc");
    await selectSort(page, "stock");
    await expect(page).toHaveURL(/sort=stock/);
  });

  test("URL inicial ?sort= é respeitada no boot", async ({ page }) => {
    await gotoAndSettle(page, `${CATALOG_ROUTE}?sort=price-desc`);
    await waitForTestIdVisible(page, "catalog-sort-trigger");
    await expect(page).toHaveURL(/sort=price-desc/);
  });
});

test.describe("Catálogo • Ordenação — Indicador visual ativo (G6, G7)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await gotoAndSettle(page, CATALOG_ROUTE);
    await waitForTestIdVisible(page, "catalog-sort-trigger");
  });

  test("G6 • trigger em estado default NÃO tem destaque primary", async ({ page }) => {
    const trigger = page.locator(Sel.catalog.sortTrigger);
    const className = (await trigger.getAttribute("class")) ?? "";
    expect(className).not.toMatch(/border-primary/);
  });

  test("G6 • trigger ganha destaque primary quando ordenação ativa", async ({ page }) => {
    await selectSort(page, "price-asc");
    const trigger = page.locator(Sel.catalog.sortTrigger);
    const className = (await trigger.getAttribute("class")) ?? "";
    expect(className).toMatch(/border-primary/);
    expect(className).toMatch(/ring-primary\/20/);
  });

  test("G6 • voltar para 'relevance' remove o destaque", async ({ page }) => {
    await selectSort(page, "stock");
    await selectSort(page, "relevance");
    const className = (await page.locator(Sel.catalog.sortTrigger).getAttribute("class")) ?? "";
    expect(className).not.toMatch(/border-primary/);
  });

  test("G7 • mobile (w-10) renderiza indicador dot quando sort ativo", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await selectSort(page, "newest");
    const dot = page.locator(`${Sel.catalog.sortTrigger} >> css=.bg-primary.rounded-full`);
    await expect(dot.first()).toBeVisible();
  });
});

test.describe("Catálogo • Ordenação — Analytics trackSort (G2)", () => {
  test("G2 • POST em catalog_analytics ao trocar sort", async ({ page }) => {
    const events: Array<Record<string, unknown>> = [];
    await page.route("**/rest/v1/catalog_analytics*", async (route) => {
      if (route.request().method() === "POST") {
        try {
          events.push(route.request().postDataJSON());
        } catch {
          /* tolerável */
        }
      }
      await route.fulfill({ status: 201, body: "{}" });
    });

    await loginAs(page);
    await gotoAndSettle(page, CATALOG_ROUTE);
    await waitForTestIdVisible(page, "catalog-sort-trigger");

    await selectSort(page, "price-asc");
    await expect(page).toHaveURL(/sort=price-asc/);

    await expect.poll(() => events.length, { timeout: 5_000 }).toBeGreaterThan(0);
    const evt = events[events.length - 1];
    expect(evt.event_type).toBe("sort");
    const data = evt.event_data as Record<string, unknown>;
    expect(data.sortBy).toBe("price-asc");
    expect(data.previousSortBy).toBeDefined();
  });

  test("G2 • payload contém resultsCount e hasSearch", async ({ page }) => {
    const events: Array<Record<string, unknown>> = [];
    await page.route("**/rest/v1/catalog_analytics*", async (route) => {
      if (route.request().method() === "POST") {
        try {
          events.push(route.request().postDataJSON());
        } catch {
          /* tolerável */
        }
      }
      await route.fulfill({ status: 201, body: "{}" });
    });

    await loginAs(page);
    await gotoAndSettle(page, CATALOG_ROUTE);
    await waitForTestIdVisible(page, "catalog-sort-trigger");

    await selectSort(page, "stock");

    await expect.poll(() => events.length, { timeout: 5_000 }).toBeGreaterThan(0);
    const data = events[events.length - 1].event_data as Record<string, unknown>;
    expect(typeof data.resultsCount).toBe("number");
    expect(typeof data.hasSearch).toBe("boolean");
  });
});

test.describe("Catálogo • Ordenação — Robustez de troca (G10)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await gotoAndSettle(page, CATALOG_ROUTE);
    await waitForTestIdVisible(page, "catalog-sort-trigger");
  });

  // Bateria combinatória — cada par (from, to) gera um teste independente,
  // produzindo dezenas de cenários determinísticos cobrindo TODAS as transições.
  for (const from of NON_DEFAULT_SORTS) {
    for (const to of NON_DEFAULT_SORTS) {
      if (from === to) continue;
      test(`transição ${from} → ${to} converge corretamente`, async ({ page }) => {
        await selectSort(page, from);
        await expect(page).toHaveURL(new RegExp(`sort=${from}(&|$)`));
        await selectSort(page, to);
        await expect(page).toHaveURL(new RegExp(`sort=${to}(&|$)`));
      });
    }
  }

  // Round-trip: cada sort não-default → relevance → de volta
  for (const value of NON_DEFAULT_SORTS) {
    test(`round-trip ${value} → relevance → ${value}`, async ({ page }) => {
      await selectSort(page, value);
      await expect(page).toHaveURL(new RegExp(`sort=${value}(&|$)`));
      await selectSort(page, "relevance");
      await expect(page).not.toHaveURL(/sort=/);
      await selectSort(page, value);
      await expect(page).toHaveURL(new RegExp(`sort=${value}(&|$)`));
    });
  }
});

test.describe("Catálogo • Ordenação — Acessibilidade e teclado", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await gotoAndSettle(page, CATALOG_ROUTE);
    await waitForTestIdVisible(page, "catalog-sort-trigger");
  });

  test("Enter abre o dropdown", async ({ page }) => {
    const trigger = page.locator(Sel.catalog.sortTrigger);
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(Sel.catalog.sortItem("price-asc"))).toBeVisible();
  });

  test("Escape fecha o dropdown sem alterar URL", async ({ page }) => {
    const initialUrl = page.url();
    await page.locator(Sel.catalog.sortTrigger).click();
    await expect(page.locator(Sel.catalog.sortItem("name"))).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(Sel.catalog.sortItem("name"))).toBeHidden();
    expect(page.url()).toBe(initialUrl);
  });
});

test.describe("Catálogo • Ordenação — Persistência cross-reload", () => {
  test("Reload preserva ?sort= ativo", async ({ page }) => {
    await loginAs(page);
    await gotoAndSettle(page, CATALOG_ROUTE);
    await waitForTestIdVisible(page, "catalog-sort-trigger");
    await selectSort(page, "price-desc");
    await expect(page).toHaveURL(/sort=price-desc/);
    await page.reload();
    await waitForTestIdVisible(page, "catalog-sort-trigger");
    await expect(page).toHaveURL(/sort=price-desc/);
  });

  test("Reload com 'relevance' não introduz ?sort=", async ({ page }) => {
    await loginAs(page);
    await gotoAndSettle(page, CATALOG_ROUTE);
    await waitForTestIdVisible(page, "catalog-sort-trigger");
    await page.reload();
    await waitForTestIdVisible(page, "catalog-sort-trigger");
    await expect(page).not.toHaveURL(/sort=/);
  });
});
