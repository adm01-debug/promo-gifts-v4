/**
 * E2E — Badge de pendentes do MyDiscountRequestsWidget atualiza em tempo real.
 *
 * Estratégia (alinhada ao 04cd):
 *   - Loga como admin (que também é seller das próprias solicitações), evitando
 *     skip da metade de decremento por RLS no PATCH `approved`.
 *   - Hidrata o widget navegando ao /admin/dashboard.
 *   - Seleciona um quote DO PRÓPRIO admin sem pending ativo, para não colidir
 *     com `uniq_dar_quote_pending` e garantir que o widget enxergue o evento
 *     realtime (filtrado por `seller_id=eq.<userId>`).
 *   - POST pending via REST com `seller_id = uid` (RLS `dar_insert_scope` exige).
 *   - PATCH approved via REST → assert decremento sem refresh em até 25s.
 *   - Cleanup `DELETE` do registro no afterEach.
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

interface SessionInfo {
  jwt: string;
  uid: string;
}

async function readJwtAndUid(
  page: import("@playwright/test").Page,
): Promise<SessionInfo> {
  return await page.evaluate<SessionInfo>(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("sb-") || !k.endsWith("-auth-token")) continue;
      try {
        const parsed = JSON.parse(localStorage.getItem(k) ?? "{}");
        const jwt = String(parsed?.access_token ?? "");
        const uid = String(parsed?.user?.id ?? "");
        if (jwt && uid) return { jwt, uid };
      } catch {
        /* noop */
      }
    }
    return { jwt: "", uid: "" };
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

/** Busca um quote DO PRÓPRIO usuário sem pending ativo. */
async function pickEligibleQuote(
  page: import("@playwright/test").Page,
  session: SessionInfo,
): Promise<string | null> {
  return await page.evaluate(
    async ({ url, anonKey, jwt, uid }) => {
      const headers = { apikey: anonKey, Authorization: `Bearer ${jwt}` };
      // Filtra por seller_id do próprio admin — garante que o widget
      // (filtrado por seller_id=eq.<userId>) receba o evento realtime.
      const qRes = await fetch(
        `${url}/rest/v1/quotes?select=id&seller_id=eq.${uid}&order=created_at.desc&limit=80`,
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
    { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, jwt: session.jwt, uid: session.uid },
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
    const session = await readJwtAndUid(page).catch(() => ({ jwt: "", uid: "" }));
    if (!session.jwt) return;
    await page
      .evaluate(
        async ({ url, anonKey, jwt, rId }) => {
          await fetch(
            `${url}/rest/v1/discount_approval_requests?id=eq.${rId}`,
            {
              method: "DELETE",
              headers: {
                apikey: anonKey,
                Authorization: `Bearer ${jwt}`,
                Prefer: "return=minimal",
              },
            },
          );
        },
        {
          url: SUPABASE_URL,
          anonKey: SUPABASE_ANON_KEY,
          jwt: session.jwt,
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
    // visibilidade prévia — apenas que o componente esteja anexado quando já há linhas.
    await page
      .locator(WIDGET_SEL)
      .first()
      .waitFor({ state: "attached", timeout: 5_000 })
      .catch(() => {
        /* tudo bem se o widget ainda não foi montado */
      });

    const session = await readJwtAndUid(page);
    expect(session.jwt, "JWT do admin presente no localStorage").toBeTruthy();
    expect(session.uid, "uid do admin presente no JWT").toBeTruthy();

    const quoteId = await pickEligibleQuote(page, session);
    test.skip(
      !quoteId,
      "Nenhum quote do admin sem pending ativo — pré-condição não satisfeita",
    );

    const before = await readBadgeCount(page);

    // INSERT via REST com seller_id = uid (RLS `dar_insert_scope` exige).
    const inserted = await page.evaluate(
      async ({ url, anonKey, jwt, uid, qId }) => {
        const res = await fetch(
          `${url}/rest/v1/discount_approval_requests`,
          {
            method: "POST",
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${jwt}`,
              "Content-Type": "application/json",
              Prefer: "return=representation",
            },
            body: JSON.stringify({
              quote_id: qId,
              seller_id: uid,
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
            body: text.slice(0, 300),
          };
        } catch {
          return { status: res.status, id: null, body: text.slice(0, 300) };
        }
      },
      {
        url: SUPABASE_URL,
        anonKey: SUPABASE_ANON_KEY,
        jwt: session.jwt,
        uid: session.uid,
        qId: quoteId!,
      },
    );

    expect(
      inserted.id,
      `INSERT pending falhou (status ${inserted.status}). Causa provável: RLS dar_insert_scope ou unique uniq_dar_quote_pending. Body: ${inserted.body}`,
    ).toBeTruthy();
    createdRequestId = inserted.id;

    // Assert incremento — realtime (postgres_changes) ou fallback de polling.
    await expect
      .poll(async () => await readBadgeCount(page), {
        timeout: 25_000,
        message: "badge não incrementou após INSERT (realtime+polling em até 25s)",
      })
      .toBeGreaterThan(before);

    const afterInsert = await readBadgeCount(page);
    expect(afterInsert).toBeGreaterThan(before);

    // PATCH para approved — admin decidindo a própria solicitação (mesmo padrão do 04cd).
    const patched = await page.evaluate(
      async ({ url, anonKey, jwt, rId }) => {
        const res = await fetch(
          `${url}/rest/v1/discount_approval_requests?id=eq.${rId}`,
          {
            method: "PATCH",
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${jwt}`,
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
            body: text.slice(0, 300),
          };
        } catch {
          return { status: res.status, ok: false, body: text.slice(0, 300) };
        }
      },
      {
        url: SUPABASE_URL,
        anonKey: SUPABASE_ANON_KEY,
        jwt: session.jwt,
        rId: createdRequestId!,
      },
    );

    expect(
      patched.ok,
      `PATCH approved falhou (status ${patched.status}). Causa provável: RLS dar_update_scope. Body: ${patched.body}`,
    ).toBe(true);

    // Assert decremento sem refresh manual.
    await expect
      .poll(async () => await readBadgeCount(page), {
        timeout: 25_000,
        message: "badge não decrementou após PATCH approved (realtime+polling em até 25s)",
      })
      .toBeLessThan(afterInsert);

    // Se voltou a 0, o badge deve sumir completamente.
    const finalCount = await readBadgeCount(page);
    if (finalCount === 0) {
      await expect(page.locator(BADGE_SEL)).toHaveCount(0);
    }
  });
});
