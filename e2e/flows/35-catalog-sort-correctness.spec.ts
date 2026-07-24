/**
 * E2E — Catálogo: corretude da ordenação real.
 *
 * Valida que, ao selecionar cada opção do `ProductSort` (SORT_OPTIONS em
 * `src/constants/filters.ts`), o catálogo é REORDENADO conforme o critério
 * — e não apenas que a UI muda visualmente.
 *
 * Estratégia: ler atributos `data-product-*` do `ProductCard` (price/stock/
 * created-at/name) na ordem do DOM e validar a sequência.
 *
 * Tolerante a empates (compara monotonicidade não-estrita) e a ambientes
 * com poucos produtos (skip gracioso).
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { waitForTestIdVisible, pollUntil } from "../helpers/waits";
import { Sel } from "../fixtures/selectors";
import type { Page } from "@playwright/test";

const MIN_CARDS = 3;
const SAMPLE_SIZE = 20;

type CardData = {
  name: string;
  price: number | null;
  stock: number | null;
  createdAt: string | null;
};

async function readCards(page: Page): Promise<CardData[]> {
  return page.locator(Sel.product.card).evaluateAll((nodes) =>
    nodes.slice(0, 20).map((n) => {
      const el = n as HTMLElement;
      const price = el.getAttribute("data-product-price");
      const stock = el.getAttribute("data-product-stock");
      const createdAt = el.getAttribute("data-product-created-at");
      return {
        name: el.getAttribute("data-product-name") ?? "",
        price: price && price !== "" ? Number(price) : null,
        stock: stock && stock !== "" ? Number(stock) : null,
        createdAt: createdAt && createdAt !== "" ? createdAt : null,
      };
    }),
  );
}

async function applySort(page: Page, value: string) {
  const before = await readCards(page);
  const beforeKey = before.map((c) => c.name).join("|");
  await page.locator(Sel.catalog.sortTrigger).click();
  await page.locator(Sel.catalog.sortItem(value)).click();
  // aguarda o grid efetivamente reordenar (ou estabilizar com mesma ordem)
  await waitForTestIdVisible(page, "product-card", { timeout: 15_000 });
  await pollUntil(
    async () => {
      const now = await readCards(page);
      if (now.length === 0) return false;
      const nowKey = now.map((c) => c.name).join("|");
      // estabilidade: mesma leitura 2x OU mudou em relação ao before
      return nowKey !== beforeKey || now.length === before.length;
    },
    { timeout: 8_000, interval: 250 },
  ).catch(() => {/* tolerante */});
}

function isNonDecreasing(nums: number[]): boolean {
  for (let i = 1; i < nums.length; i++) if (nums[i] < nums[i - 1]) return false;
  return true;
}
function isNonIncreasing(nums: number[]): boolean {
  for (let i = 1; i < nums.length; i++) if (nums[i] > nums[i - 1]) return false;
  return true;
}

test.describe("Catálogo — corretude da ordenação", () => {
  test.beforeEach(() => requireAuth());

  test("name (A→Z): nomes em ordem alfabética", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    await waitForTestIdVisible(page, "product-card", { timeout: 20_000 });
    await applySort(page, "name");

    const cards = (await readCards(page)).slice(0, SAMPLE_SIZE);
    test.skip(cards.length < MIN_CARDS, "poucos produtos para validar");

    const names = cards.map((c) => c.name.toLocaleLowerCase("pt-BR"));
    const sorted = [...names].sort((a, b) => a.localeCompare(b, "pt-BR"));
    expect(names).toEqual(sorted);
  });

  test("price-asc: preços em ordem crescente", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    await waitForTestIdVisible(page, "product-card", { timeout: 20_000 });
    await applySort(page, "price-asc");

    const prices = (await readCards(page))
      .map((c) => c.price)
      .filter((v): v is number => v !== null && Number.isFinite(v))
      .slice(0, SAMPLE_SIZE);

    test.skip(prices.length < MIN_CARDS, "poucos produtos com preço");
    expect(isNonDecreasing(prices), `esperado crescente, recebi ${prices.join(", ")}`).toBe(true);
  });

  test("price-desc: preços em ordem decrescente", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    await waitForTestIdVisible(page, "product-card", { timeout: 20_000 });
    await applySort(page, "price-desc");

    const prices = (await readCards(page))
      .map((c) => c.price)
      .filter((v): v is number => v !== null && Number.isFinite(v))
      .slice(0, SAMPLE_SIZE);

    test.skip(prices.length < MIN_CARDS, "poucos produtos com preço");
    expect(isNonIncreasing(prices), `esperado decrescente, recebi ${prices.join(", ")}`).toBe(true);
  });

  test("stock: estoque em ordem decrescente (Maior Estoque)", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    await waitForTestIdVisible(page, "product-card", { timeout: 20_000 });
    await applySort(page, "stock");

    const stocks = (await readCards(page))
      .map((c) => c.stock)
      .filter((v): v is number => v !== null && Number.isFinite(v))
      .slice(0, SAMPLE_SIZE);

    test.skip(stocks.length < MIN_CARDS, "poucos produtos com estoque");
    expect(isNonIncreasing(stocks), `esperado decrescente, recebi ${stocks.join(", ")}`).toBe(true);
  });

  test("newest: created_at em ordem decrescente", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    await waitForTestIdVisible(page, "product-card", { timeout: 20_000 });
    await applySort(page, "newest");

    const ts = (await readCards(page))
      .map((c) => (c.createdAt ? Date.parse(c.createdAt) : NaN))
      .filter((v) => Number.isFinite(v))
      .slice(0, SAMPLE_SIZE);

    test.skip(ts.length < MIN_CARDS, "poucos produtos com created_at");
    expect(isNonIncreasing(ts), `esperado mais recentes primeiro`).toBe(true);
  });

  test("troca de ordenação realmente reordena o grid", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    await waitForTestIdVisible(page, "product-card", { timeout: 20_000 });

    await applySort(page, "name");
    const firstByName = (await readCards(page)).slice(0, 5).map((c) => c.name);

    await applySort(page, "price-desc");
    const firstByPriceDesc = (await readCards(page)).slice(0, 5).map((c) => c.name);

    test.skip(
      firstByName.length < MIN_CARDS || firstByPriceDesc.length < MIN_CARDS,
      "poucos produtos",
    );
    // Em catálogos com >> 5 produtos é estatisticamente improvável que as duas
    // ordenações coincidam nos 5 primeiros itens.
    expect(firstByName.join("|")).not.toEqual(firstByPriceDesc.join("|"));
  });
});
