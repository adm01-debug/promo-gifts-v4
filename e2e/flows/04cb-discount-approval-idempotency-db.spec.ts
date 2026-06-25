/**
 * E2E — Idempotência ao nível de DB.
 *
 * Complementa `04c2`: além de confirmar 1 redirect/0 toast de erro, conta
 * via REST quantas linhas `pending` existem para o quote criado depois de
 * múltiplos cliques rápidos no submit. Esperado: exatamente 1.
 *
 * A contagem usa a sessão do próprio vendedor (RLS `dar_select_scope`
 * permite SELECT das próprias linhas), sem precisar de service_role.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { waitForTestIdVisible } from "../helpers/waits";
import { Sel } from "../fixtures/selectors";

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

test.describe("Discount approval — idempotência (DB count)", () => {
  test.beforeEach(() => requireAuth());

  test("triplo clique resulta em exatamente 1 pending no banco", async ({ page }) => {
    test.skip(!SUPABASE_ANON_KEY, "Sem VITE_SUPABASE_PUBLISHABLE_KEY — não dá pra checar DB");
    test.setTimeout(90_000);

    await gotoAndSettle(page, "/orcamentos/novo");
    await waitForTestIdVisible(page, "quote-wizard", { timeout: 15_000 });

    await page.locator('[data-testid="company-search-input"]').first().click();
    await page.locator(Sel.quote.noCompanyOption).first().click();
    await page.locator(Sel.quote.addProductButton).first().click();
    await page.locator(Sel.quote.productSearchInput).first().waitFor({ state: "visible" });
    const productCount = await page.locator(Sel.quote.productSearchOption).count();
    test.skip(productCount === 0, "Catálogo vazio");
    await page.locator(Sel.quote.productSearchOption).first().click();
    const noColor = page.locator(Sel.quote.addWithoutColor).first();
    if (await noColor.isVisible().catch(() => false)) await noColor.click();
    await page.locator(Sel.quote.item(0)).first().waitFor({ state: "visible" });

    const discountInput = page.locator(Sel.quote.discountInput).first();
    await discountInput.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.type("75");
    await page.keyboard.press("Tab");

    const requestApproval = page.locator(Sel.quote.requestApprovalButton).first();
    const shown = await requestApproval.isVisible({ timeout: 5_000 }).catch(() => false);
    test.skip(!shown, "Vendedor sem limite < 75% — fluxo de alçada não disparou");

    await requestApproval.click();
    await waitForTestIdVisible(page, "quote-approval-dialog", { timeout: 10_000 });
    await page
      .locator(Sel.quote.approvalJustification)
      .first()
      .fill("E2E idempotência DB — triplo clique");

    const submit = page.locator(Sel.quote.approvalSubmit).first();
    await expect(submit).toBeEnabled({ timeout: 5_000 });

    // Triplo clique concorrente (rejeitamos erros isolados de "elemento removido")
    await Promise.all([
      submit.click(),
      submit.click().catch(() => null),
      submit.click().catch(() => null),
    ]);

    await page.waitForURL(/\/orcamentos\/[0-9a-f-]{36}/, { timeout: 25_000 });
    const quoteUuid = page.url().match(/\/orcamentos\/([0-9a-f-]{36})/)?.[1];
    expect(quoteUuid).toBeTruthy();

    // Conta pending via REST com a sessão atual (RLS scope = seller dono).
    const count = await page.evaluate(
      async ({ url, anonKey, quoteId }) => {
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
        if (!jwt) return -1;
        const res = await fetch(
          `${url}/rest/v1/discount_approval_requests?quote_id=eq.${quoteId}&status=eq.pending&select=id`,
          {
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${jwt}`,
              Prefer: "count=exact",
            },
          },
        );
        const range = res.headers.get("content-range") ?? "0/0";
        return Number(range.split("/")[1] ?? 0);
      },
      { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, quoteId: quoteUuid! },
    );

    test.skip(count === -1, "JWT ausente no localStorage — não foi possível consultar DB");
    expect(count).toBe(1);
  });
});
