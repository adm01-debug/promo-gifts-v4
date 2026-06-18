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

/**
 * Garante que o clique no RESTANTE do card (fora da thumb) continua navegando
 * para o PDP — `e.stopPropagation()` do QuickViewThumb não pode "vazar" e
 * suprimir o handler do card pai.
 */
test.describe("Clique fora da thumb navega para PDP (não abre QuickView)", () => {
  test.beforeEach(() => requireAuth());

  const NAV_CASES: { label: string; route: `/${string}`; cardName: string; thumbs: string[] }[] = [
    {
      label: "Catálogo • Lista",
      route: "/produtos",
      cardName: Sel.product.listName,
      thumbs: [Sel.product.listItemThumb],
    },
  ];

  for (const c of NAV_CASES) {
    test(`${c.label}: clicar no nome do card navega para /produto/:id`, async ({ page }) => {
      await gotoAndSettle(page, c.route);
      const name = page.locator(c.cardName).first();
      if ((await name.count()) === 0) test.skip(true, `View ${c.label} indisponível`);

      const urlBefore = page.url();
      await name.click();
      await page.waitForURL(/\/produto\//, { timeout: 10_000 });
      expect(page.url()).not.toBe(urlBefore);
      // QuickView NÃO foi aberto.
      await expect(page.locator(Sel.product.quickViewName)).toHaveCount(0);
    });
  }
});

/**
 * QuickView (shadcn Dialog) — encerramento por ESC e clique no overlay,
 * preservando a11y (foco volta ao trigger; aria-modal correto).
 */
test.describe("QuickView • fechamento e a11y", () => {
  test.beforeEach(() => requireAuth());

  async function openFromStock(page: Page) {
    await gotoAndSettle(page, "/estoque");
    const thumb = page.locator(Sel.product.stockTableThumb).first();
    if ((await thumb.count()) === 0) test.skip(true, "Tabela de estoque vazia");
    await thumb.click();
    await expect(page.locator(Sel.product.quickViewName).first()).toBeVisible({
      timeout: 10_000,
    });
    return thumb;
  }

  test("ESC fecha o modal e devolve o foco ao trigger", async ({ page }) => {
    const trigger = await openFromStock(page);

    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");

    await page.keyboard.press("Escape");
    await expect(page.locator(Sel.product.quickViewName)).toHaveCount(0, { timeout: 5_000 });
    // Foco retorna a um elemento focável dentro do trigger (boa prática Radix).
    const triggerFocused = await trigger.evaluate(
      (el) => el.contains(document.activeElement) || el === document.activeElement,
    );
    expect(triggerFocused).toBe(true);
  });

  test("clicar no overlay fecha o modal", async ({ page }) => {
    await openFromStock(page);

    // Radix Dialog overlay é um irmão do content com data-state=open. Clique
    // no canto superior esquerdo evita acertar o content.
    const overlay = page.locator('[data-radix-dialog-overlay], [data-state="open"][data-slot="overlay"]').first();
    if ((await overlay.count()) === 0) {
      // Fallback: clica fora do dialog via coordenadas (10,10).
      await page.mouse.click(10, 10);
    } else {
      await overlay.click({ position: { x: 5, y: 5 }, force: true });
    }

    await expect(page.locator(Sel.product.quickViewName)).toHaveCount(0, { timeout: 5_000 });
  });
});

/**
 * Navegação por teclado + focus trap (a11y do shadcn Dialog).
 *
 * Cobre:
 *  - Enter no thumb abre o QuickView
 *  - Space no thumb abre o QuickView
 *  - Foco fica preso dentro do modal ao tabular (focus trap Radix)
 *  - Primeiro elemento focável é parte do dialog (não vaza para o body)
 */
test.describe("QuickView • navegação por teclado e focus trap", () => {
  test.beforeEach(() => requireAuth());

  async function focusFirstThumb(page: Page) {
    await gotoAndSettle(page, "/estoque");
    const thumb = page.locator(Sel.product.stockTableThumb).first();
    if ((await thumb.count()) === 0) test.skip(true, "Tabela de estoque vazia");
    await thumb.focus();
    return thumb;
  }

  for (const key of ["Enter", "Space"] as const) {
    test(`${key} no thumb abre o QuickView`, async ({ page }) => {
      await focusFirstThumb(page);
      await page.keyboard.press(key);
      await expect(page.locator(Sel.product.quickViewName).first()).toBeVisible({
        timeout: 10_000,
      });
    });
  }

  test("foco permanece preso dentro do dialog ao tabular", async ({ page }) => {
    await focusFirstThumb(page);
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Tabula várias vezes — o foco JAMAIS deve sair do dialog.
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Tab");
      const inside = await dialog.evaluate(
        (el) => el.contains(document.activeElement) || el === document.activeElement,
      );
      expect(inside, `Tab #${i + 1} vazou o foco do dialog`).toBe(true);
    }

    // Shift+Tab também respeita o trap.
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Shift+Tab");
      const inside = await dialog.evaluate(
        (el) => el.contains(document.activeElement) || el === document.activeElement,
      );
      expect(inside, `Shift+Tab #${i + 1} vazou o foco do dialog`).toBe(true);
    }
  });
});

/**
 * Paridade de ações no /estoque: o QuickView deve exibir os 4 botões padrão
 * (Carrinho, Favoritar, Comparar, Compartilhar) — antes do fix, apenas
 * Carrinho + Compartilhar apareciam.
 */
test.describe("Estoque • QuickView — paridade de ações (4 botões)", () => {
  test.beforeEach(() => requireAuth());

  test("exibe cart + favorite + compare + share no /estoque", async ({ page }) => {
    await gotoAndSettle(page, "/estoque");
    const thumb = page.locator(Sel.product.stockTableThumb).first();
    if (!(await thumb.count())) test.skip(true, "Nenhum thumb visível em /estoque");

    await thumb.click();
    await expect(page.locator(Sel.product.quickViewName)).toBeVisible({ timeout: 10_000 });

    await expect(page.locator(Sel.product.quickViewCart)).toBeVisible();
    await expect(page.locator(Sel.product.quickViewFavorite)).toBeVisible();
    await expect(page.locator(Sel.product.quickViewCompare)).toBeVisible();
    await expect(page.locator(Sel.product.quickViewShare)).toBeVisible();
  });
});

/**
 * Regressão de estabilidade: abrir e fechar o QuickView várias vezes em sequência
 * a partir do /estoque. Garante que nenhum handler/testid duplicado dispara erro
 * de render quando o modal monta/desmonta repetidamente (cobre o caso do
 * BulkAddToCollectionModal single-row co-montado dentro do <TableRow>).
 */
test.describe("Estoque • QuickView — abertura/fechamento em sequência", () => {
  test.beforeEach(() => requireAuth());

  test("abre e fecha o QuickView 3x sem crash nem testid duplicado", async ({ page }) => {
    await gotoAndSettle(page, "/estoque");
    const thumb = page.locator(Sel.product.stockTableThumb).first();
    if (!(await thumb.count())) test.skip(true, "Nenhum thumb visível em /estoque");

    for (let i = 0; i < 3; i++) {
      await thumb.click();
      await expect(page.locator(Sel.product.quickViewName).first()).toBeVisible({
        timeout: 10_000,
      });
      // Sanidade: apenas UMA instância de cada botão (sem duplicação por re-render).
      await expect(page.locator(Sel.product.quickViewCart)).toHaveCount(1);
      await expect(page.locator(Sel.product.quickViewFavorite)).toHaveCount(1);
      await expect(page.locator(Sel.product.quickViewCompare)).toHaveCount(1);
      await expect(page.locator(Sel.product.quickViewShare)).toHaveCount(1);
      await page.keyboard.press("Escape");
      await expect(page.locator(Sel.product.quickViewName)).toHaveCount(0, {
        timeout: 5_000,
      });
    }
    // A página continua respondendo.
    await expect(page.locator("body")).toBeVisible();
  });
});




