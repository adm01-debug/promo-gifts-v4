/**
 * E2E — /comparar
 *
 * Invariante de UI: a coluna "Cores" do comparador (visualização desktop
 * `CompareTableView` e mobile `ComparisonMobileView`) DEVE renderizar uma
 * bolinha para cada cor disponível — sem chip de overflow `+N`.
 *
 * Esta regra existe porque vendedores precisam visualizar TODAS as cores
 * de um produto no comparador para decidir rapidamente. Esconder cores
 * atrás de "+N" derrota o propósito do módulo.
 *
 * Estratégia do teste:
 *   1. Acessa /comparar (em desktop e mobile);
 *   2. Asserta o invariante negativo: nenhum elemento de texto
 *      correspondente a `^\+\d+$` (ex: "+4", "+12") existe na página;
 *   3. Quando houver produtos carregados, conta as bolinhas dentro do
 *      container de cores e exige que sejam ≥1 (não há truncagem).
 *
 * Passa em estado vazio (CompareEmptyStateSmart) pois ali não há swatches
 * nem chips — o invariante segue válido.
 */
import { test, expect, type Page } from "@playwright/test";

const PLUS_N_REGEX = /^\s*\+\d+\s*$/;

async function assertNoPlusNChip(page: Page) {
  const overflowChips = page.getByText(PLUS_N_REGEX);
  // Não pode existir nenhum chip "+N" como descendente do main da página.
  await expect(overflowChips).toHaveCount(0);
}

test.describe("/comparar — coluna Cores sem indicador +N", () => {
  test("desktop: nenhum chip +N e bolinhas renderizadas 1:1", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/comparar", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {/* best-effort */});

    // Garante que a rota não caiu em login/erro.
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator("body")).not.toContainText("500");

    await assertNoPlusNChip(page);

    // Se houver produtos carregados, valida que cada container de cores
    // tem ≥1 bolinha (sem truncagem). Caso contrário, o invariante negativo
    // acima já é suficiente.
    const swatchContainers = page.locator(
      '[aria-label$="cores"], [aria-label$="cor"]'
    );
    const containers = await swatchContainers.count();
    for (let i = 0; i < containers; i++) {
      const c = swatchContainers.nth(i);
      const ariaLabel = (await c.getAttribute("aria-label")) ?? "";
      const match = ariaLabel.match(/(\d+)\s+cor/i);
      if (!match) continue;
      const expectedDots = Number(match[1]);
      if (expectedDots === 0) continue;
      const dots = c.locator('[style*="background-color"], [title]').filter({
        hasNotText: PLUS_N_REGEX,
      });
      const dotsCount = await dots.count();
      expect(dotsCount).toBeGreaterThanOrEqual(expectedDots);
    }
  });

  test("mobile: nenhum chip +N na linha 'Cores'", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/comparar", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {/* best-effort */});

    await expect(page).not.toHaveURL(/\/login/);
    await assertNoPlusNChip(page);
  });
});
