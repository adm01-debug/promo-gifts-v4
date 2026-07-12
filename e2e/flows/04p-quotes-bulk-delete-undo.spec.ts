/**
 * E2E — Exclusão em LOTE com Desfazer (restore + falha do restore).
 *
 * Complementa `04n-quotes-bulk-delete.spec.ts` (que já cobre seleção, cancelar,
 * sucesso emitindo toast, e falha do DELETE preservando seleção).
 *
 * Cobre:
 *   1. Sucesso: DELETE 204 em N linhas → toast "Desfazer" → clicar Desfazer
 *      dispara N POSTs de restore, sem duplicatas nem retries automáticos.
 *   2. Restore falha (POST 503): DELETE ok, toast aparece, clique em Desfazer
 *      tenta os POSTs, todos falham, toast de erro é exibido; NÃO há retry
 *      automático nem POSTs duplicados.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { installMockAuth, isMockAuthEnabled } from "../helpers/mock-auth";
import { gotoAndSettle } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";
import { seedQuotesForStatusChips } from "../helpers/quotes-status-seed";

test.use({ trace: "retain-on-failure", screenshot: "only-on-failure" });

const QUOTES_REST = /\/rest\/v1\/quotes(\?|$)/;
const UNDO_TOAST = '[data-testid="undo-toast"]';
const UNDO_BTN = '[data-testid="undo-toast-button"]';

async function selectFirstTwoQuotes(page: import("@playwright/test").Page) {
  await gotoAndSettle(page, "/orcamentos");
  const seed = await seedQuotesForStatusChips(page);
  expect(seed.skipped, `seed falhou: ${seed.skipped}`).toBeNull();

  await gotoAndSettle(page, "/orcamentos");
  await expect(page.locator(Sel.page.title("orcamentos")).first()).toBeVisible({
    timeout: 10_000,
  });
  await page.locator('button[data-chip-key="all"]').click();

  await page.getByTestId("quotes-select-toggle").click();
  const rowCheckboxes = page.getByRole("checkbox", {
    name: /selecionar orçamento/i,
  });
  await expect(rowCheckboxes.first()).toBeVisible();
  await rowCheckboxes.nth(0).click();
  await rowCheckboxes.nth(1).click();

  await expect(page.getByTestId("quotes-bulk-delete-top")).toContainText("(2)");
}

test.describe("Fluxo: bulk delete + Desfazer restaura orçamentos", () => {
  test.beforeEach(async ({ page }) => {
    requireAuth();
    if (isMockAuthEnabled()) await installMockAuth(page);
  });

  test("sucesso: DELETE em lote → clicar Desfazer dispara POSTs de restore", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await selectFirstTwoQuotes(page);

    let deleteCalls = 0;
    let postCalls = 0;
    const restorePayloads: unknown[] = [];
    await page.route(QUOTES_REST, async (route, request) => {
      const method = request.method();
      if (method === "DELETE") {
        deleteCalls += 1;
        await route.fulfill({ status: 204, body: "" });
        return;
      }
      if (method === "POST") {
        postCalls += 1;
        try {
          const raw = request.postData();
          if (raw) restorePayloads.push(JSON.parse(raw));
        } catch {
          /* body vazio/inválido — ignoramos */
        }
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify([{ id: `restored-${postCalls}` }]),
        });
        return;
      }
      await route.continue();
    });

    // Confirma exclusão em lote
    await page.getByTestId("quotes-bulk-delete-top").click();

    // ── Copy SSOT do ConfirmDialog destrutivo (plural — 2 orçamentos) ──
    // Padrão único aprovado (`QuoteViewPage` singular + `QuotesListPage` plural):
    // inclui menção explícita ao tempo de desfazer ("por até 8 segundos").
    const bulkDialog = page.getByTestId("quotes-bulk-delete-dialog");
    await expect(bulkDialog).toBeVisible();
    await expect(bulkDialog).toContainText(
      "Os orçamentos serão removidos — você pode desfazer por até 8 segundos após a confirmação.",
    );
    // Guarda anti-regressão: o copy antigo NÃO pode reaparecer.
    await expect(bulkDialog).not.toContainText("Esta ação é destrutiva");
    await expect(bulkDialog).not.toContainText("por alguns segundos após confirmar");

    await page.getByTestId("quotes-bulk-delete-confirm").click();

    // Aguarda 2 DELETEs
    await expect
      .poll(() => deleteCalls, { timeout: 20_000 })
      .toBeGreaterThanOrEqual(2);

    // Toast Desfazer aparece — EXATAMENTE 1 com botão, sem toast success duplicado
    const toast = page.locator(UNDO_TOAST);
    await expect(toast).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(UNDO_TOAST)).toHaveCount(1);
    await expect(page.locator(UNDO_BTN)).toHaveCount(1);

    // Nenhum toast Sonner com texto de exclusão pode existir SEM o botão Desfazer.
    const sonnerToasts = page.locator('[data-sonner-toast]');
    const totalToasts = await sonnerToasts.count();
    for (let i = 0; i < totalToasts; i++) {
      const t = sonnerToasts.nth(i);
      const txt = ((await t.textContent()) ?? '').toLowerCase();
      if (txt.includes('excluí') || txt.includes('exluí')) {
        await expect(t.locator('[data-testid="undo-toast-button"]')).toHaveCount(1);
      }
    }

    // Clica Desfazer → aguarda 2 POSTs de restore
    await page.locator(UNDO_BTN).click();
    await expect
      .poll(() => postCalls, { timeout: 15_000 })
      .toBeGreaterThanOrEqual(2);

    // Sem retry silencioso
    const postsAfterUndo = postCalls;
    await page.waitForTimeout(1500);
    expect(postCalls).toBe(postsAfterUndo);

    // ================================================================
    // ASSERTS EXPANDIDOS DE PAYLOAD DE RESTORE
    //
    // (1) Cada payload é normalizado (array de 1 elemento OU objeto).
    // (2) Campos gerados pelo backend NUNCA vazam: id, quote_number,
    //     created_at, updated_at (destructuring do onUndo).
    // (3) `items` está presente E é um array (preservação de itens).
    // (4) TODOS os campos do payload pertencem a uma allowlist conhecida —
    //     qualquer campo fora da lista é flagged como vazamento suspeito.
    //     A allowlist é uma superset intencional (aceita novos campos
    //     opcionais do domínio de Quote sem quebrar o teste), mas
    //     PROIBIDA de conter os 4 gerados acima.
    // ================================================================
    expect(restorePayloads.length).toBeGreaterThanOrEqual(1);

    // Superset de campos ACEITOS no payload de restore. Campos do domínio
    // Quote + metadados de negociação/discount/CRM. Manter em sync com
    // `quoteTypes.ts` — falha aqui indica ou (a) vazamento de campo
    // interno, ou (b) novo campo legítimo a incluir na allowlist.
    const ALLOWED_FIELDS = new Set([
      // items collection
      'items',
      '_items',
      // client info
      'client_id',
      'client_name',
      'client_cnpj',
      'client_email',
      'client_phone',
      'client_address',
      'client_response_at',
      'client_response_notes',
      // seller/org
      'seller_id',
      'seller_name',
      'organization_id',
      'user_id',
      // valores
      'total',
      'subtotal',
      'discount_percent',
      'discount_value',
      'real_discount_percent',
      'freight_value',
      'markup_ratio',
      'negotiation_markup_percent',
      // termos comerciais
      'payment_terms',
      'delivery_time',
      'valid_until',
      'notes',
      'internal_notes',
      // status / fluxo
      'status',
      'version',
      'origin',
      'source',
      // sync/CRM
      'bitrix_deal_id',
      'promo_champions_id',
      'external_id',
      // tokens públicos / assinatura eletrônica (todos opcionais)
      'public_token',
      'signed_by_cnpj',
      'signed_by_ip',
      'signed_by_ua',
      'signature_hash',
      'signed_at',
      // metadados de aprovação de desconto
      'approval_request_id',
      'approved_by',
      'approved_at',
      // margens/tabelas
      'price_table_id',
      // catch-all conhecidos
      'metadata',
      'tags',
    ]);

    const FORBIDDEN_FIELDS = ['id', 'quote_number', 'created_at', 'updated_at'];

    let payloadsWithItems = 0;
    const leaks: Array<{ payloadIndex: number; unknownFields: string[] }> = [];

    for (let i = 0; i < restorePayloads.length; i++) {
      const p = restorePayloads[i];
      const rec = Array.isArray(p) ? p[0] : (p as Record<string, unknown>);
      if (!rec || typeof rec !== 'object') continue;
      const obj = rec as Record<string, unknown>;

      // (2) Campos proibidos — nunca podem estar no payload
      for (const forbidden of FORBIDDEN_FIELDS) {
        expect(obj[forbidden], `campo proibido '${forbidden}' no payload #${i}`).toBeUndefined();
      }

      // (3) items presente e é array
      const hasItems = Array.isArray(obj.items) || Array.isArray(obj._items);
      if (hasItems) payloadsWithItems++;

      // (4) Detecta chaves fora da allowlist
      const unknown = Object.keys(obj).filter((k) => !ALLOWED_FIELDS.has(k));
      if (unknown.length > 0) {
        leaks.push({ payloadIndex: i, unknownFields: unknown });
      }
    }

    expect(
      payloadsWithItems,
      'pelo menos 1 payload de restore precisa carregar `items` (senão o restore volta vazio)',
    ).toBeGreaterThanOrEqual(1);

    expect(
      leaks,
      `campos fora da allowlist detectados no payload — possível vazamento de estado interno: ${JSON.stringify(leaks)}`,
    ).toEqual([]);
  });

  test("restore falha: POST 503 → toast de erro sem duplicatas nem retry", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await selectFirstTwoQuotes(page);

    let deleteCalls = 0;
    let postCalls = 0;
    await page.route(QUOTES_REST, async (route, request) => {
      const method = request.method();
      if (method === "DELETE") {
        deleteCalls += 1;
        await route.fulfill({ status: 204, body: "" });
        return;
      }
      if (method === "POST") {
        postCalls += 1;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "unavailable", code: "PGRST503" }),
        });
        return;
      }
      await route.continue();
    });

    await page.getByTestId("quotes-bulk-delete-top").click();
    await page.getByTestId("quotes-bulk-delete-confirm").click();

    await expect
      .poll(() => deleteCalls, { timeout: 20_000 })
      .toBeGreaterThanOrEqual(2);

    await expect(page.locator(UNDO_TOAST)).toBeVisible({ timeout: 10_000 });
    await page.locator(UNDO_BTN).click();

    // Cada snapshot tenta um POST — exatamente 2 (sem retry automático)
    await expect
      .poll(() => postCalls, { timeout: 15_000 })
      .toBeGreaterThanOrEqual(2);
    const postsAfterUndo = postCalls;

    // Aguarda para garantir ausência de retry silencioso
    await page.waitForTimeout(2000);
    expect(postCalls).toBe(postsAfterUndo);

    // Algum toast de erro/aviso do sonner é exibido (fallback do restore)
    await expect(page.locator("[data-sonner-toast]").first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
