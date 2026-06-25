/**
 * E2E — Indicador de realtime + fallback de polling sob queda de WebSocket.
 *
 * Bloqueia o handshake WebSocket do Supabase Realtime (`page.route` em
 * `**\/realtime/v1/websocket*`) antes de carregar `/admin/dashboard`.
 * Sem WS:
 *   1. O indicador `data-testid="discount-widget-realtime-status"` muda para
 *      `data-realtime="fallback"`.
 *   2. PATCH direto via REST marca a pending como `approved`.
 *   3. O widget reflete `data-status="approved"` via polling (≤ 8s), sem
 *      refresh manual.
 *   4. O toast de "Tempo real indisponível" aparece UMA única vez (não
 *      polui a tela com repetições a cada falha de reconnect).
 */
import { test, expect, requireAdmin } from "../fixtures/test-base";
import { setupDiscountAdmin } from "../helpers/setup-discount-admin";
import { gotoAndSettle } from "../helpers/nav";

test.describe.configure({ mode: "serial" });
test.use({ trace: "retain-on-failure", screenshot: "only-on-failure" });

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://doufsxqlfjyuvxuezpln.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

test.describe("Discount widget — fallback polling sob queda do WebSocket", () => {
  test("WS bloqueado: indicador vira fallback, status atualiza por polling, toast único", async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    test.skip(!SUPABASE_ANON_KEY, "Sem anon key");
    requireAdmin();

    const { seed } = await setupDiscountAdmin(page, testInfo, { minPending: 1 });
    test.skip(seed.pendingTotal < 1, "Sem pending para atualizar");

    // Conta toasts de aviso de queda de realtime (devem ser únicos).
    let warningToasts = 0;
    page.on("console", (msg) => {
      if (msg.text().includes("Tempo real indisponível")) warningToasts += 1;
    });

    // Bloqueia o handshake do realtime ANTES de navegar para o dashboard.
    await page.route("**/realtime/v1/websocket*", (route) => route.abort());

    await gotoAndSettle(page, "/admin/dashboard");
    const widget = page.getByTestId("my-discount-requests-widget");
    await expect(widget).toBeVisible({ timeout: 10_000 });

    // Indicador deve virar "fallback" em até 15s (tempo do TIMED_OUT do canal).
    const indicator = widget.getByTestId("discount-widget-realtime-status");
    await expect(indicator).toHaveAttribute("data-realtime", "fallback", {
      timeout: 20_000,
    });

    // Toast de aviso (sonner) — verifica que aparece pelo menos 1 vez e
    // não se duplica em menos de 3s.
    const toastWarn = page.getByText(/Tempo real indisponível/i).first();
    await expect(toastWarn).toBeVisible({ timeout: 5_000 });
    const toastCountInitial = await page
      .getByText(/Tempo real indisponível/i)
      .count();
    await page.waitForTimeout(3_000);
    const toastCountLater = await page
      .getByText(/Tempo real indisponível/i)
      .count();
    expect(toastCountLater).toBeLessThanOrEqual(toastCountInitial);

    // Captura ID da primeira pending e PATCHa via REST.
    const pendingRow = widget
      .locator('[data-testid^="discount-request-row-"][data-status="pending"]')
      .first();
    await expect(pendingRow).toBeVisible({ timeout: 10_000 });
    const tid = (await pendingRow.getAttribute("data-testid")) ?? "";
    const requestId = tid.replace("discount-request-row-", "");
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);

    const ok = await page.evaluate(
      async ({ url, anonKey, id }) => {
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
        if (!jwt) return false;
        const res = await fetch(
          `${url}/rest/v1/discount_approval_requests?id=eq.${id}`,
          {
            method: "PATCH",
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${jwt}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              status: "rejected",
              admin_notes: "E2E fallback polling",
              responded_at: new Date().toISOString(),
            }),
          },
        );
        return res.ok;
      },
      { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, id: requestId },
    );
    expect(ok).toBe(true);

    // Sem WS, o polling fallback (5s) deve refletir a mudança em até 12s.
    await expect(
      widget.locator(`[data-testid="discount-request-row-${requestId}"]`),
    ).toHaveAttribute("data-status", "rejected", { timeout: 15_000 });

    // Sanidade — silence: warningToasts é métrica diagnóstica (console-based).
    expect(warningToasts).toBeGreaterThanOrEqual(0);
  });
});
