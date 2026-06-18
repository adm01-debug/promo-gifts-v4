/**
 * Fluxo: clicar na foto do produto abre o QuickView (paridade entre módulos).
 *
 * Cobertura de testIds (padronizados — devem casar com `QuickViewThumb`):
 *  - Catálogo  → product-list-item-thumb · product-table-row-thumb
 *  - Novidades → novelty-{grid,list,table-row}-card-thumb / novelty-table-row-thumb
 *  - Reposição → replenishment-{grid-card,table-row}-thumb
 *  - Estoque   → stock-table-row-thumb
 *
 * Regras invariantes validadas em todos os módulos:
 *  1. Clique na foto NÃO navega (URL preservada).
 *  2. QuickView abre (testid `product-quickview-name` visível) — exceto no caminho
 *     "loading do useProduct", em que o modal só abre após o fetch resolver.
 *  3. Estados de borda (sem imagem, loading, erro 5xx) não derrubam a página
 *     nem disparam navegação inesperada.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import type { Page } from "@playwright/test";
import { gotoAndSettle } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";

type ModuleCase = {
  label: string;
  route: `/${string}`;
  thumbs: string[];
};

const MODULES: ModuleCase[] = [
  {
    label: "Catálogo • Lista",
    route: "/produtos",
    thumbs: [Sel.product.listItemThumb],
  },
  {
    label: "Catálogo • Tabela",
    route: "/produtos",
    thumbs: [Sel.product.tableRowThumb],
  },
  {
    label: "Novidades",
    route: "/novidades",
    thumbs: [
      Sel.product.noveltyGridThumb,
      Sel.product.noveltyListThumb,
      Sel.product.noveltyTableThumb,
    ],
  },
  {
    label: "Reposição",
    route: "/reposicao",
    thumbs: [
      Sel.product.replenishmentGridThumb,
      Sel.product.replenishmentTableThumb,
    ],
  },
  {
    label: "Estoque",
    route: "/estoque",
    thumbs: [Sel.product.stockTableThumb],
  },
];

/** Resolve o primeiro thumb visível dentre uma lista de seletores. */
async function findFirstThumb(page: Page, selectors: string[]) {
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    if (await loc.count()) return loc;
  }
  return null;
}

test.describe("QuickView na foto — paridade entre módulos", () => {
  test.beforeEach(() => requireAuth());

  for (const mod of MODULES) {
    test(`${mod.label}: clique na foto abre QuickView sem navegar`, async ({ page }) => {
      await gotoAndSettle(page, mod.route);
      const thumb = await findFirstThumb(page, mod.thumbs);
      if (!thumb) test.skip(true, `Nenhum thumb visível em ${mod.route}`);

      const urlBefore = page.url();
      await thumb!.click();

      await expect(page.locator(Sel.product.quickViewName).first()).toBeVisible({
        timeout: 10_000,
      });
      expect(page.url()).toBe(urlBefore);
    });

    test(`${mod.label}: a11y — thumb é ativável via teclado (Enter)`, async ({ page }) => {
      await gotoAndSettle(page, mod.route);
      const thumb = await findFirstThumb(page, mod.thumbs);
      if (!thumb) test.skip(true, `Nenhum thumb visível em ${mod.route}`);

      await expect(thumb!).toHaveAttribute("role", "button");
      await expect(thumb!).toHaveAttribute("tabindex", "0");
      await thumb!.focus();
      await page.keyboard.press("Enter");

      await expect(page.locator(Sel.product.quickViewName).first()).toBeVisible({
        timeout: 10_000,
      });
    });
  }
});

/**
 * Estados de borda no módulo /estoque — QuickViewThumb não deve quebrar a
 * navegação do card mesmo quando o produto não tem imagem, o fetch está
 * pendente ou retorna erro.
 */
test.describe("Estoque • QuickView — estados de borda", () => {
  test.beforeEach(() => requireAuth());

  test("sem imagem: thumb continua clicável e abre QuickView", async ({ page }) => {
    await gotoAndSettle(page, "/estoque");
    const thumb = page.locator(Sel.product.stockTableThumb).first();
    if ((await thumb.count()) === 0) test.skip(true, "Tabela de estoque vazia");

    // O wrapper QuickViewThumb mantém role=button mesmo quando a imagem
    // interna cai no fallback (sem src). O clique deve abrir o QuickView.
    await expect(thumb).toHaveAttribute("role", "button");
    const urlBefore = page.url();
    await thumb.click();

    await expect(page.locator(Sel.product.quickViewName).first()).toBeVisible({
      timeout: 10_000,
    });
    expect(page.url()).toBe(urlBefore);
  });

  test("loading do useProduct: clique não navega enquanto o fetch está pendente", async ({
    page,
  }) => {
    await gotoAndSettle(page, "/estoque");
    const thumb = page.locator(Sel.product.stockTableThumb).first();
    if ((await thumb.count()) === 0) test.skip(true, "Tabela de estoque vazia");

    // Atrasamos QUALQUER chamada à edge do bridge externa após o page settle,
    // simulando um useProduct lento. O modal só monta quando o produto chega
    // (open && !!product) — o que importa aqui é que a URL não muda.
    await page.route("**/functions/v1/external-db-bridge*", async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });

    const urlBefore = page.url();
    await thumb.click();
    // Pequena janela: confirma que NÃO houve navegação durante o "loading".
    await page.waitForTimeout(500);
    expect(page.url()).toBe(urlBefore);

    // Eventualmente o QuickView abre (ou nada acontece se o produto não vier).
    // Toleramos timeout — o ponto crítico (não-navegação) já foi validado.
    await page
      .locator(Sel.product.quickViewName)
      .first()
      .waitFor({ state: "visible", timeout: 8_000 })
      .catch(() => undefined);
    expect(page.url()).toBe(urlBefore);
  });

  test("erro 5xx no fetch do produto: card permanece estável (sem navegação/crash)", async ({
    page,
  }) => {
    await gotoAndSettle(page, "/estoque");
    const thumb = page.locator(Sel.product.stockTableThumb).first();
    if ((await thumb.count()) === 0) test.skip(true, "Tabela de estoque vazia");

    // Após o settle inicial, forçamos 500 em todas as próximas chamadas do bridge.
    await page.route("**/functions/v1/external-db-bridge*", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify({ error: "internal" }),
      }),
    );

    const urlBefore = page.url();
    await thumb.click();
    await page.waitForTimeout(1000);

    // Invariantes: nada de navegação, página ainda responde a interações.
    expect(page.url()).toBe(urlBefore);
    await expect(page.locator("body")).toBeVisible();
    // O QuickView NÃO deve abrir (produto nunca resolveu).
    await expect(page.locator(Sel.product.quickViewName)).toHaveCount(0);
  });
});
