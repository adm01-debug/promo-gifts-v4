/**
 * E2E: Session Recovery — corrupção real de localStorage (kid inválido).
 *
 * Complementa `e2e/auth-session-recovery.spec.ts` (que usa route mocking)
 * exercitando o caminho de produção end-to-end:
 *
 *  1. Login normal via UI (`loginViaUI` → storageState válido).
 *  2. Lê `sb-<ref>-auth-token` do localStorage e troca o `kid` do header do
 *     access_token por um valor inexistente (`e2e-fake-kid`). A assinatura
 *     deixa de bater contra qualquer JWK publicado pelo GoTrue → o servidor
 *     responde `403 bad_jwt`.
 *  3. Reload + dispara `focus`/`visibilitychange` para acionar
 *     `attachSessionRevalidation()` em `session-recovery.ts`.
 *  4. Confirma:
 *     - redirect para `/login?next=/catalogo`
 *     - toast "Sua sessão expirou" (sonner)
 *
 * Política E2E: helpers SSOT (loginViaUI/gotoAndSettle), sem `waitForTimeout`
 * nem `networkidle`. Toda asserção usa auto-retry do Playwright.
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/nav";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? "https://doufsxqlfjyuvxuezpln.supabase.co";
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];
const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;

const E2E_EMAIL = process.env.E2E_USER_EMAIL ?? "";
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD ?? "";

/**
 * Corrompe o `kid` do header do JWT preservando estrutura (header.payload.sig)
 * para que o servidor passe pelo parse e falhe na verificação de assinatura
 * com `unrecognized JWT kid` — caminho exato que `isBadJwtError` reconhece.
 */
function corruptJwtKid(jwt: string): string {
  const parts = jwt.split(".");
  if (parts.length !== 3) return jwt;
  const headerJson = JSON.parse(
    Buffer.from(parts[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
  );
  headerJson.kid = "e2e-fake-kid";
  const newHeader = Buffer.from(JSON.stringify(headerJson))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return [newHeader, parts[1], parts[2]].join(".");
}

async function poisonLocalStorageToken(page: Page, storageKey: string): Promise<boolean> {
  return page.evaluate(
    ({ key, fakeKid }) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) return false;
      try {
        const parsed = JSON.parse(raw);
        const access = parsed?.access_token ?? parsed?.currentSession?.access_token;
        if (typeof access !== "string") return false;
        const parts = access.split(".");
        if (parts.length !== 3) return false;
        const headerJson = JSON.parse(atob(parts[0].replace(/-/g, "+").replace(/_/g, "/")));
        headerJson.kid = fakeKid;
        const newHeader = btoa(JSON.stringify(headerJson))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");
        const poisoned = [newHeader, parts[1], parts[2]].join(".");
        if (parsed.access_token) parsed.access_token = poisoned;
        if (parsed.currentSession?.access_token) parsed.currentSession.access_token = poisoned;
        // Mantém refresh_token válido para forçar /token a também responder bad_jwt
        // (refresh_token foi emitido com kid antigo) — caminho irrecuperável real.
        window.localStorage.setItem(key, JSON.stringify(parsed));
        return true;
      } catch {
        return false;
      }
    },
    { key: storageKey, fakeKid: "e2e-fake-kid" },
  );
}

test.describe("Session Recovery — corrupção real de localStorage", () => {
  test.skip(
    !E2E_EMAIL || !E2E_PASSWORD,
    "Requer E2E_USER_EMAIL/E2E_USER_PASSWORD para login real (não mocked).",
  );

  test("kid inválido no access_token → toast + redirect /login?next=", async ({ page }) => {
    // 1. Login real via UI (sem storageState reaproveitado — precisamos do token
    // recém-emitido pelo GoTrue para garantir estrutura JWT real).
    const ok = await loginViaUI(page, { email: E2E_EMAIL, password: E2E_PASSWORD });
    expect(ok, "login inicial deve ter sucesso").toBe(true);

    // 2. Navega para uma rota autenticada e corrompe o kid do JWT.
    await gotoAndSettle(page, "/catalogo");
    const poisoned = await poisonLocalStorageToken(page, STORAGE_KEY);
    expect(poisoned, `localStorage[${STORAGE_KEY}] deveria existir e ter access_token`).toBe(true);

    // 3. Reload + focus/visibilitychange para disparar attachSessionRevalidation.
    await page.reload();
    await page.evaluate(() => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // 4a. Redirect para /login?next=/catalogo (auto-retry do Playwright).
    await expect(page, "esperado redirect para /login com next=/catalogo").toHaveURL(
      /\/login\?next=%2Fcatalogo|\/login\?next=\/catalogo/,
      { timeout: 15_000 },
    );

    // 4b. Toast sonner "Sua sessão expirou" (mensagem definida em session-recovery.ts).
    await expect(
      page.locator('[data-sonner-toast], [role="status"]').filter({ hasText: /sess[aã]o expirou/i }).first(),
      "esperado toast 'Sua sessão expirou'",
    ).toBeVisible({ timeout: 8_000 });
  });
});

// Sanity export (caso o `corruptJwtKid` venha a ser usado em outros specs).
export { corruptJwtKid };
