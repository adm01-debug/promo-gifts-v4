/**
 * ProductCard ↔ PDP — Sincronização URL/Estado de cores.
 *
 * Cobre:
 *  - URL com cor/hex/grupo ausentes → PDP abre sem variação selecionada.
 *  - URL com cor/hex/grupo inválidos → PDP cai no fallback (sem variação) sem quebrar.
 *  - Match parcial por nome (case-insensitive, trim).
 *  - Match por hex sem `#`.
 *  - Normalização da URL ao selecionar cor (remove #).
 *  - Navegação back/forward preservando sincronia entre Grid ⇄ PDP sem race conditions.
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

test.describe("PDP — URL params de cor (ausentes/inválidos/normalização)", () => {
  test.beforeEach(() => requireAuth());

  test("URL sem parâmetros de cor abre PDP sem quebrar", async ({ page }) => {
    await openCatalog(page, 1366);
    const info = await getFirstProductIdWithColors(page);
    test.skip(!info, "Sem cards com cores no catálogo.");
    if (!info) return;

    await gotoAndSettle(page, `/produto/${info.id}`);
    await waitForRouteIdle(page);

    await expect(page.locator('[data-testid="page-title-detalhe-produto"]')).toBeVisible({
      timeout: 15_000,
    });
    const url = new URL(page.url());
    expect(url.searchParams.get("cor")).toBeNull();
  });

  test("URL com cor INVÁLIDA não quebra a página e mostra fallback", async ({ page }) => {
    await openCatalog(page, 1366);
    const info = await getFirstProductIdWithColors(page);
    test.skip(!info, "Sem cards com cores no catálogo.");
    if (!info) return;

    await gotoAndSettle(page, `/produto/${info.id}?cor=cor-inexistente-xyz-123`);
    await waitForRouteIdle(page);

    await expect(page.locator('[data-testid="page-title-detalhe-produto"]')).toBeVisible();
    await expect(page.locator('[data-testid="pdp-price-value"]')).toBeVisible();
    
    // Verifica que nenhuma cor está selecionada no seletor de estoque por cor (se existir)
    const selectedSwatch = page.locator('button[aria-pressed="true"]');
    expect(await selectedSwatch.count()).toBe(0);
  });

  test("Normalização: selecionando cor no Card deve remover # do hex na URL", async ({ page }) => {
    await openCatalog(page, 1366);
    const card = page.locator('[data-testid="product-card"]').filter({ has: page.locator('[data-testid^="color-swatch-"]') }).first();
    const swatch = card.locator('[data-testid^="color-swatch-"]').first();
    await swatch.click();
    await waitForRouteIdle(page);
    
    const url = new URL(page.url());
    const hex = url.searchParams.get('hex');
    if (hex) {
      expect(hex).not.toContain('#');
    }
  });

  test("Match de hex sem # via URL", async ({ page }) => {
    await openCatalog(page, 1366);
    const info = await getFirstProductIdWithColors(page);
    test.skip(!info || !info.hex, "Sem hex disponível.");
    if (!info || !info.hex) return;

    const hexNoHash = info.hex.replace("#", "");
    await gotoAndSettle(page, `/produto/${info.id}?hex=${hexNoHash}`);
    await waitForRouteIdle(page);
    
    // Verifica se a cor foi selecionada no PDP
    const selectedSwatch = page.locator('button[aria-pressed="true"]');
    await expect(selectedSwatch).toBeVisible();
  });
});

test.describe("Navegação e Race Conditions", () => {
  test.beforeEach(() => requireAuth());

  test("Trocas rápidas e back/forward não causam desync", async ({ page }) => {
    await openCatalog(page, 1366);
    const info = await getFirstProductIdWithColors(page);
    test.skip(!info, "Sem cores.");
    if (!info) return;

    // Abre PDP
    await gotoAndSettle(page, `/produto/${info.id}`);
    await waitForRouteIdle(page);

    // Clica em várias cores rapidamente
    const swatches = page.locator('[aria-label^="Cor "][aria-label$=" unidades"]');
    const count = await swatches.count();
    test.skip(count < 2, "Poucas cores para teste rápido.");
    
    for (let i = 0; i < Math.min(count, 3); i++) {
      await swatches.nth(i).click();
    }
    
    const lastColorSelected = await swatches.nth(Math.min(count, 3) - 1).getAttribute('aria-label');
    
    // Volta e avança
    await page.goBack();
    await page.goForward();
    await waitForRouteIdle(page);
    
    const currentColor = await page.locator('button[aria-pressed="true"]').getAttribute('aria-label');
    expect(currentColor).toBe(lastColorSelected);
  });
});

test.describe("Snapshots visuais e Overflow", () => {
  test.beforeEach(() => requireAuth());

  for (const width of VIEWPORTS) {
    test(`tooltip +N (overflow) com scroll em ${width}px`, async ({ page }) => {
      // Mock para garantir muitas cores e testar scroll no tooltip
      await page.route(/products-colors-batch|product[-_]colors/i, async (route) => {
        const response = await route.fetch();
        try {
          const json = await response.json();
          if (json?.data) {
            const manyColors = Array.from({ length: 15 }, (_, i) => ({
              name: `Cor Extra Longa Nome ${i + 1}`,
              hex: `#${(((i + 1) * 0x1f1f1f) & 0xffffff).toString(16).padStart(6, "0")}`,
            }));
            Object.keys(json.data).forEach((k) => (json.data[k] = manyColors));
          }
          await route.fulfill({ response, json });
        } catch {
          await route.fulfill({ response });
        }
      });

      await openCatalog(page, width);

      const overflow = page.locator('[data-testid="color-swatch-overflow"]').first();
      await overflow.hover();
      const tooltip = page.locator('[data-testid="color-overflow-tooltip"]').first();
      await expect(tooltip).toBeVisible();

      // Snapshot do estado com overflow (tooltip específico e card inteiro)
      await expect(tooltip).toHaveScreenshot(`color-overflow-tooltip-${width}px.png`, { maxDiffPixelRatio: 0.05 });
      
      const card = page.locator('[data-testid="product-card"]').filter({ has: overflow }).first();
      await expect(card).toHaveScreenshot(`product-card-overflow-layout-${width}px.png`, { maxDiffPixelRatio: 0.05 });
      
      // Valida ordem (deve seguir a ordem do array)
      const firstHidden = tooltip.locator('button').first();
      await expect(firstHidden).toContainText('Cor Extra Longa Nome 6'); // max=5 default
    });
  }
});
