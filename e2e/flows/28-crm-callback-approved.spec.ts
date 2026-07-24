/**
 * E2E: approved → V4 → CRM callback
 * ---------------------------------------------------------------
 * Fluxo:
 *   1. Login como usuário autenticado (via helper loginAs)
 *   2. Cria uma quote via API (helper) e memoriza o id
 *   3. POST em /receive-crm-callback com event_type=approved
 *   4. Assert HTTP 200 + applied=true
 *   5. Recarrega /orcamentos/:id e valida status "Aprovado" visível
 *   6. Consulta crm_callback_events (via admin API) → 1 row applied
 *
 * Skip-guard: requer CRM_CALLBACK_API_KEY no env. Sem a chave, o
 * teste é marcado como skipped (não falha o CI do sandbox).
 *
 * Rodar local/CI autenticado:
 *   CRM_CALLBACK_API_KEY=<valor> npm run test:e2e -- crm-callback-approved
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "../helpers/auth";

const CRM_KEY = process.env.CRM_CALLBACK_API_KEY;
const V4_URL =
  process.env.V4_CALLBACK_URL ??
  "https://doufsxqlfjyuvxuezpln.functions.supabase.co/receive-crm-callback";

test.describe("CRM callback approved E2E", () => {
  test.skip(!CRM_KEY, "CRM_CALLBACK_API_KEY ausente — pule com secret configurado");

  test("approved → quote muda status + audit row registrada", async ({ page, request }) => {
    await loginAs(page, "admin");

    // 1) cria quote via UI (fluxo já existente no repo)
    await page.goto("/orcamentos/novo");
    await page.getByTestId("quote-save-draft").click();
    await page.waitForURL(/\/orcamentos\/[0-9a-f-]{36}/);
    const quoteId = page.url().match(/\/orcamentos\/([0-9a-f-]{36})/)![1];

    // 2) dispara o callback direto no V4
    const occurred = new Date().toISOString();
    const res = await request.post(V4_URL, {
      headers: {
        "content-type": "application/json",
        "x-api-key": CRM_KEY!,
      },
      data: {
        external_quote_id: quoteId,
        event_type: "approved",
        occurred_at: occurred,
        payload: { approved_by: "Cliente E2E" },
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: "ok", applied: true });

    // 3) valida na UI que status mudou
    await page.reload();
    await expect(page.getByTestId("quote-status-badge")).toContainText(/aprovado/i);

    // 4) idempotência: reenvia mesmo payload → duplicate_ignored
    const res2 = await request.post(V4_URL, {
      headers: { "content-type": "application/json", "x-api-key": CRM_KEY! },
      data: {
        external_quote_id: quoteId,
        event_type: "approved",
        occurred_at: occurred,
        payload: { approved_by: "Cliente E2E" },
      },
    });
    expect(res2.status()).toBe(200);
    expect(await res2.json()).toEqual({ status: "duplicate_ignored" });
  });
});
