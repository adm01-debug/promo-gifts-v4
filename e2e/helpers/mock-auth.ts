/**
 * Instala interceptors de `/auth/v1/**` no `page` do Playwright para
 * suportar rodadas E2E com storageState **sintético** (mock).
 *
 * Sem isso, o cliente Supabase JS eventualmente chama:
 *   • `POST /auth/v1/token?grant_type=refresh_token` → 400/401 → logout;
 *   • `GET  /auth/v1/user`                            → 401         → logout;
 *   • `POST /auth/v1/logout`                          → 401 harmless.
 *
 * Como o token sintético não é validável pelo Supabase real, precisamos
 * responder localmente com sessões renovadas para manter o usuário
 * "logado" durante o spec.
 *
 * Uso:
 *   import { installMockAuth, isMockAuthEnabled } from "../helpers/mock-auth";
 *   test.beforeEach(async ({ page }) => {
 *     if (isMockAuthEnabled()) await installMockAuth(page);
 *   });
 */
import type { Page } from "@playwright/test";

const PROJECT_REF = "doufsxqlfjyuvxuezpln";
const AUTH_HOST = `${PROJECT_REF}.supabase.co`;

export function isMockAuthEnabled(): boolean {
  return process.env.E2E_MOCK_AUTH === "1" || process.env.E2E_MOCK_AUTH === "true";
}

function b64url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj))
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function buildMockSession() {
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + 60 * 60;
  const userId = "00000000-0000-0000-0000-e2e0e2e0e2e0";
  const email = "e2e-mock@promogifts.local";
  const token = [
    b64url({ alg: "HS256", typ: "JWT" }),
    b64url({
      aud: "authenticated",
      sub: userId,
      email,
      role: "authenticated",
      iat: nowSec,
      exp: expSec,
    }),
    "mock-signature-not-verified",
  ].join(".");
  const user = {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email,
    email_confirmed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { e2e_mock: true },
    identities: [],
  };
  return {
    access_token: token,
    refresh_token: `mock-refresh-${nowSec}`,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expSec,
    user,
  };
}

/**
 * Registra interceptors no `page` para responder localmente a qualquer
 * chamada a `https://<project>.supabase.co/auth/v1/**`.
 * Deve ser chamado ANTES do primeiro `page.goto`.
 */
export async function installMockAuth(page: Page): Promise<void> {
  await page.route(
    (url) => url.hostname === AUTH_HOST && url.pathname.startsWith("/auth/v1/"),
    async (route, request) => {
      const url = new URL(request.url());
      const p = url.pathname;
      const method = request.method();

      // Refresh token / grant password → devolve nova sessão mock
      if (p === "/auth/v1/token") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(buildMockSession()),
        });
        return;
      }

      // Perfil do usuário atual
      if (p === "/auth/v1/user" && (method === "GET" || method === "HEAD")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(buildMockSession().user),
        });
        return;
      }

      // Logout: silencia (evita mudar o estado do storageState)
      if (p === "/auth/v1/logout") {
        await route.fulfill({ status: 204, body: "" });
        return;
      }

      // Recovery, otp, magiclink, invite, signup, etc. — respondemos 200
      // com payload vazio para evitar redirect ao login.
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      });
    },
  );
}
