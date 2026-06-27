/**
 * Fluxo: Lista de orçamentos — refresh-request, infinite scroll e ausência de
 * duplicados ao alternar busca / filtros / ordenação.
 *
 * Estratégia resiliente ao volume real do BD (não cria dados):
 *   - Se a lista estiver vazia → valida apenas o estado vazio + refresh.
 *   - Se houver itens → valida unicidade dos `quote-row-more-*` em cada
 *     mudança de estado e, quando o sentinel aparecer, força o avanço do
 *     IntersectionObserver até "fim da lista" — sem repetir resultados.
 *
 * Política de seletores: TODOS via `Sel.quotesList.*` / `Sel.quote.*` /
 * `Sel.page.title(...)` — nada de role/text/aria/class (regra E2E SSOT).
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { pollUntil } from "../helpers/waits";
import { Sel } from "../fixtures/selectors";

/** Conta linhas únicas; falha imediatamente se houver `data-testid` duplicado. */
async function assertNoDuplicateRows(page: import("@playwright/test").Page) {
  const ids = await page.locator(Sel.quotesList.rowMorePrefix).evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-testid") ?? ""),
  );
  const unique = new Set(ids);
  expect(
    unique.size,
    `Linhas duplicadas detectadas. ids=${ids.join(",")}`,
  ).toBe(ids.length);
}

/**
 * Lê o rodapé. Estados possíveis:
 *   - vazio total: "Nenhum resultado"           → isEmpty
 *   - há mais:    "Exibindo N de M — role…"    → shown/total preenchidos
 *   - fim:        texto vazio (sem contagem)   → isEnd
 */
async function readFooter(page: import("@playwright/test").Page) {
  const text = ((await page.locator(Sel.quotesList.footerCount).textContent()) ?? "").trim();
  const match = text.match(/Exibindo\s+(\d+)\s+de\s+(\d+)/);
  const isEmpty = /Nenhum resultado/i.test(text);
  return {
    text,
    shown: match ? Number(match[1]) : 0,
    total: match ? Number(match[2]) : 0,
    isEnd: !isEmpty && !match, // sem "Exibindo …" e sem "Nenhum resultado" → fim
    isEmpty,
  };
}


test.describe("Lista de orçamentos — infinite scroll + refresh + dedup", () => {
  test.beforeEach(() => requireAuth());

  test("refresh-request, scroll até o fim e sem duplicados ao mudar filtros/busca/ordenação", async ({
    page,
  }) => {
    await gotoAndSettle(page, "/orcamentos");
    await expect(page.locator(Sel.page.title("orcamentos")).first()).toBeVisible({
      timeout: 15_000,
    });

    // Aguarda o componente da lista renderizar (footer SEMPRE aparece).
    await expect(page.locator(Sel.quotesList.footerCount)).toBeVisible({
      timeout: 15_000,
    });

    const initial = await readFooter(page);

    // ── Caminho 1: BD vazio → valida estado vazio + botão atualizar ──
    const emptyState = page.locator(Sel.quotesList.emptyState);
    if ((await emptyState.count()) > 0) {
      await expect(emptyState).toBeVisible();
      await expect(page.locator(Sel.quotesList.emptyRefresh)).toBeVisible();
      // Dispara refresh e confirma que nada quebra (toast aparece OU empty permanece).
      await page.locator(Sel.quotesList.emptyRefresh).click();
      await expect(page.locator(Sel.quotesList.footerCount)).toBeVisible();
      return;
    }

    // ── Caminho 2: há orçamentos ──
    const rowCount = await page.locator(Sel.quotesList.rowMorePrefix).count();
    expect(initial.total || rowCount).toBeGreaterThan(0);
    await assertNoDuplicateRows(page);

    // 2.1) refresh-request via window event → não deve duplicar nem quebrar a UI.
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("quotes:refresh-request"));
    });
    await expect(page.locator(Sel.quotesList.footerCount)).toBeVisible();
    await assertNoDuplicateRows(page);

    // 2.2) Infinite scroll: enquanto houver sentinel, força intersecção rolando-o
    // até o viewport do container scrollável. Cada iteração espera o footer
    // mudar (= IO disparou e re-renderizou) antes da próxima.
    const MAX_ITERATIONS = 50;
    let iter = 0;
    let lastShown = (await readFooter(page)).shown;
    while (iter < MAX_ITERATIONS) {
      const sentinel = page.locator(Sel.quotesList.infiniteSentinel);
      if ((await sentinel.count()) === 0) break;
      await sentinel.scrollIntoViewIfNeeded();
      await pollUntil(
        async () => {
          const f = await readFooter(page);
          // avançou OU sentinel sumiu (chegou ao fim → footer fica vazio)
          return f.shown > lastShown || f.isEnd
            ? { shown: f.shown }
            : null;
        },
        { timeout: 5_000, intervalMs: 100, message: "infinite scroll não avançou" },
      );
      lastShown = (await readFooter(page)).shown;
      iter += 1;
    }
    expect(iter).toBeLessThan(MAX_ITERATIONS);

    // Ao chegar no fim: sentinel some e rodapé não exibe mais "Exibindo …".
    await expect(page.locator(Sel.quotesList.infiniteSentinel)).toHaveCount(0);
    const afterScroll = await readFooter(page);
    expect(afterScroll.isEnd).toBe(true);
    await assertNoDuplicateRows(page);


    // 2.3) Mudança de ordenação → footer reseta para no máximo 25 (ou total se menor)
    await page.locator(Sel.quotesList.sortTrigger).click();
    await page.locator(Sel.quotesList.sortItem("oldest")).click();
    await expect(page.locator(Sel.quotesList.footerCount)).toBeVisible();
    const afterSort = await readFooter(page);
    expect(afterSort.shown).toBe(Math.min(25, afterSort.total));
    await assertNoDuplicateRows(page);

    // 2.4) Mudança de filtro de status (chip "Todos" garante existir).
    const chipAll = page.locator(Sel.quotesList.chip("all"));
    if ((await chipAll.count()) > 0) {
      await chipAll.click();
      await expect(page.locator(Sel.quotesList.footerCount)).toBeVisible();
      await assertNoDuplicateRows(page);
    }

    // 2.5) Mudança de busca → reseta a janela e não pode duplicar.
    // Busca sintética client-side; não cria recurso → e2eName() não se aplica.
    // eslint-disable-next-line no-restricted-syntax
    await page.locator(Sel.quotesList.searchInput).fill("zzz-no-match-xyz");
    await expect(page.locator(Sel.quotesList.footerCount)).toBeVisible();
    await assertNoDuplicateRows(page);

    // Limpa a busca → volta ao estado anterior, ainda sem duplicados e
    // resetado para a primeira página (≤25).
    await page.locator(Sel.quotesList.searchInput).fill("");
    await expect(page.locator(Sel.quotesList.footerCount)).toBeVisible();
    const afterClear = await readFooter(page);
    expect(afterClear.shown).toBe(Math.min(25, afterClear.total));
    await assertNoDuplicateRows(page);
  });
});
