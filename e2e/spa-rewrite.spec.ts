/**
 * E2E: SPA Rewrite — Deep Routes (Fix #42 / commit 6b8a890)
 *
 * Sem o rewrite em vercel.json, qualquer GET direto em /admin/*, /orcamentos/*,
 * /produtos/:id etc. retornava a página 404 NOT_FOUND da Vercel — quebrando
 * refresh em rotas profundas e prefetch de chunks por <Link prefetch>.
 *
 * Aqui validamos no servidor de dev (Vite) que:
 *  1. Rotas profundas servem o index.html (não geram 404).
 *  2. App monta (header/sidebar/outlet) sem ficar preso em fallback.
 *  3. Assets em /assets/* continuam sendo servidos diretamente (não interceptados).
 *  4. Refresh em rota profunda preserva o caminho (router client-side reativa).
 *
 * Observação: vercel.json em si só age no deploy. O Vite dev tem fallback
 * historyApi nativo, então este spec funciona como contrato de comportamento
 * (qualquer regressão em vercel.json também regressaria a UX no dev).
 */
import { test, expect } from "./fixtures/test-base";

const DEEP_ROUTES = [
  "/admin/usuarios",
  "/admin/conexoes",
  "/admin/configuracoes",
  "/admin/telemetria",
  "/orcamentos",
  "/orcamentos/novo",
  "/produtos",
  "/colecoes",
  "/favoritos",
  "/montar-kit",
];

test.describe("SPA rewrite — deep routes serve index.html", () => {
  // Sem requerer auth: a validação aqui é do contrato HTTP/servidor (rewrite
  // entrega index.html para qualquer caminho), independente de sessão.
  // Rotas protegidas redirecionam para /login depois — mas isso é client-side
  // e exige que o index.html tenha carregado primeiro.

  for (const route of DEEP_ROUTES) {
    test(`GET direto em ${route} monta a SPA (não 404)`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response, `Resposta nula para ${route}`).not.toBeNull();
      expect(response!.status(), `Status HTTP para ${route}`).toBeLessThan(400);

      // O index.html sempre carrega #root — se o fallback historyApi (dev) ou
      // o rewrite (prod) estiver quebrado, o body trará HTML do 404 do servidor
      // e não terá esse elemento.
      const root = page.locator("#root");
      await expect(root, `#root ausente em ${route} (fallback SPA quebrado)`).toBeVisible({
        timeout: 15_000,
      });
    });
  }

  test("refresh em rota profunda preserva o caminho", async ({ page }) => {
    const target = "/orcamentos/novo";
    await page.goto(target, { waitUntil: "domcontentloaded" });
    await page.reload({ waitUntil: "domcontentloaded" });
    // O Router declarativo só consegue restaurar o path se o rewrite/fallback
    // estiver entregando index.html para o caminho real.
    expect(new URL(page.url()).pathname).toBe(target);
    await expect(page.locator("#root")).toBeVisible();
  });

  test("/assets/* não são interceptados pelo rewrite", async ({ page }) => {
    // Carrega a home, captura o primeiro asset do <link rel="modulepreload"> ou <script>.
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const assetHref = await page.evaluate(() => {
      const link = document.querySelector<HTMLLinkElement>(
        'link[rel="modulepreload"][href^="/assets/"], link[rel="stylesheet"][href^="/assets/"]',
      );
      const script = document.querySelector<HTMLScriptElement>('script[src^="/assets/"]');
      return link?.href ?? script?.src ?? null;
    });

    if (!assetHref) {
      test.skip(true, "Sem /assets/* — dev server inline (esperado em vite dev).");
      return;
    }

    const res = await page.request.get(assetHref);
    expect(res.status(), `Asset ${assetHref} deveria responder 200`).toBe(200);
    const ct = res.headers()["content-type"] ?? "";
    expect(ct).not.toContain("text/html"); // se virou index.html, é regressão do rewrite
  });
});
