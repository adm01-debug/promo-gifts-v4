import { expect, test } from "@playwright/test";
import { buildAuthedRouteSuite } from "../_factories";
import { loginAs } from "../../helpers/auth";
import { gotoAndSettle } from "../../helpers/nav";

buildAuthedRouteSuite({
  name: "/estoque",
  path: "/estoque",
  primary: { kind: "fn", key: "external-db-bridge", successBody: { rows: [] } },
});

/**
 * Regressão E2E — header "Visão Geral" / Saúde / alertas / ⓘ
 * Garante que os elementos removidos não voltem ao DOM da rota /estoque.
 */
test.describe("/estoque — header limpo (regressão)", () => {
  test("não exibe Visão Geral, chip Saúde, badge de alertas ou ícone ⓘ", async ({ page }) => {
    await loginAs(page);
    await gotoAndSettle(page, "/estoque");

    await expect(page.getByText(/^Visão Geral$/)).toHaveCount(0);
    await expect(page.locator('[data-testid="health-score-badge"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="critical-alerts-badge"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="health-score-info-trigger"]')).toHaveCount(0);
  });
});
