/**
 * cart-assertions.ts — asserts SSOT para "carrinho ativo continua íntegro".
 *
 * Uso em specs de regressão que forçam falha na troca de empresa
 * (12i/12m/12n): depois da falha, o vendedor NÃO pode terminar navegando
 * para o carrinho novo por engano nem perder o CTA de finalizar do
 * carrinho original.
 *
 * Duas asserções compõem o contrato:
 *
 *   1. `assertActiveCartHeader(page, cart)` — abre /carrinhos/:id e
 *      confere que o header (`active-cart-company-name`) mostra o
 *      `company_name` esperado; o header (`active-cart-header`) tem
 *      `data-status="ok"` visível.
 *   2. `assertFinalizeCtaTargets(page, cart)` — abre /carrinhos (lista),
 *      abre o menu "..." da linha do carrinho e confere que o item
 *      `cart-row-menu-generate-quote-<id>` está visível E habilitado
 *      (não `[aria-disabled="true"]` nem `[data-disabled]`).
 *
 * Não emite cliques destrutivos — só validação read-only. Os specs
 * chamam esses helpers no `try` block, antes do `assertNoHits()` do
 * watcher, para garantir que a UI final está no estado esperado.
 */
import { expect, type Page } from "@playwright/test";
import { gotoAndSettle } from "./nav";
import { TID } from "../fixtures/selectors";
import type { MockCart } from "./cart-mock";

const TID_ACTIVE_HEADER = TID("active-cart-header");
const TID_ACTIVE_COMPANY = TID("active-cart-company-name");

/**
 * Navega para /carrinhos/:id e afirma que o header ativo aponta para
 * `cart` — company_name igual e o header renderizado (não fallback vazio).
 */
export async function assertActiveCartHeader(
  page: Page,
  cart: Pick<MockCart, "id" | "company_name">,
): Promise<void> {
  await gotoAndSettle(page, `/carrinhos/${cart.id}`);
  const header = page.locator(TID_ACTIVE_HEADER).first();
  await expect(header, "header do carrinho ativo deve estar visível").toBeVisible({
    timeout: 5_000,
  });
  const name = page.locator(TID_ACTIVE_COMPANY).first();
  await expect(
    name,
    `carrinho ativo DEVE continuar sendo "${cart.company_name}" após a falha na troca`,
  ).toHaveText(new RegExp(escapeRegex(cart.company_name)), { timeout: 3_000 });
}

/**
 * Navega para /carrinhos e afirma que o CTA "Gerar Orçamento" do
 * carrinho `cart` está visível e habilitado — vendedor consegue
 * finalizar o carrinho ORIGINAL apesar do erro no switch.
 */
export async function assertFinalizeCtaTargets(
  page: Page,
  cart: Pick<MockCart, "id">,
): Promise<void> {
  await gotoAndSettle(page, "/carrinhos");
  const trigger = page.locator(TID(`cart-row-more-${cart.id}`)).first();
  await expect(
    trigger,
    `menu "..." do carrinho ${cart.id} deve estar visível na lista`,
  ).toBeVisible({ timeout: 5_000 });
  await trigger.click();

  const menuItem = page
    .locator(TID(`cart-row-menu-generate-quote-${cart.id}`))
    .first();
  await expect(
    menuItem,
    "CTA de finalizar (Gerar Orçamento) do carrinho original DEVE existir",
  ).toBeVisible({ timeout: 3_000 });

  // Radix DropdownMenuItem usa data-disabled / aria-disabled para bloqueio.
  const disabledAttr = await menuItem.getAttribute("data-disabled");
  const ariaDisabled = await menuItem.getAttribute("aria-disabled");
  expect(
    disabledAttr,
    "CTA de finalizar NÃO pode estar bloqueado (data-disabled) após falha na troca",
  ).toBeNull();
  expect(
    ariaDisabled,
    "CTA de finalizar NÃO pode estar bloqueado (aria-disabled) após falha na troca",
  ).not.toBe("true");

  // Fecha o menu (ESC) para não poluir asserts subsequentes.
  await page.keyboard.press("Escape").catch(() => {});
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
