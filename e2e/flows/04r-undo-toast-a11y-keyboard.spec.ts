/**
 * E2E — Acessibilidade + teclado do toast "Desfazer".
 *
 * Cobre invariantes que NÃO dependem de seed de orçamentos, disparando o
 * toast via `window.__showUndoToast` (helper global exposto em DEV — ver
 * `src/utils/undoToast.tsx`):
 *
 *   A. `aria-label` no botão começa com "Desfazer ação" e cita segundos
 *      restantes/totais — garante nome acessível para leitores de tela.
 *   B. `Tab` a partir de `document.body` chega ao botão (`:focus`),
 *      comprovando que é focável (não `tabindex=-1`, não `aria-hidden`).
 *   C. `Enter` no botão focado dispara o `onUndo` exatamente 1 vez.
 *   D. `Espaço` no botão focado dispara o `onUndo` exatamente 1 vez.
 *   E. Clique em "Desfazer" APÓS a expiração do contador (`data-expired="true"`)
 *      NÃO chama `onUndo` (guarda dupla: HTMLButtonElement `disabled` +
 *      guard `undone` no wrapper).
 *   F. Após clique, o toast é dispensado e não sobra `[data-sonner-toast]`
 *      contendo texto de "Desfazer".
 */
import { test, expect } from "../fixtures/test-base";
import { installMockAuth, isMockAuthEnabled } from "../helpers/mock-auth";
import { gotoAndSettle } from "../helpers/nav";

test.use({ trace: "retain-on-failure", screenshot: "only-on-failure" });

const UNDO_TOAST = '[data-testid="undo-toast"]';
const UNDO_BTN = '[data-testid="undo-toast-button"]';

/**
 * Instala um contador global `window.__undoCallCount` e dispara o toast
 * via `window.__showUndoToast`. Retorna imediatamente após o toast estar
 * no DOM. Usa duração longa (8s) exceto no cenário de expiração (500ms).
 */
async function showUndoToastInBrowser(
  page: import("@playwright/test").Page,
  duration = 8000,
): Promise<void> {
  await page.evaluate((d) => {
    const w = window as unknown as {
      __showUndoToast?: (o: {
        title: string;
        description?: string;
        onUndo: () => void;
        duration: number;
      }) => unknown;
      __undoCallCount?: number;
    };
    w.__undoCallCount = 0;
    if (!w.__showUndoToast) {
      throw new Error(
        "window.__showUndoToast não disponível — DEV build necessária.",
      );
    }
    w.__showUndoToast({
      title: "Orçamento excluído",
      description: "Você pode desfazer esta ação.",
      duration: d,
      onUndo: () => {
        w.__undoCallCount = (w.__undoCallCount ?? 0) + 1;
      },
    });
  }, duration);
}

async function getUndoCount(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const w = window as unknown as { __undoCallCount?: number };
    return w.__undoCallCount ?? 0;
  });
}

test.describe("Toast Desfazer — acessibilidade + teclado", () => {
  test.beforeEach(async ({ page }) => {
    if (isMockAuthEnabled()) await installMockAuth(page);
    // Qualquer rota autenticada serve; a home carrega os providers e o
    // `<Toaster />`. Não precisamos de dados de orçamento.
    await gotoAndSettle(page, "/orcamentos");
  });

  test("A. aria-label começa com 'Desfazer ação' e cita segundos restantes/totais", async ({
    page,
  }) => {
    await showUndoToastInBrowser(page, 8000);
    await expect(page.locator(UNDO_TOAST)).toBeVisible({ timeout: 5_000 });

    const label = await page.locator(UNDO_BTN).getAttribute("aria-label");
    expect(label).not.toBeNull();
    expect(label!).toMatch(/^Desfazer ação/);
    // Deve mencionar segundos totais (8) e um remanescente numérico.
    expect(label!).toMatch(/\d+ segundos? restantes? de \d+/);
  });

  test("B. botão é focável via Tab a partir do body", async ({ page }) => {
    await showUndoToastInBrowser(page, 8000);
    await expect(page.locator(UNDO_TOAST)).toBeVisible({ timeout: 5_000 });

    // Foco inicial no body e Tab até o botão. O toast entra no fim da
    // ordem de tab (aria-live region), então varremos até 25 Tabs.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
    await page.locator("body").click({ position: { x: 5, y: 5 } });

    let focused = false;
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      const isFocused = await page.locator(UNDO_BTN).evaluate(
        (el) => el === document.activeElement,
      );
      if (isFocused) {
        focused = true;
        break;
      }
    }
    expect(focused, "botão Desfazer não recebeu foco via Tab").toBe(true);
  });

  test("C. Enter no botão focado dispara onUndo exatamente 1x", async ({ page }) => {
    await showUndoToastInBrowser(page, 8000);
    await expect(page.locator(UNDO_TOAST)).toBeVisible({ timeout: 5_000 });

    await page.locator(UNDO_BTN).focus();
    await expect(page.locator(UNDO_BTN)).toBeFocused();

    await page.keyboard.press("Enter");
    await expect.poll(() => getUndoCount(page), { timeout: 3_000 }).toBe(1);

    // Toast desaparece após o clique
    await expect(page.locator(UNDO_TOAST)).toHaveCount(0, { timeout: 3_000 });

    // Reassert: não há toast Sonner residual com texto "Desfazer"
    const withDesfazer = await page
      .locator('[data-sonner-toast]:has-text("Desfazer")')
      .count();
    expect(withDesfazer).toBe(0);
  });

  test("D. Espaço no botão focado dispara onUndo exatamente 1x", async ({ page }) => {
    await showUndoToastInBrowser(page, 8000);
    await expect(page.locator(UNDO_TOAST)).toBeVisible({ timeout: 5_000 });

    await page.locator(UNDO_BTN).focus();
    await page.keyboard.press("Space");
    await expect.poll(() => getUndoCount(page), { timeout: 3_000 }).toBe(1);
    await expect(page.locator(UNDO_TOAST)).toHaveCount(0, { timeout: 3_000 });
  });

  test("E. clique após expiração (500ms) NÃO chama onUndo e não gera toasts duplicados", async ({
    page,
  }) => {
    // Duration curta para expirar rápido — o wrapper dispara dismiss no
    // onTimeout. Como estamos testando o botão em si (guarda `undone` +
    // disabled), tentamos click FORÇADO enquanto ainda houver resíduo.
    await showUndoToastInBrowser(page, 500);

    // Aguarda expiração (state remainingMs <= 0). O toast é dismissed logo
    // em seguida — pode não haver janela para clique normal. Tentamos
    // vias diretas via DOM caso o toast já tenha sumido.
    await page.waitForTimeout(1500);

    // Tentativa 1: click normal se o botão existir
    const btnCount = await page.locator(UNDO_BTN).count();
    if (btnCount > 0) {
      await page
        .locator(UNDO_BTN)
        .click({ force: true, timeout: 1_000 })
        .catch(() => {
          /* disabled → click rejeitado, esperado */
        });
    }

    // Tentativa 2: dispatch DOM em qualquer resíduo
    await page.evaluate((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        try {
          (el as HTMLButtonElement).click();
        } catch {
          /* ok */
        }
      });
    }, UNDO_BTN);

    // onUndo NUNCA foi chamado
    const count = await getUndoCount(page);
    expect(count).toBe(0);

    // Nenhum toast "Ação desfeita!" pode ter aparecido (fluxo de sucesso
    // do wrapper). Reassert estável por 500ms.
    await expect
      .poll(async () => {
        return page
          .locator('[data-sonner-toast]:has-text("Ação desfeita")')
          .count();
      }, { timeout: 2_000, intervals: [200, 500] })
      .toBe(0);
  });

  test("F. cliques rápidos consecutivos em Desfazer disparam onUndo exatamente 1x", async ({
    page,
  }) => {
    // Bug clássico: sem guarda `undone`, spam-click no botão dispara N
    // restores. Aqui simulamos 15 cliques rápidos e confirmamos que o
    // handler roda apenas 1 vez e o toast é dispensado.
    await showUndoToastInBrowser(page, 8000);
    await expect(page.locator(UNDO_TOAST)).toBeVisible({ timeout: 5_000 });

    const btn = page.locator(UNDO_BTN);
    // Rajada de cliques (force:true para ignorar transições de estado).
    for (let i = 0; i < 15; i++) {
      await btn.click({ force: true, timeout: 800 }).catch(() => {
        /* após dispensado o botão some — clique falha, esperado */
      });
    }

    // onUndo chamado UMA única vez, apesar dos 15 cliques.
    await expect.poll(() => getUndoCount(page), { timeout: 3_000 }).toBe(1);

    // Toast é dispensado — nenhuma cópia residual.
    await expect(page.locator(UNDO_TOAST)).toHaveCount(0, { timeout: 3_000 });
    const desfazerToasts = await page
      .locator('[data-sonner-toast]:has-text("Desfazer")')
      .count();
    expect(desfazerToasts).toBe(0);

    // Reassert estável: sem retry silencioso após 1s.
    await page.waitForTimeout(1000);
    expect(await getUndoCount(page)).toBe(1);
  });

  test("G. duplo Enter no botão focado dispara onUndo exatamente 1x (guarda undone)", async ({
    page,
  }) => {
    await showUndoToastInBrowser(page, 8000);
    await expect(page.locator(UNDO_TOAST)).toBeVisible({ timeout: 5_000 });

    await page.locator(UNDO_BTN).focus();
    // Duas teclas Enter em sequência rápida
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter").catch(() => {
      /* botão já removido do DOM após a 1ª — ok */
    });
    await expect.poll(() => getUndoCount(page), { timeout: 3_000 }).toBe(1);
  });
});
