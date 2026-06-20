/**
 * E2E: Session Recovery — corrupção real de localStorage (kid inválido).
 *
 * Complementa `e2e/auth-session-recovery.spec.ts` (route mocking) exercitando
 * o caminho de produção end-to-end com token real no localStorage.
 *
 * Cenários cobertos (ambos `@smoke`):
 *
 *  1. **Refresh irrecuperável** — `kid` adulterado no access_token + refresh_token
 *     "amarrado" ao kid antigo → GoTrue retorna `bad_jwt` em `/user` E `/token`.
 *     Esperado: signOut + redirect para `/login?next=/<rota original>` (preservada
 *     exatamente, sem `next` extra) + toast "Sua sessão expirou".
 *
 *  2. **Erro transitório no refresh** — kid adulterado dispara recovery, mas
 *     `POST /token` aborta como erro de rede (`failed`). Esperado: NÃO desloga,
 *     NÃO redireciona para `/login`, usuário continua na rota original.
 *
 * Nota sobre `_catalog.ts`: o catálogo é um registry de **rotas** consumido pelo
 * smoke runner (`flows/20-all-features-smoke.spec.ts`) que apenas valida title/
 * load. Especs comportamentais como este entram no smoke project via a tag
 * `@smoke` no título do `describe` (ver memória E2E Smoke Tag Isolation).
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
const REFRESH_ENDPOINT_RE = new RegExp(
  `${SUPABASE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/auth/v1/token.*grant_type=refresh_token`,
);

const E2E_EMAIL = process.env.E2E_USER_EMAIL ?? "";
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD ?? "";

/** Rota protegida usada para validar preservação do `next=`. */
const PROTECTED_ROUTE = "/favoritos";

/**
 * Corrompe o `kid` do header do JWT no localStorage. Preserva payload+signature
 * para o servidor passar pelo parse e falhar com `unrecognized JWT kid` —
 * exatamente o que `isBadJwtError` reconhece em `session-recovery.ts`.
 */
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
        window.localStorage.setItem(key, JSON.stringify(parsed));
        return true;
      } catch {
        return false;
      }
    },
    { key: storageKey, fakeKid: "e2e-fake-kid" },
  );
}

/** Dispara os listeners de `attachSessionRevalidation()`. */
async function triggerRevalidation(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

/**
 * Asserção forte do redirect: URL atual é `/login`, query tem `next` EXATO à
 * rota original (sem encadeamento `next=/login?next=...`) e nenhum parâmetro
 * extra de auth/erro foi anexado.
 */
async function expectRedirectedToLoginWithNext(page: Page, expectedNext: string): Promise<void> {
  await expect(page, `esperado pathname /login com next=${expectedNext}`).toHaveURL(
    /\/login(\?|$)/,
    { timeout: 15_000 },
  );
  const current = new URL(page.url());
  expect(current.pathname, "pathname deve ser exatamente /login").toBe("/login");
  const nextParam = current.searchParams.get("next");
  expect(nextParam, "param next deve estar presente").not.toBeNull();
  expect(nextParam, "next deve preservar EXATAMENTE a rota original").toBe(expectedNext);
  expect(
    nextParam?.startsWith("/login"),
    "next NÃO pode apontar de volta para /login (loop)",
  ).toBe(false);
}

test.describe("@smoke Session Recovery — JWT inválido (localStorage real)", () => {
  test.skip(
    !E2E_EMAIL || !E2E_PASSWORD,
    "Requer E2E_USER_EMAIL/E2E_USER_PASSWORD para login real (não mocked).",
  );

  test("refresh irrecuperável → signOut + redirect /login?next=<rota original>", async ({
    page,
  }) => {
    const ok = await loginViaUI(page, { email: E2E_EMAIL, password: E2E_PASSWORD });
    expect(ok, "login inicial deve ter sucesso").toBe(true);

    await gotoAndSettle(page, PROTECTED_ROUTE);
    const poisoned = await poisonLocalStorageToken(page, STORAGE_KEY);
    expect(poisoned, `localStorage[${STORAGE_KEY}] deve existir e ter access_token`).toBe(true);

    await page.reload();
    await triggerRevalidation(page);

    await expectRedirectedToLoginWithNext(page, PROTECTED_ROUTE);

    await expect(
      page
        .locator('[data-sonner-toast], [role="status"]')
        .filter({ hasText: /sess[aã]o expirou/i })
        .first(),
      "esperado toast 'Sua sessão expirou'",
    ).toBeVisible({ timeout: 8_000 });
  });

  test("erro transitório de rede no /token → NÃO desloga, sem redirect", async ({ page }) => {
    const ok = await loginViaUI(page, { email: E2E_EMAIL, password: E2E_PASSWORD });
    expect(ok, "login inicial deve ter sucesso").toBe(true);

    await gotoAndSettle(page, PROTECTED_ROUTE);

    // Sabota refresh com erro transitório de rede ANTES de envenenar o token,
    // garantindo que toda tentativa de refresh aborte com network error.
    let refreshAttempts = 0;
    await page.route(REFRESH_ENDPOINT_RE, async (route) => {
      refreshAttempts += 1;
      await route.abort("failed");
    });

    const poisoned = await poisonLocalStorageToken(page, STORAGE_KEY);
    expect(poisoned, `localStorage[${STORAGE_KEY}] deve existir e ter access_token`).toBe(true);

    await page.reload();
    await triggerRevalidation(page);

    // Aguarda janela para que recovery pudesse — incorretamente — redirecionar.
    // Assertiva negativa: page.waitForURL falha por timeout se redirect NÃO ocorrer.
    const redirected = await page
      .waitForURL(/\/login(\?|$)/, { timeout: 6_000 })
      .then(() => true)
      .catch(() => false);

    expect(refreshAttempts, "session-recovery deve ter tentado refresh ≥ 1×").toBeGreaterThanOrEqual(1);
    expect(redirected, "erro transitório de rede NÃO deve causar redirect para /login").toBe(false);

    const current = new URL(page.url());
    expect(current.pathname, `usuário deve permanecer em ${PROTECTED_ROUTE}`).toBe(PROTECTED_ROUTE);

    // E não deve ter aparecido o toast terminal de expiração.
    const expiredToastCount = await page
      .locator('[data-sonner-toast], [role="status"]')
      .filter({ hasText: /sess[aã]o expirou/i })
      .count();
    expect(expiredToastCount, "não deve mostrar toast 'sessão expirou' em erro transitório").toBe(0);
  });
});
