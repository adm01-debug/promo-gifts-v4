/**
 * E2E — Badge de pendentes do MyDiscountRequestsWidget atualiza em tempo real.
 *
 * Estratégia (alinhada ao 04cd):
 *   - Loga como admin (que também é seller das próprias solicitações), evitando
 *     skip da metade de decremento por RLS no PATCH `approved`.
 *   - Hidrata o widget navegando ao /admin/dashboard.
 *   - Seleciona um quote do próprio admin SEM pending ativo, para não colidir
 *     com o índice único parcial `uniq_dar_quote_pending` (que viraria skip).
 *   - Lê `data-count` (0 quando o badge ainda não existe).
 *   - POST pending via REST → assert incremento sem refresh em até 25s.
 *   - PATCH approved via REST → assert decremento sem refresh em até 25s.
 *   - Cleanup do registro criado no afterEach.
 */
import { test, expect, requireAdmin } from "../fixtures/test-base";
import { loginAs } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/nav";
import { TID } from "../fixtures/selectors";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://doufsxqlfjyuvxuezpln.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

const BADGE_SEL = TID("discount-widget-pending-total");
const WIDGET_SEL = TID("my-discount-requests-widget");

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

async function readBadgeCount(
  page: import("@playwright/test").Page,
): Promise<number> {
  const el = page.locator(BADGE_SEL);
  if ((await el.count()) === 0) return 0;
  const attr = await el.first().getAttribute("data-count");
  return Number(attr ?? 0);
}

/** Busca um quote do próprio usuário que ainda não tenha pending request. */
async function pickEligibleQuote(
  page: import("@playwright/test").Page,
  jwt: string,
): Promise<string | null> {
  return await page.evaluate(
    async ({ url, anonKey, token }) => {
      const headers = { apikey: anonKey, Authorization: `Bearer ${token}` };
      const qRes = await fetch(
        `${url}/rest/v1/quotes?select=id&order=created_at.desc&limit=40`,
        { headers },
      );
      if (!qRes.ok) return null;
      const quotes = (await qRes.json()) as Array<{ id: string }>;
      if (quotes.length === 0) return null;
      const idsParam = quotes.map((q) => q.id).join(",");
      const pRes = await fetch(
        `${url}/rest/v1/discount_approval_requests?select=quote_id&status=eq.pending&quote_id=in.(${idsParam})`,
        { headers },
      );
      const taken = new Set<string>(
        pRes.ok
          ? ((await pRes.json()) as Array<{ quote_id: string }>).map(
              (r) => r.quote_id,
            )
          : [],
      );
      const free = quotes.find((q) => !taken.has(q.id));
      return free?.id ?? null;
    },
    { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, token: jwt },
  );
}

test.describe("MyDiscountRequestsWidget — badge de pendentes ao vivo", () => {
  let createdRequestId: string | null = null;

  test.beforeEach(async ({ page }) => {
    requireAdmin();
    test.skip(!SUPABASE_ANON_KEY, "Sem anon key — não dá pra checar DB");
    await loginAs(page, "admin");
    createdRequestId = null;
  });

  test.afterEach(async ({ page }) => {
    if (!createdRequestId) return;
    const jwt = await readJwt(page).catch(() => "");
    if (!jwt) return;
    await page
      .evaluate(
        async ({ url, anonKey, token, rId }) => {
          await fetch(
            `${url}/rest/v1/discount_approval_requests?id=eq.${rId}`,
            {
              method: "DELETE",
              headers: {
                apikey: anonKey,
                Authorization: `Bearer ${token}`,
                Prefer: "return=minimal",
              },
            },
          );
        },
        {
          url: SUPABASE_URL,
          anonKey: SUPABASE_ANON_KEY,
          token: jwt,
          rId: createdRequestId,
        },
      )
      .catch(() => {
        /* best-effort cleanup */
      });
    createdRequestId = null;
  });

  test("badge incrementa ao criar pending e decrementa ao aprovar — sem refresh", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await gotoAndSettle(page, "/admin/dashboard");
    // Widget pode estar oculto até existir 1 pending; o teste valida AMBOS os
    // estados (ausente=0 → presente=N → ausente=0). Por isso não exigimos
    // visibilidade prévia do widget — só lemos o badge.
    await page
      .locator(WIDGET_SEL)
      .first()
      .waitFor({ state: "attached", timeout: 5_000 })
      .catch(() => {
        /* tudo bem se o widget ainda não existe */
      });

    const jwt = await readJwt(page);
    expect(jwt, "JWT do admin presente no localStorage").toBeTruthy();

    const quoteId = await pickEligibleQuote(page, jwt);
    test.skip(
      !quoteId,
      "Nenhum quote do admin sem pending ativo disponível — pré-condição não satisfeita",
    );

    const before = await readBadgeCount(page);

    // Cria pending via REST (sem usar o caminho de UI, para isolar a validação
    // de realtime/polling do widget).
    const inserted = await page.evaluate(
      async ({ url, anonKey, token, qId }) => {
        const res = await fetch(
          `${url}/rest/v1/discount_approval_requests`,
          {
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
              seller_notes: "E2E 04ck badge live test",
            }),
          },
        );
        const text = await res.text();
        try {
          const arr = JSON.parse(text);
          return {
            status: res.status,
            id: Array.isArray(arr) ? (arr[0]?.id ?? null) : null,
          };
        } catch {
          return { status: res.status, id: null };
        }
      },
      { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, token: jwt, qId: quoteId! },
    );

    expect(
      inserted.id,
      `INSERT pending deve retornar id (status ${inserted.status})`,
    ).toBeTruthy();
    createdRequestId = inserted.id;

    // Assert incremento — realtime (postgres_changes) ou fallback de polling.
    await expect
      .poll(async () => await readBadgeCount(page), {
        timeout: 25_000,
        message: "badge não incrementou após INSERT (realtime+polling)",
      })
      .toBeGreaterThan(before);

    const afterInsert = await readBadgeCount(page);
    expect(afterInsert).toBeGreaterThan(before);

    // PATCH para approved — admin pode decidir suas próprias solicitações.
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
          return {
            status: res.status,
            ok: Array.isArray(arr) && arr.length > 0,
          };
        } catch {
          return { status: res.status, ok: false };
        }
      },
      {
        url: SUPABASE_URL,
        anonKey: SUPABASE_ANON_KEY,
        token: jwt,
        rId: createdRequestId!,
      },
    );

    expect(
      patched.ok,
      `PATCH approved deve passar (status ${patched.status}) — admin decide suas próprias solicitações`,
    ).toBe(true);

    // Assert decremento sem refresh manual.
    await expect
      .poll(async () => await readBadgeCount(page), {
        timeout: 25_000,
        message: "badge não decrementou após PATCH approved",
      })
      .toBeLessThan(afterInsert);

    // Se voltou a 0, o badge deve sumir completamente.
    const finalCount = await readBadgeCount(page);
    if (finalCount === 0) {
      await expect(page.locator(BADGE_SEL)).toHaveCount(0);
    }
  });
});
