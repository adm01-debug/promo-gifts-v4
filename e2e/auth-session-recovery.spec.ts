/**
 * E2E: Session Recovery — comportamento perante JWT inválido (kid rotacionado).
 *
 * Valida o módulo `src/lib/auth/session-recovery.ts` em condições reais:
 *
 * 1. **Refresh irrecuperável (bad_jwt no token E no refresh)** → o usuário DEVE
 *    ser deslogado e redirecionado para `/login?next=<rota original>`.
 * 2. **Erro transitório de rede no refresh** (com bad_jwt no /user) → o usuário
 *    NÃO deve ser deslogado: a sessão segue e o redirect NÃO acontece.
 *
 * Estratégia: intercepta `GET /auth/v1/user` e `POST /auth/v1/token?grant_type=
 * refresh_token` com `page.route()` e dispara `focus` na aba para acionar a
 * revalidação configurada em `attachSessionRevalidation()`.
 *
 * Política E2E: helpers SSOT (loginAs/gotoAndSettle/expectOnRoute), sem
 * `page.goto`/`waitForTimeout`/`networkidle`.
 */
import { test, expect } from "./fixtures/test-base";
import { loginAs } from "./helpers/auth";
import { gotoAndSettle, expectOnRoute } from "./helpers/nav";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "https://doufsxqlfjyuvxuezpln.supabase.co";
const USER_ENDPOINT = `${SUPABASE_URL}/auth/v1/user**`;
const REFRESH_ENDPOINT = `${SUPABASE_URL}/auth/v1/token**`;

const BAD_JWT_BODY = JSON.stringify({
  code: 403,
  error_code: "bad_jwt",
  msg: "invalid JWT: unable to parse or verify signature, token is unverifiable: unrecognized JWT kid e2e-fake-kid for algorithm ES256",
});

test.describe("Session Recovery — JWT inválido", () => {
  test("refresh irrecuperável → signOut + redirect para /login?next=", async ({
    page,
  }) => {
    await loginAs(page, "user");
    await gotoAndSettle(page, "/catalogo");

    // Sabota /user (bad_jwt) → dispara recoverSession
    await page.route(USER_ENDPOINT, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: BAD_JWT_BODY,
        });
      } else {
        await route.continue();
      }
    });

    // Sabota refresh com bad_jwt → caminho irrecuperável (signOut)
    await page.route(REFRESH_ENDPOINT, async (route) => {
      const url = route.request().url();
      if (url.includes("grant_type=refresh_token")) {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: BAD_JWT_BODY,
        });
      } else {
        await route.continue();
      }
    });

    // Dispara revalidação (focus listener em attachSessionRevalidation)
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));

    // Espera redirect para /login?next=/catalogo
    await page.waitForURL(/\/login(\?|#)/, { timeout: 15_000 });
    await expectOnRoute(page, "/login");
    expect(page.url()).toMatch(/[?&]next=/);
    expect(decodeURIComponent(page.url())).toContain("/catalogo");
  });

  test("erro transitório no refresh → mantém sessão (sem redirect)", async ({
    page,
  }) => {
    await loginAs(page, "user");
    await gotoAndSettle(page, "/catalogo");
    const initialUrl = page.url();

    // /user retorna bad_jwt → vai disparar recoverSession
    await page.route(USER_ENDPOINT, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: BAD_JWT_BODY,
        });
      } else {
        await route.continue();
      }
    });

    // Refresh falha com erro transitório (rede caiu) — NÃO é bad_jwt
    let refreshAttempts = 0;
    await page.route(REFRESH_ENDPOINT, async (route) => {
      const url = route.request().url();
      if (url.includes("grant_type=refresh_token")) {
        refreshAttempts += 1;
        await route.abort("failed");
      } else {
        await route.continue();
      }
    });

    await page.evaluate(() => window.dispatchEvent(new Event("focus")));

    // Aguarda a tentativa de refresh acontecer (revalidação foi disparada)
    await expect
      .poll(() => refreshAttempts, { timeout: 10_000, intervals: [200, 500, 1000] })
      .toBeGreaterThan(0);

    // Dá tempo ao event loop: se a recovery FOSSE deslogar, redirecionaria
    // para /login dentro deste janela. Esperamos o redirect e exigimos que ele
    // NÃO aconteça (timeout esperado).
    const redirected = await page
      .waitForURL(/\/login(\?|#|$)/, { timeout: 3_000 })
      .then(() => true)
      .catch(() => false);

    expect(redirected, "não deve redirecionar em erro transitório").toBe(false);
    expect(page.url()).toBe(initialUrl);
  });
});
