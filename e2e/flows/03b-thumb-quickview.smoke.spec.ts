/**
 * Smoke pré-suíte — falha rápido quando o ambiente está quebrado, evitando
 * minutos de CI esperando por timeouts em specs reais.
 *
 * Verifica:
 *  1. Servidor responde 2xx/3xx em `/`.
 *  2. Login funciona (helper loginAs).
 *  3. Rotas-chave da suíte 03b respondem sem 5xx.
 */
import { test, expect } from "../fixtures/test-base";
import { loginAs } from "../helpers/auth";

const SMOKE_ROUTES = ["/produtos", "/novidades", "/reposicao", "/estoque"] as const;

test.describe("@smoke 03b • pré-checagem de ambiente", () => {
  test("preview responde e login funciona", async ({ page }) => {
    const resp = await page.goto("/", { waitUntil: "domcontentloaded", timeout: 15_000 });
    expect(resp, "preview não respondeu em /").not.toBeNull();
    expect(resp!.status(), `status inesperado em / (${resp!.status()})`).toBeLessThan(500);
    await loginAs(page);
  });

  for (const route of SMOKE_ROUTES) {
    test(`rota ${route} responde sem 5xx`, async ({ page }) => {
      await loginAs(page);
      const resp = await page.goto(route, { waitUntil: "domcontentloaded", timeout: 20_000 });
      expect(resp?.status() ?? 0, `5xx em ${route}`).toBeLessThan(500);
    });
  }
});
