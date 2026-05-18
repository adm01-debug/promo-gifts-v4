/**
 * Fluxo: usuário não-dev NUNCA deve ver mensagens internas de infra.
 *
 * Valida o "Dev Infra Messages Gate" (SSOT `shouldShowDevInfraMessages`)
 * navegando por páginas críticas como usuário comum e também forçando
 * cenários de erro (503 do external-db-bridge, offline). Em nenhuma das
 * páginas deve aparecer copy interna (banners de status, mensagens de erro
 * cru, stack traces, códigos de edge function).
 *
 * Política: gate de infra deve esconder TUDO de não-dev — copy amigável OK,
 * detalhes técnicos NUNCA.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { loginAs } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/nav";

/** Strings/regex que NÃO devem aparecer para usuário não-dev em nenhuma página. */
const FORBIDDEN_INFRA_PATTERNS: RegExp[] = [
  // Banners gateados por <DevOnly>
  /Cat[áa]logo externo indispon[íi]vel/i,
  /Backend indispon[íi]vel/i,
  /Backend inst[áa]vel/i,
  /Backend inicializando/i,
  // ErrorBoundary detalhes técnicos
  /Mensagem do erro/i,
  /Detalhes t[ée]cnicos/i,
  /Component Stack/i,
  // Controles de debug (CloudStatusBanner strict)
  /Debug Lat[êe]ncia/i,
  // Erros crus de edge/runtime que jamais devem vazar
  /UNAUTHORIZED_LEGACY_JWT/,
  /SUPABASE_EDGE_RUNTIME_ERROR/,
  /Failed to fetch/i,
  /TypeError: /,
  /at https?:\/\/.+\.tsx?:\d+/i,
];

/** Páginas críticas que todo usuário autenticado acessa. */
const CRITICAL_PATHS = [
  "/dashboard",
  "/produtos",
  "/favoritos",
  "/colecoes",
  "/orcamentos",
  "/novidades",
] as const;

async function assertNoInfraLeak(page: import("@playwright/test").Page, where: string) {
  // Pega innerText do body (apenas texto visível) após settle leve.
  const bodyText = await page.locator("body").innerText({ timeout: 10_000 });
  for (const re of FORBIDDEN_INFRA_PATTERNS) {
    expect(
      bodyText,
      `[${where}] Vazou mensagem interna de infra para não-dev: /${re.source}/`,
    ).not.toMatch(re);
  }
}

test.describe("Dev Infra Gate — não-dev não vê mensagens internas", () => {
  test.beforeEach(() => requireAuth());

  test("páginas críticas não exibem banners/mensagens de infra", async ({ page }) => {
    await loginAs(page, "user");

    for (const path of CRITICAL_PATHS) {
      await gotoAndSettle(page, path);
      // Aguarda a UI assentar para evitar flake de transições.
      await page.waitForLoadState("domcontentloaded");
      await assertNoInfraLeak(page, path);
    }
  });

  test("503 do external-db-bridge não expõe banner técnico", async ({ page }) => {
    await loginAs(page, "user");

    await page.route("**/functions/v1/external-db-bridge**", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          code: "SUPABASE_EDGE_RUNTIME_ERROR",
          message: "Service is temporarily unavailable",
        }),
      }),
    );

    await gotoAndSettle(page, "/produtos");
    await page.waitForLoadState("domcontentloaded");
    await assertNoInfraLeak(page, "/produtos (bridge 503)");
  });

  test("offline transitório não expõe stack/erro cru", async ({ page, context }) => {
    await loginAs(page, "user");
    await gotoAndSettle(page, "/dashboard");

    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForTimeout(1500);
    await assertNoInfraLeak(page, "/dashboard (offline)");
    await context.setOffline(false);
  });
});
