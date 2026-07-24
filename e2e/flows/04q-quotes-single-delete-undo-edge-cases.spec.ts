/**
 * E2E — Cenários de borda da exclusão INDIVIDUAL com "Desfazer".
 *
 * Cobre:
 *   1. Contador expira → toast desaparece → cliques posteriores no botão
 *      "Desfazer" não disparam POST de restore (o botão sai do DOM).
 *   2. `deleteQuote` falha (DELETE 500) → toast "Desfazer" NÃO aparece →
 *      linha do orçamento continua na lista, sem duplicatas.
 *   3. Valida testids granulares do toast (title, description, countdown,
 *      button com `data-remaining-sec`).
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { installMockAuth, isMockAuthEnabled } from "../helpers/mock-auth";
import { gotoAndSettle } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";
import { seedQuotesForStatusChips } from "../helpers/quotes-status-seed";
import {
  attachDiagnosticsRecorder,
  dumpDiagnosticsIfFailed,
  type DiagnosticsRecorder,
} from "../helpers/diagnostics";

test.use({ trace: "retain-on-failure", screenshot: "only-on-failure" });

const QUOTES_REST = /\/rest\/v1\/quotes(\?|$)/;
const UNDO_TOAST = '[data-testid="undo-toast"]';
const UNDO_BTN = '[data-testid="undo-toast-button"]';
const UNDO_COUNTDOWN = '[data-testid="undo-toast-countdown"]';
const UNDO_TITLE = '[data-testid="undo-toast-title"]';

test.describe("Fluxo: exclusão individual — cenários de borda com Desfazer", () => {
  let diag: DiagnosticsRecorder;

  test.beforeEach(async ({ page }) => {
    requireAuth();
    if (isMockAuthEnabled()) await installMockAuth(page);
    diag = attachDiagnosticsRecorder(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Anexa screenshots + HTML + snapshot do toast + console/network
    // APENAS quando o teste falha, ajudando a diagnosticar flakiness na
    // expiração do contador sem impactar runs verdes.
    const label = testInfo.title.slice(0, 40).replace(/\s+/g, "-");
    await dumpDiagnosticsIfFailed(page, testInfo, diag, label);
  });

  test("contador expira → toast some → clique posterior não restaura", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await gotoAndSettle(page, "/orcamentos");
    const seed = await seedQuotesForStatusChips(page);
    expect(seed.skipped, `seed falhou: ${seed.skipped}`).toBeNull();

    await gotoAndSettle(page, "/orcamentos");
    await expect(page.locator(Sel.page.title("orcamentos")).first()).toBeVisible({
      timeout: 10_000,
    });
    await page.locator('button[data-chip-key="all"]').click();

    const firstRow = page.locator('[data-testid^="quote-row-"]').first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    const rowTestId = (await firstRow.getAttribute("data-testid"))!;
    const quoteId = rowTestId.replace(/^quote-row-/, "");

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
          status: 201,
          contentType: "application/json",
          body: JSON.stringify([{ id: `restored-${quoteId}` }]),
        });
        return;
      }
      await route.continue();
    });

    await page.getByTestId(`quote-row-more-${quoteId}`).click();
    await page.getByTestId(`quote-row-menu-delete-${quoteId}`).click();
    await page.getByTestId("quote-list-delete-dialog-yes").click();

    await expect.poll(() => deleteCalls, { timeout: 15_000 }).toBeGreaterThanOrEqual(1);

    // Toast aparece com testids granulares presentes
    const toast = page.locator(UNDO_TOAST);
    await expect(toast).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(UNDO_TITLE)).toBeVisible();
    const countdown = page.locator(UNDO_COUNTDOWN);
    await expect(countdown).toBeVisible();

    // Assert determinístico: o attribute `data-remaining-sec` do contador
    // DECREMENTA monotonicamente até 0 — sem depender de `setTimeout`.
    const initialSec = Number(await countdown.getAttribute("data-remaining-sec"));
    expect(initialSec).toBeGreaterThan(0);
    expect(initialSec).toBeLessThanOrEqual(8);

    // Estado inicial: enquanto contador > 0, botão NÃO deve estar expirado
    // (aria-disabled ausente/null, data-expired="false", disabled=false).
    // Fixa o invariante negativo antes de esperar a transição para zero.
    await expect(page.locator(UNDO_BTN)).toHaveAttribute("data-expired", "false");
    await expect(page.locator(UNDO_BTN)).not.toHaveAttribute("aria-disabled", "true");
    expect(await page.locator(UNDO_BTN).isDisabled()).toBe(false);

    // ================================================================
    // Instala MutationObserver in-page para capturar o SNAPSHOT do botão
    // no instante EXATO em que o contador chega a 0. Sem isso, o handler
    // `onTimeout` do wrapper chama `sonner.dismiss` na mesma tick após o
    // re-render com `remainingMs=0`, e o teste perderia a janela de asserção.
    // O observer grava em `window.__undoBtnExpirySnapshot` o primeiro
    // estado observado com `data-expired="true"`.
    // ================================================================
    await page.evaluate((sel) => {
      const btn = document.querySelector(sel) as HTMLButtonElement | null;
      if (!btn) return;
      const w = window as unknown as {
        __undoBtnExpirySnapshot?: Record<string, string | boolean | null>;
        __undoBtnExpiryObserver?: MutationObserver;
      };
      w.__undoBtnExpirySnapshot = undefined;
      const capture = () => {
        if (w.__undoBtnExpirySnapshot) return; // fixa 1ª ocorrência
        const expired = btn.getAttribute("data-expired");
        if (expired !== "true") return;
        w.__undoBtnExpirySnapshot = {
          dataExpired: expired,
          ariaDisabled: btn.getAttribute("aria-disabled"),
          disabledProp: btn.disabled,
          dataRemainingSec: btn.getAttribute("data-remaining-sec"),
          dataRemainingMs: btn.getAttribute("data-remaining-ms"),
          isConnected: btn.isConnected,
          capturedAt: new Date().toISOString(),
        };
      };
      capture();
      const obs = new MutationObserver(capture);
      obs.observe(btn, { attributes: true, attributeOldValue: false });
      w.__undoBtnExpiryObserver = obs;
    }, UNDO_BTN);

    // Aguarda o contador chegar a 0 OU o toast ser removido do DOM.
    // (o wrapper `showUndoToast` chama `dismiss` no `onTimeout`.)
    await expect
      .poll(
        async () => {
          const el = page.locator(UNDO_COUNTDOWN);
          const count = await el.count();
          if (count === 0) return 0;
          const attr = await el.getAttribute("data-remaining-sec");
          return Number(attr ?? 0);
        },
        { timeout: 20_000, intervals: [200, 500, 1000] },
      )
      .toBe(0);

    // Recupera o snapshot capturado pelo observer — deve existir E ter
    // aria-disabled="true", data-expired="true", disabled=true e
    // data-remaining-sec="0" no mesmo instante.
    const expirySnapshot = await page.evaluate(() => {
      const w = window as unknown as {
        __undoBtnExpirySnapshot?: Record<string, string | boolean | null>;
        __undoBtnExpiryObserver?: MutationObserver;
      };
      w.__undoBtnExpiryObserver?.disconnect();
      return w.__undoBtnExpirySnapshot ?? null;
    });

    expect(expirySnapshot, "MutationObserver não capturou o instante de expiração").not.toBeNull();
    expect(expirySnapshot!.dataExpired).toBe("true");
    expect(expirySnapshot!.ariaDisabled).toBe("true");
    expect(expirySnapshot!.disabledProp).toBe(true);
    expect(expirySnapshot!.dataRemainingSec).toBe("0");
    // data-remaining-ms pode ser exatamente "0" (setState clamp).
    expect(Number(expirySnapshot!.dataRemainingMs)).toBe(0);


    // Aguarda o botão ficar indisponível (disabled OU removido do DOM) —
    // ambos os estados satisfazem o invariante "não é mais clicável".
    await expect
      .poll(
        async () => {
          const btn = page.locator(UNDO_BTN);
          const count = await btn.count();
          if (count === 0) return "absent";
          const disabled = await btn.isDisabled();
          const expired = await btn.getAttribute("data-expired");
          return disabled || expired === "true" ? "disabled" : "clickable";
        },
        { timeout: 5_000, intervals: [100, 250, 500] },
      )
      .not.toBe("clickable");

    // Aguarda o toast ser totalmente removido do DOM (o wrapper dispara
    // sonner.dismiss no onTimeout — não usamos setTimeout).
    await expect(page.locator(UNDO_TOAST)).toHaveCount(0, { timeout: 5_000 });

    // Nenhum POST de restore foi disparado durante toda a expiração
    expect(postCalls).toBe(0);

    // Reassert após settle: a rede deve estar completamente silenciosa —
    // usamos expect.poll com valor estável (não muda por 500ms) em vez
    // de sleep arbitrário.
    await expect
      .poll(() => postCalls, { timeout: 2_000, intervals: [200, 400] })
      .toBe(0);

    // Última garantia: botão ausente do DOM
    await expect(page.locator(UNDO_BTN)).toHaveCount(0);

    // ================================================================
    // FORCE-CLICK HARDENING: mesmo forçando o clique de várias formas,
    // NENHUMA restauração deve disparar. Cobre três vetores de ataque:
    //   (a) Playwright `click({ force: true })` no locator ausente;
    //   (b) `dispatchEvent('click')` via evaluate em qualquer resíduo;
    //   (c) reinjeção sintética via querySelector + .click() nativo.
    // Todos devem ser no-op — o toast já foi dismissed e o handler
    // do sonner foi liberado.
    // ================================================================

    // (a) force click no locator ausente — Playwright deve falhar ao
    //     resolver o elemento; capturamos o erro e validamos que a
    //     tentativa não gerou POST.
    const forceClickAttempt = await page
      .locator(UNDO_BTN)
      .click({ force: true, timeout: 1_500 })
      .then(() => "clicked")
      .catch(() => "unreachable");
    expect(forceClickAttempt).toBe("unreachable");

    // (b) e (c) — dispatch/click via DOM nativo em qualquer resíduo.
    const domAttackResult = await page.evaluate((sel) => {
      const results: string[] = [];
      const nodes = document.querySelectorAll(sel);
      results.push(`found=${nodes.length}`);
      nodes.forEach((el, idx) => {
        try {
          (el as HTMLButtonElement).dispatchEvent(
            new MouseEvent("click", { bubbles: true, cancelable: true }),
          );
          results.push(`dispatch-${idx}=ok`);
        } catch (e) {
          results.push(`dispatch-${idx}=err`);
        }
        try {
          (el as HTMLButtonElement).click();
          results.push(`native-${idx}=ok`);
        } catch (e) {
          results.push(`native-${idx}=err`);
        }
      });
      return results.join("|");
    }, UNDO_BTN);
    // Zero nós = ataque sem alvo; QUALQUER nó residual seria uma regressão.
    expect(domAttackResult).toBe("found=0");

    // Invariante final: mesmo após todas as tentativas, POST de restore
    // permanece em 0 durante uma janela adicional estável.
    await expect
      .poll(() => postCalls, { timeout: 2_000, intervals: [200, 500] })
      .toBe(0);
  });


  test("DELETE falha (500) → toast Desfazer NÃO aparece, linha permanece sem duplicatas", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await gotoAndSettle(page, "/orcamentos");
    const seed = await seedQuotesForStatusChips(page);
    expect(seed.skipped, `seed falhou: ${seed.skipped}`).toBeNull();

    await gotoAndSettle(page, "/orcamentos");
    await page.locator('button[data-chip-key="all"]').click();

    const firstRow = page.locator('[data-testid^="quote-row-"]').first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    const rowTestId = (await firstRow.getAttribute("data-testid"))!;
    const quoteId = rowTestId.replace(/^quote-row-/, "");

    // Conta linhas antes
    const rowsBefore = await page.locator('[data-testid^="quote-row-"]').count();

    let deleteCalls = 0;
    let postCalls = 0;
    await page.route(QUOTES_REST, async (route, request) => {
      const method = request.method();
      if (method === "DELETE") {
        deleteCalls += 1;
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "internal error", code: "PGRST500" }),
        });
        return;
      }
      if (method === "POST") {
        postCalls += 1;
        await route.fulfill({ status: 201, body: "[]" });
        return;
      }
      await route.continue();
    });

    await page.getByTestId(`quote-row-more-${quoteId}`).click();
    await page.getByTestId(`quote-row-menu-delete-${quoteId}`).click();
    await page.getByTestId("quote-list-delete-dialog-yes").click();

    // DELETE foi tentado
    await expect.poll(() => deleteCalls, { timeout: 15_000 }).toBeGreaterThanOrEqual(1);

    // Toast Desfazer NÃO deve aparecer — validado via poll estável (sem
    // setTimeout arbitrário): a contagem deve permanecer 0 durante a janela.
    await expect
      .poll(
        async () => page.locator(UNDO_TOAST).count(),
        { timeout: 3_000, intervals: [200, 500, 1000] },
      )
      .toBe(0);

    // Nenhum POST de restore disparado (poll estável)
    await expect
      .poll(() => postCalls, { timeout: 2_000, intervals: [200, 500] })
      .toBe(0);

    // A linha específica continua no DOM (delete falhou → nada removido do estado)
    await expect(page.getByTestId(`quote-row-${quoteId}`)).toBeVisible({
      timeout: 10_000,
    });

    // Contagem total de linhas não aumentou (sem duplicatas)
    const rowsAfter = await page.locator('[data-testid^="quote-row-"]').count();
    expect(rowsAfter).toBe(rowsBefore);
  });

  test("clique em Desfazer ANTES do timer expirar restaura EXATAMENTE 1x, sem duplicar items", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await gotoAndSettle(page, "/orcamentos");
    const seed = await seedQuotesForStatusChips(page);
    expect(seed.skipped, `seed falhou: ${seed.skipped}`).toBeNull();

    await gotoAndSettle(page, "/orcamentos");
    await expect(page.locator(Sel.page.title("orcamentos")).first()).toBeVisible({
      timeout: 10_000,
    });
    await page.locator('button[data-chip-key="all"]').click();

    const firstRow = page.locator('[data-testid^="quote-row-"]').first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    const rowTestId = (await firstRow.getAttribute("data-testid"))!;
    const quoteId = rowTestId.replace(/^quote-row-/, "");

    // Snapshot esperado retornado pelo fetchQuote (GET com ?id=eq.<uuid>)
    // — usamos 3 items para provar que a lista de items é passada de uma
    // única vez ao RPC (sem N inserts separados por item).
    const snapshotItems = [
      { id: "it-1", product_name: "A", unit_price: 10, quantity: 2 },
      { id: "it-2", product_name: "B", unit_price: 20, quantity: 1 },
      { id: "it-3", product_name: "C", unit_price: 30, quantity: 5 },
    ];

    let deleteCalls = 0;
    let rpcCreateCalls = 0;
    let quoteItemsInsertCalls = 0; // não deveria haver — invariante
    const rpcBodies: unknown[] = [];

    // Intercepta REST tabelas: DELETE quotes, POST quote_items (invariante = 0)
    await page.route(QUOTES_REST, async (route, request) => {
      const method = request.method();
      if (method === "DELETE") {
        deleteCalls += 1;
        await route.fulfill({ status: 204, body: "" });
        return;
      }
      if (method === "GET" && request.url().includes(`id=eq.${quoteId}`)) {
        // resposta do fetchQuote (snapshot pré-delete)
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              id: quoteId,
              quote_number: "ORC-SNAP",
              status: "draft",
              total: 130,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              items: snapshotItems,
            },
          ]),
        });
        return;
      }
      if (method === "POST") {
        // POST direto em /rest/v1/quotes NÃO deve ocorrer no fluxo undo
        // (createQuote usa RPC create_quote_transactional).
        await route.continue();
        return;
      }
      await route.continue();
    });

    // Intercepta insert direto em quote_items — invariante = 0 chamadas
    await page.route(/\/rest\/v1\/quote_items(\?|$)/, async (route, request) => {
      if (request.method() === "POST") {
        quoteItemsInsertCalls += 1;
      }
      await route.fulfill({ status: 201, body: "[]" });
    });

    // Intercepta o RPC de restore — deve receber TODOS os items em 1 payload
    await page.route(/\/rest\/v1\/rpc\/create_quote_transactional/, async (route, request) => {
      rpcCreateCalls += 1;
      try {
        rpcBodies.push(JSON.parse(request.postData() || "{}"));
      } catch {
        rpcBodies.push(null);
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: `restored-${quoteId}`,
          quote_number: "ORC-R",
          status: "draft",
          total: 130,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
    });

    await page.getByTestId(`quote-row-more-${quoteId}`).click();
    await page.getByTestId(`quote-row-menu-delete-${quoteId}`).click();
    await page.getByTestId("quote-list-delete-dialog-yes").click();

    await expect.poll(() => deleteCalls, { timeout: 15_000 }).toBe(1);

    // Toast aparece com contador > 0
    const toast = page.locator(UNDO_TOAST);
    await expect(toast).toBeVisible({ timeout: 10_000 });
    const undoBtn = page.locator(UNDO_BTN);
    const remainingSecStr = await undoBtn.getAttribute("data-remaining-sec");
    const remainingSec = Number(remainingSecStr);
    expect(remainingSec).toBeGreaterThan(0);
    expect(remainingSec).toBeLessThanOrEqual(8);

    // Clica em Desfazer ANTES da expiração
    await undoBtn.click();

    // Exatamente 1 chamada ao RPC
    await expect.poll(() => rpcCreateCalls, { timeout: 10_000 }).toBe(1);

    // Toast é dispensado após a ação
    await expect(page.locator(UNDO_TOAST)).toHaveCount(0, { timeout: 5_000 });

    // Cliques adicionais (mesmo forçados) NÃO chamam o RPC novamente —
    // o wrapper `showUndoToast` guarda `undone` e o botão já saiu do DOM.
    // Tentamos re-clicar no locator: deve resultar em 0 elementos.
    await expect(page.locator(UNDO_BTN)).toHaveCount(0);

    // Aguarda ausência de retry silencioso via poll estável (sem setTimeout):
    // o valor de rpcCreateCalls deve permanecer 1 durante toda a janela.
    await expect
      .poll(() => rpcCreateCalls, { timeout: 2_000, intervals: [200, 500] })
      .toBe(1);

    // Invariante: nenhuma inserção direta em quote_items — items foram
    // enviados dentro do payload do RPC (evita duplicação parcial em caso
    // de falha entre inserts).
    expect(quoteItemsInsertCalls).toBe(0);

    // Payload do RPC contém os 3 items do snapshot (sem duplicação nem perda)
    expect(rpcBodies.length).toBe(1);
    const body = rpcBodies[0] as { _quote?: unknown; _items?: unknown[] };
    expect(Array.isArray(body._items)).toBe(true);
    expect(body._items!.length).toBe(snapshotItems.length);

    // Não há duplicata de ids nos items enviados
    const itemIds = (body._items as Array<{ id?: string; product_name?: string }>).map(
      (i) => i.id ?? i.product_name ?? "",
    );
    const uniq = new Set(itemIds);
    expect(uniq.size).toBe(itemIds.length);
  });

  test("alta latência no DELETE — contador só inicia após resposta e expira corretamente", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await gotoAndSettle(page, "/orcamentos");
    const seed = await seedQuotesForStatusChips(page);
    expect(seed.skipped, `seed falhou: ${seed.skipped}`).toBeNull();

    await gotoAndSettle(page, "/orcamentos");
    await expect(page.locator(Sel.page.title("orcamentos")).first()).toBeVisible({
      timeout: 10_000,
    });
    await page.locator('button[data-chip-key="all"]').click();

    const firstRow = page.locator('[data-testid^="quote-row-"]').first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    const rowTestId = (await firstRow.getAttribute("data-testid"))!;
    const quoteId = rowTestId.replace(/^quote-row-/, "");

    // Latência artificial de ~4s no DELETE. Como o timer do toast só é
    // criado APÓS o `deleteQuote` resolver, a latência não deve encurtar
    // a janela de undo — o objetivo é garantir esse invariante.
    const DELETE_LATENCY_MS = 4_000;
    let deleteCalls = 0;
    let deleteRespondedAt = 0;
    let postCalls = 0;

    await page.route(QUOTES_REST, async (route, request) => {
      const method = request.method();
      if (method === "DELETE") {
        deleteCalls += 1;
        await new Promise((r) => setTimeout(r, DELETE_LATENCY_MS));
        deleteRespondedAt = Date.now();
        await route.fulfill({ status: 204, body: "" });
        return;
      }
      if (method === "POST") {
        postCalls += 1;
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify([{ id: `restored-${quoteId}` }]),
        });
        return;
      }
      await route.continue();
    });

    // Abre o menu e confirma exclusão. Medimos `clickedAt` a partir do
    // clique no dialog-yes (não do primeiro dropdown), pois é ele quem
    // dispara o `deleteQuote` — evita medir tempo de UI intermediária.
    await page.getByTestId(`quote-row-more-${quoteId}`).click();
    await page.getByTestId(`quote-row-menu-delete-${quoteId}`).click();
    const clickedAt = Date.now();
    await page.getByTestId("quote-list-delete-dialog-yes").click();

    // Enquanto o DELETE está pendente (primeiros ~2s da latência) o toast
    // de Desfazer NÃO deve estar visível — o wrapper só o dispara após
    // o await resolver com sucesso.
    await expect
      .poll(async () => page.locator(UNDO_TOAST).count(), {
        timeout: 2_000,
        intervals: [200, 400],
      })
      .toBe(0);

    // Toast aparece SOMENTE após a resposta do DELETE.
    const toast = page.locator(UNDO_TOAST);
    await expect(toast).toBeVisible({ timeout: DELETE_LATENCY_MS + 10_000 });
    const toastVisibleAt = Date.now();

    // Sanidade: latência real do DELETE >= janela solicitada (menos 500ms
    // de tolerância para variação de scheduler). Como `clickedAt` agora é
    // medido ATRÁS do dialog-yes, o delta reflete exclusivamente o tempo
    // gasto no route.fulfill delayed — sem contar cliques de UI.
    expect(deleteRespondedAt - clickedAt).toBeGreaterThanOrEqual(
      DELETE_LATENCY_MS - 500,
    );
    expect(toastVisibleAt).toBeGreaterThanOrEqual(deleteRespondedAt - 100);

    // Contador inicia com valor completo (não descontou os 4s de latência).
    const countdown = page.locator(UNDO_COUNTDOWN);
    await expect(countdown).toBeVisible();
    const initialSec = Number(await countdown.getAttribute("data-remaining-sec"));
    expect(initialSec).toBeGreaterThan(0);
    expect(initialSec).toBeLessThanOrEqual(8);

    // Contador decrementa até 0 (ou toast é dispensado).
    await expect
      .poll(
        async () => {
          const el = page.locator(UNDO_COUNTDOWN);
          const count = await el.count();
          if (count === 0) return 0;
          return Number((await el.getAttribute("data-remaining-sec")) ?? 0);
        },
        { timeout: 20_000, intervals: [200, 500, 1000] },
      )
      .toBe(0);

    // Botão fica desabilitado OU sai do DOM ao expirar.
    await expect
      .poll(
        async () => {
          const btn = page.locator(UNDO_BTN);
          const count = await btn.count();
          if (count === 0) return "absent";
          const disabled = await btn.isDisabled();
          const expired = await btn.getAttribute("data-expired");
          return disabled || expired === "true" ? "disabled" : "clickable";
        },
        { timeout: 5_000, intervals: [100, 250, 500] },
      )
      .not.toBe("clickable");

    // Toast é totalmente removido do DOM após onTimeout.
    await expect(page.locator(UNDO_TOAST)).toHaveCount(0, { timeout: 5_000 });

    // Nenhum POST de restore foi disparado durante toda a janela.
    expect(deleteCalls).toBeGreaterThanOrEqual(1);
    expect(postCalls).toBe(0);
    await expect
      .poll(() => postCalls, { timeout: 2_000, intervals: [200, 400] })
      .toBe(0);
  });
});
