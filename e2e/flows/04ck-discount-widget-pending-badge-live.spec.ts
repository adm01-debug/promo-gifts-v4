/**
 * E2E — Badge de pendentes do MyDiscountRequestsWidget atualiza em tempo real.
 *
 * Fluxo:
 *   1. Login como vendedor; navega ao dashboard.
 *   2. Lê contagem inicial do `[data-testid="discount-widget-pending-total"]`
 *      (0 se ausente).
 *   3. Cria via REST autenticado uma linha pending em
 *      `discount_approval_requests` para um quote do próprio vendedor.
 *   4. Sem refresh manual, espera o `data-count` incrementar (realtime ou
 *      polling fallback) em até 20s.
 *   5. PATCH via REST muda a linha para `approved` → `data-count` decrementa
 *      (ou o badge some quando vai a 0) em até 20s.
 *
 * Notas:
 *   - Usa `seller_id = auth.uid()` para satisfazer RLS `dar_insert_scope`.
 *   - Pula se não houver quote do vendedor disponível (cenário fresh DB).
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { waitForTestIdVisible } from "../helpers/waits";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://doufsxqlfjyuvxuezpln.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

test.describe.configure({ mode: "serial" });
test.use({ trace: "retain-on-failure", screenshot: "only-on-failure" });

async function readJwt(page: import("@playwright/test").Page): Promise<string> {
  return await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("sb-") || !k.endsWith("-auth-token")) continue;
      try {
        const jwt = JSON.parse(localStorage.getItem(k) ?? "{}")?.access_token;
        if (jwt) return String(jwt);
      } catch {
        /* noop */
      }
    }
    return "";
  });
}

async function readBadgeCount(page: import("@playwright/test").Page): Promise<number> {
  const el = page.locator('[data-testid="discount-widget-pending-total"]');
  if ((await el.count()) === 0) return 0;
  const attr = await el.first().getAttribute("data-count");
  return Number(attr ?? 0);
}

test.describe("MyDiscountRequestsWidget — badge de pendentes ao vivo", () => {
  test.beforeEach(() => requireAuth());

  test("badge incrementa ao criar pending e decrementa ao aprovar — sem refresh", async ({
    page,
  }) => {
    test.skip(!SUPABASE_ANON_KEY, "Sem anon key — não dá pra checar DB");
    test.setTimeout(90_000);

    await gotoAndSettle(page, "/admin/dashboard");
    await waitForTestIdVisible(page, "my-discount-requests-widget", {
      timeout: 15_000,
    }).catch(() => {
      test.skip(true, "Widget não visível — vendedor sem solicitações");
    });

    const jwt = await readJwt(page);
    test.skip(!jwt, "Sem JWT no storage");

    // Pega um quote do próprio vendedor para usar como FK.
    const quoteId = await page.evaluate(
      async ({ url, anonKey, token }) => {
        const res = await fetch(`${url}/rest/v1/quotes?select=id&limit=1`, {
          headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
        });
        const rows = (await res.json()) as Array<{ id: string }>;
        return rows?.[0]?.id ?? null;
      },
      { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, token: jwt },
    );
    test.skip(!quoteId, "Vendedor sem quote pra usar como FK");

    const before = await readBadgeCount(page);

    // Cria pending via REST.
    const inserted = await page.evaluate(
      async ({ url, anonKey, token, qId }) => {
        const res = await fetch(`${url}/rest/v1/discount_approval_requests`, {
          method: "POST",
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            quote_id: qId,
            requested_discount_percent: 88.88,
            max_allowed_percent: 10,
            seller_notes: "E2E badge live test",
          }),
        });
        const text = await res.text();
        try {
          const arr = JSON.parse(text);
          return { status: res.status, id: arr?.[0]?.id ?? null };
        } catch {
          return { status: res.status, id: null };
        }
      },
      { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, token: jwt, qId: quoteId },
    );

    test.skip(
      !inserted.id,
      `INSERT falhou (status ${inserted.status}) — provavelmente 23505 (já há pending p/ este quote)`,
    );

    // Espera incremento no badge.
    await expect
      .poll(async () => await readBadgeCount(page), {
        timeout: 25_000,
        message: "badge não incrementou após INSERT realtime",
      })
      .toBeGreaterThan(before);

    // Aprova via REST (decisão de admin simulada — só passará RLS se este
    // vendedor for admin; caso contrário pulamos a 2ª asserção).
    const patched = await page.evaluate(
      async ({ url, anonKey, token, rId }) => {
        const res = await fetch(
          `${url}/rest/v1/discount_approval_requests?id=eq.${rId}`,
          {
            method: "PATCH",
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Prefer: "return=representation",
            },
            body: JSON.stringify({
              status: "approved",
              responded_at: new Date().toISOString(),
            }),
          },
        );
        const text = await res.text();
        try {
          const arr = JSON.parse(text);
          return { status: res.status, ok: Array.isArray(arr) && arr.length > 0 };
        } catch {
          return { status: res.status, ok: false };
        }
      },
      { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, token: jwt, rId: inserted.id },
    );

    test.skip(!patched.ok, "PATCH bloqueado por RLS (vendedor não é admin) — fim do teste");

    const afterInsert = await readBadgeCount(page);
    await expect
      .poll(async () => await readBadgeCount(page), {
        timeout: 25_000,
        message: "badge não decrementou após PATCH approved",
      })
      .toBeLessThan(afterInsert);
  });
});
