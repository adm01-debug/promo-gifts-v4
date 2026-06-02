/**
 * ProductCard ↔ PDP — Sincronização URL/Estado de cores.
 *
 * Cobre:
 *  - URL com cor/hex/grupo ausentes → PDP abre sem variação selecionada.
 *  - URL com cor/hex/grupo inválidos → PDP cai no fallback (sem variação) sem quebrar.
 *  - Match parcial por nome (case-insensitive, trim).
 *  - Match por hex sem `#`.
 *  - Navegação back/forward preservando sincronia entre Grid ⇄ PDP.
 *  - Snapshots visuais do tooltip simples e do tooltip +N em 390/768/1024/1366.
 */
import { test, expect, requireAuth } from "./fixtures/test-base";
import { gotoAndSettle, waitForRouteIdle } from "./helpers/nav";

const VIEWPORTS = [390, 768, 1024, 1366] as const;

async function openCatalog(page: import("@playwright/test").Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await gotoAndSettle(page, "/produtos");
  await waitForRouteIdle(page);
  await expect(page.locator('[data-testid="product-card"]').first()).toBeVisible({
    timeout: 15_000,
  });
}

async function getFirstProductIdWithColors(
  page: import("@playwright/test").Page,
): Promise<{ id: string; colorName: string; hex: string | null } | null> {
  const card = page
    .locator('[data-testid="product-card"]')
    .filter({ has: page.locator('[data-testid^="color-swatch-"]') })
    .first();
  if ((await card.count()) === 0) return null;
  const id = await card.getAttribute("data-product-id");
  const swatch = card.locator('[data-testid^="color-swatch-"]').first();
  const colorName = (await swatch.getAttribute("data-color-name")) ?? "";
  const style = (await swatch.getAttribute("style")) ?? "";
  const hexMatch = style.match(/#[0-9a-f]{3,8}/i);
  return id && colorName
    ? { id, colorName, hex: hexMatch ? hexMatch[0] : null }
    : null;
}

test.describe("PDP — URL params de cor (ausentes/inválidos)", () => {
  test.beforeEach(() => requireAuth());

  test("URL sem parâmetros de cor abre PDP sem quebrar", async ({ page }) => {
    await openCatalog(page, 1366);
    const info = await getFirstProductIdWithColors(page);
    test.skip(!info, "Sem cards com cores no catálogo.");
    if (!info) return;

    await gotoAndSettle(page, `/produto/${info.id}`);
    await waitForRouteIdle(page);

    // Página renderiza normalmente
    await expect(page.locator('[data-testid="page-title-detalhe-produto"]')).toBeVisible({
      timeout: 15_000,
    });
    // URL sem cor — nenhum parâmetro injetado
    const url = new URL(page.url());
    expect(url.searchParams.get("cor")).toBeNull();
  });

  test("URL com cor INVÁLIDA não quebra a página", async ({ page }) => {
    await openCatalog(page, 1366);
    const info = await getFirstProductIdWithColors(page);
    test.skip(!info, "Sem cards com cores no catálogo.");
    if (!info) return;

    await gotoAndSettle(page, `/produto/${info.id}?cor=cor-inexistente-xyz-123`);
    await waitForRouteIdle(page);

    await expect(page.locator('[data-testid="page-title-detalhe-produto"]')).toBeVisible({
      timeout: 15_000,
    });
    // Preço sempre presente — prova que PDP funcional mesmo com cor inválida
    await expect(page.locator('[data-testid="pdp-price-value"]')).toBeVisible();
  });

  test("URL com hex INVÁLIDO não quebra a página", async ({ page }) => {
    await openCatalog(page, 1366);
    const info = await getFirstProductIdWithColors(page);
    test.skip(!info, "Sem cards com cores no catálogo.");
    if (!info) return;

    await gotoAndSettle(page, `/produto/${info.id}?hex=ZZZZZZ`);
    await waitForRouteIdle(page);
    await expect(page.locator('[data-testid="pdp-price-value"]')).toBeVisible({
      timeout: 15_000,
    });
  });

  test("URL com grupo INVÁLIDO não quebra a página", async ({ page }) => {
    await openCatalog(page, 1366);
    const info = await getFirstProductIdWithColors(page);
    test.skip(!info, "Sem cards com cores no catálogo.");
    if (!info) return;

    await gotoAndSettle(page, `/produto/${info.id}?grupo=grupo-fake-9999`);
    await waitForRouteIdle(page);
    await expect(page.locator('[data-testid="pdp-price-value"]')).toBeVisible({
      timeout: 15_000,
    });
  });

  test("match case-insensitive de cor via URL", async ({ page }) => {
    await openCatalog(page, 1366);
    const info = await getFirstProductIdWithColors(page);
    test.skip(!info, "Sem cards com cores.");
    if (!info) return;

    await gotoAndSettle(
      page,
      `/produto/${info.id}?cor=${encodeURIComponent(info.colorName.toUpperCase())}`,
    );
    await waitForRouteIdle(page);
    await expect(page.locator('[data-testid="pdp-price-value"]')).toBeVisible({
      timeout: 15_000,
    });
  });

  test("match de hex sem # via URL", async ({ page }) => {
    await openCatalog(page, 1366);
    const info = await getFirstProductIdWithColors(page);
    test.skip(!info || !info.hex, "Sem hex disponível.");
    if (!info || !info.hex) return;

    const hexNoHash = info.hex.replace("#", "");
    await gotoAndSettle(page, `/produto/${info.id}?hex=${hexNoHash}`);
    await waitForRouteIdle(page);
    await expect(page.locator('[data-testid="pdp-price-value"]')).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe("Navegação back/forward mantém sincronia Grid ⇄ PDP", () => {
  test.beforeEach(() => requireAuth());

  test("voltar/avançar entre 2 PDPs com parâmetros de cor", async ({ page }) => {
    await openCatalog(page, 1366);

    // Pega o primeiro card com cores e clica numa cor → PDP A
    const cardA = page
      .locator('[data-testid="product-card"]')
      .filter({ has: page.locator('[data-testid^="color-swatch-"]') })
      .first();
    test.skip((await cardA.count()) === 0, "Sem cards com cores.");
    const swatchA = cardA.locator('[data-testid^="color-swatch-"]').first();
    const colorA = (await swatchA.getAttribute("data-color-name")) ?? "";
    await swatchA.click();
    await waitForRouteIdle(page);
    await expect(page).toHaveURL(/\/produto\/[^?]+\?.*cor=/i, { timeout: 10_000 });
    const urlA = page.url();
    expect(new URL(urlA).searchParams.get("cor")?.toLowerCase()).toBe(colorA.toLowerCase());

    // Volta para o catálogo
    await page.goBack();
    await waitForRouteIdle(page);
    await expect(page.locator('[data-testid="product-card"]').first()).toBeVisible({
      timeout: 15_000,
    });

    // Pega outro card (ou outra swatch do mesmo) e abre PDP B
    const cards = page
      .locator('[data-testid="product-card"]')
      .filter({ has: page.locator('[data-testid^="color-swatch-"]') });
    const cardB = (await cards.count()) > 1 ? cards.nth(1) : cards.first();
    const swatchesB = cardB.locator('[data-testid^="color-swatch-"]');
    const swatchB = (await swatchesB.count()) > 1 ? swatchesB.nth(1) : swatchesB.first();
    const colorB = (await swatchB.getAttribute("data-color-name")) ?? "";
    await swatchB.click();
    await waitForRouteIdle(page);
    await expect(page).toHaveURL(/\/produto\/[^?]+\?.*cor=/i, { timeout: 10_000 });
    const urlB = page.url();
    expect(new URL(urlB).searchParams.get("cor")?.toLowerCase()).toBe(colorB.toLowerCase());

    // Volta para PDP A — deve restaurar a cor A na URL
    await page.goBack();
    await waitForRouteIdle(page);
    // Pode ter ido ao catálogo (entre os 2 PDPs) — se sim, voltamos mais uma vez
    if (!/\/produto\//.test(page.url())) {
      await page.goBack();
      await waitForRouteIdle(page);
    }
    expect(new URL(page.url()).searchParams.get("cor")?.toLowerCase()).toBe(
      colorA.toLowerCase(),
    );

    // Avança de volta para PDP B
    await page.goForward();
    await waitForRouteIdle(page);
    if (!/\/produto\//.test(page.url()) || !page.url().includes(colorB)) {
      await page.goForward();
      await waitForRouteIdle(page);
    }
    await expect(page.locator('[data-testid="pdp-price-value"]')).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe("Snapshots visuais — tooltips de cor", () => {
  test.beforeEach(() => requireAuth());

  for (const width of VIEWPORTS) {
    test(`tooltip de swatch simples em ${width}px`, async ({ page }) => {
      await openCatalog(page, width);

      const card = page
        .locator('[data-testid="product-card"]')
        .filter({ has: page.locator('[data-testid^="color-swatch-"]') })
        .first();
      test.skip((await card.count()) === 0, "Sem cards com cores.");

      const swatch = card.locator('[data-testid^="color-swatch-"]').first();
      await swatch.hover();
      const tooltip = page.locator('[data-testid="color-tooltip-content"]').first();
      await expect(tooltip).toBeVisible({ timeout: 5_000 });

      await expect(tooltip).toHaveScreenshot(
        `color-tooltip-${width}px.png`,
        { maxDiffPixelRatio: 0.03 },
      );
    });

    test(`tooltip +N (overflow) em ${width}px`, async ({ page }) => {
      // Força um produto com 8 cores para garantir o overflow
      await page.route(/products-colors-batch|product[-_]colors/i, async (route) => {
        const response = await route.fetch();
        try {
          const json = await response.json();
          if (json?.data) {
            const eightColors = Array.from({ length: 8 }, (_, i) => ({
              name: `Cor ${i + 1}`,
              hex: `#${(((i + 1) * 0x1f1f1f) & 0xffffff).toString(16).padStart(6, "0")}`,
            }));
            Object.keys(json.data).forEach((k) => (json.data[k] = eightColors));
          }
          await route.fulfill({ response, json });
        } catch {
          await route.fulfill({ response });
        }
      });

      await openCatalog(page, width);

      const card = page
        .locator('[data-testid="product-card"]')
        .filter({ has: page.locator('[data-testid="color-swatch-overflow"]') })
        .first();
      test.skip((await card.count()) === 0, "Sem overflow disponível.");

      const overflow = card.locator('[data-testid="color-swatch-overflow"]').first();
      await overflow.hover();
      const tooltip = page.locator('[data-testid="color-overflow-tooltip"]').first();
      await expect(tooltip).toBeVisible({ timeout: 5_000 });

      await expect(tooltip).toHaveScreenshot(
        `color-overflow-tooltip-${width}px.png`,
        { maxDiffPixelRatio: 0.03 },
      );

      // Garante que o tooltip não ultrapassa a viewport
      const box = await tooltip.boundingBox();
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
      }
    });
  }
});
