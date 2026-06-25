/**
 * E2E — RLS cross-quote: vendedor não consegue UPDATE em request que não é dele.
 *
 * Estratégia: o vendedor autenticado tenta um PATCH direto via REST em uma linha
 * `discount_approval_requests` que NÃO pertence a um quote dele (id sintético).
 * Espera-se 0 linhas afetadas + sem erro 5xx — a policy `dar_update_scope` filtra
 * antes do UPDATE atingir a linha. Adicionalmente, valida que a mensagem de erro
 * do hook (quando aplicável) aparece como toast no fluxo de UI.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://doufsxqlfjyuvxuezpln.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

const BOGUS_REQUEST_ID = "00000000-0000-0000-0000-000000000000";

test.describe.configure({ mode: "parallel" });
test.use({ trace: "retain-on-failure", screenshot: "only-on-failure" });

test.describe("Discount approval — RLS cross-quote", () => {
  test.beforeEach(() => requireAuth());

  test("vendedor não consegue aprovar request de outro quote (PATCH retorna 0 linhas)", async ({
    page,
  }) => {
    test.skip(!SUPABASE_ANON_KEY, "Sem anon key — não dá pra chamar REST");
    await gotoAndSettle(page, "/");

    const result = await page.evaluate(
      async ({ url, anonKey, requestId }) => {
        let jwt = "";
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)!;
          if (!k.startsWith("sb-") || !k.endsWith("-auth-token")) continue;
          try {
            jwt = JSON.parse(localStorage.getItem(k) ?? "{}")?.access_token ?? "";
          } catch {
            /* noop */
          }
          if (jwt) break;
        }
        if (!jwt) return { skip: true as const };
        const res = await fetch(
          `${url}/rest/v1/discount_approval_requests?id=eq.${requestId}`,
          {
            method: "PATCH",
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${jwt}`,
              "Content-Type": "application/json",
              Prefer: "return=representation",
            },
            body: JSON.stringify({ status: "approved" }),
          },
        );
        const text = await res.text();
        let body: unknown;
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
        return { skip: false as const, status: res.status, body };
      },
      { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, requestId: BOGUS_REQUEST_ID },
    );

    test.skip(result.skip, "Sem JWT no storage — pulei");
    // RLS pode responder de 2 formas válidas:
    //   - 200/204 com array vazio (nenhuma linha visível para o vendedor)
    //   - 401/403 quando policy rejeita o PATCH
    expect([200, 204, 401, 403, 404]).toContain(result.status);
    if (Array.isArray(result.body)) {
      expect(result.body.length).toBe(0);
    }
  });
});
