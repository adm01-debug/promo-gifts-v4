/**
 * E2E — Widget do vendedor atualiza via realtime após decisão admin.
 *
 * Cenário em UMA aba (admin que é seu próprio "seller"):
 *   1. Seed 1+ pending com seller_id = admin (helper já faz isso).
 *   2. Abre `/admin/dashboard` que renderiza `MyDiscountRequestsWidget`.
 *   3. Expande o card pending e confirma `data-status="pending"`.
 *   4. PATCH direto via REST (status='approved') usando JWT do localStorage.
 *   5. Sem reload, o widget deve refletir `data-status="approved"` em até 15s
 *      — primeiro pela mensagem realtime (postgres_changes); fallback de
 *      polling cobre caso o WebSocket esteja indisponível no CI.
 */
import { test, expect, requireAdmin } from "../fixtures/test-base";
import { setupDiscountAdmin } from "../helpers/setup-discount-admin";
import { gotoAndSettle } from "../helpers/nav";

test.describe.configure({ mode: "parallel" });
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

test.describe("Discount widget — realtime update", () => {
  test("status muda de pending para approved sem refresh manual", async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    test.skip(!SUPABASE_ANON_KEY, "Sem anon key — não dá pra disparar PATCH");
    requireAdmin();

    const { seed } = await setupDiscountAdmin(page, testInfo, { minPending: 1 });
    test.skip(seed.pendingTotal < 1, "Sem pending para atualizar");

    await gotoAndSettle(page, "/admin/dashboard");
    const widget = page.getByTestId("my-discount-requests-widget");
    await expect(widget).toBeVisible({ timeout: 10_000 });

    const pendingRow = widget
      .locator('[data-testid^="discount-request-row-"][data-status="pending"]')
      .first();
    await expect(pendingRow).toBeVisible({ timeout: 10_000 });
    const tid = (await pendingRow.getAttribute("data-testid")) ?? "";
    const requestId = tid.replace("discount-request-row-", "");
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);

    // PATCH direto via REST — simula a decisão do admin sem clicar na fila.
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
              status: "approved",
              responded_at: new Date().toISOString(),
            }),
          },
        );
        return res.ok;
      },
      { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, id: requestId },
    );
    expect(ok).toBe(true);

    // Sem reload — realtime + polling de 15s devem refletir em até 20s.
    await expect(
      widget.locator(`[data-testid="discount-request-row-${requestId}"]`),
    ).toHaveAttribute("data-status", "approved", { timeout: 20_000 });
  });
});
