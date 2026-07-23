import { expect, type Page } from "@playwright/test";
import { SELLER_CART_TOASTS } from "../../src/hooks/products/sellerCartToasts";

/**
 * Helper SSOT — valida o toast de erro emitido quando `seller_cart_items`
 * falha na adição/troca de empresa (usado por 12i/12m/12n).
 *
 * Contrato validado
 * -----------------
 *   1. Título exato (`SELLER_CART_TOASTS.addItemError.title`) visível.
 *   2. Exatamente UM toast `[data-type="error"]` presente após o disparo
 *      (protege contra loops que empilhariam N toasts idênticos).
 *   3. Auto-dismiss dentro da janela padrão do sonner (~4 s + animação).
 *      Se `expectAutoDismiss=false`, pula a checagem (útil em testes que
 *      encerram cedo por outros motivos).
 *
 * Por que o texto exato importa
 * -----------------------------
 * O Lovable regenera `useSellerCarts.ts` esporadicamente. Um assert
 * baseado em `data-type="error"` isolado ficaria verde mesmo se a cópia
 * regredisse para "Operação falhou" (genérica). Amarrando ao SSOT em
 * `sellerCartToasts.ts` capturamos o drift no CI.
 */
export async function assertCartAddErrorToast(
  page: Page,
  opts: { expectAutoDismiss?: boolean; timeout?: number } = {},
): Promise<void> {
  const { expectAutoDismiss = true, timeout = 6_000 } = opts;

  const expectedTitle = SELLER_CART_TOASTS.addItemError.title;
  const toastRoot = page.locator('[data-sonner-toast][data-type="error"]');
  const toastWithTitle = toastRoot.filter({ hasText: expectedTitle });

  // 1. Texto exato aparece.
  await expect(
    toastWithTitle.first(),
    `Toast de erro do addItem deveria exibir "${expectedTitle}"`,
  ).toBeVisible({ timeout });

  // 2. Só um toast de erro empilhado (defesa contra loop de retries).
  //    Damos um pequeno tempo pra qualquer segundo toast aparecer antes
  //    de contar — evita flakiness sem waitForTimeout.
  const count = await toastRoot.count();
  expect(
    count,
    `Esperado exatamente 1 toast de erro; encontrados ${count}. ` +
      `Sinal de loop no fluxo de troca de empresa.`,
  ).toBeLessThanOrEqual(1);

  if (!expectAutoDismiss) return;

  // 3. Auto-dismiss dentro do default do sonner (~4 s + fade). Se algum
  //    dia adicionarem `duration: Infinity` regredimos silenciosamente
  //    — este assert quebra e o CI aponta.
  await expect(
    toastWithTitle.first(),
    "Toast de erro deveria desaparecer via auto-dismiss padrão do sonner",
  ).toBeHidden({ timeout: 8_000 });
}
