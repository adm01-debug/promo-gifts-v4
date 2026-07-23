/**
 * cart-setup.ts — Helper SSOT que garante uma sessão autenticada com
 * carrinhos semeados via mock antes de exercitar fluxos de troca/finalização.
 *
 * Motivação: os specs 12g/12h duplicavam o mesmo boilerplate:
 *   requireAuth() → makeMockCart×N → mockSellerCartsAPI → gotoAndSettle.
 * Sem um SSOT, cada spec podia semear em ordem diferente (mock ANTES ou
 * DEPOIS da navegação), causando flakiness — a query `seller_carts` é
 * disparada no boot do `SellerCartContext`, então o `page.route` DEVE
 * estar registrado antes do `page.goto`.
 *
 * Regras invioláveis:
 *  1. `loginAs(page, role)` PRIMEIRO — hidrata storageState global.
 *  2. `mockSellerCartsAPI` SEGUNDO — registra rota.
 *  3. `gotoAndSettle` POR ÚLTIMO — dispara a query já interceptada.
 *
 * Uso:
 *   const { carts, cartA, cartB } = await setupAuthedWithCarts(page, {
 *     count: 2,
 *     itemsPerCart: 1,
 *     gotoUrl: "/produtos",
 *   });
 */
import type { Page } from "@playwright/test";

import { loginAs, type Role } from "./auth";
import { makeMockCart, mockSellerCartsAPI, type MockCart } from "./cart-mock";
import { gotoAndSettle } from "./nav";

export interface SetupAuthedWithCartsOptions {
  /** Papel para o login (default: "user"). */
  role?: Role;
  /** Quantidade de carrinhos a semear (default: 2). */
  count?: number;
  /** Itens por carrinho (default: 1). */
  itemsPerCart?: number;
  /** Rota inicial após semear (default: "/produtos"). Passe `null` para não navegar. */
  gotoUrl?: string | null;
  /**
   * Sobrescreve/estende os carrinhos gerados (ex.: renomear empresas para
   * cenários específicos). Recebe o carrinho gerado e devolve o final.
   */
  transform?: (cart: MockCart, idx: number) => MockCart;
  /**
   * Se `true`, aguarda a primeira resposta de `GET /rest/v1/seller_carts*`
   * antes de retornar. Elimina o race em que um `expect` executa contra o
   * DOM ANTES do React Query hidratar o cache do `SellerCartContext`.
   *
   * Só faz sentido em conjunto com `gotoUrl != null`. Timeout: 10s (Playwright
   * default para waitForResponse). Silenciosamente ignorado se `gotoUrl` for
   * `null` — não há navegação que dispare a query.
   *
   * Default: `false` (backward compatible).
   */
  waitForHydration?: boolean;
}

export interface SetupAuthedWithCartsResult {
  /** Todos os carrinhos semeados, na ordem gerada. */
  carts: MockCart[];
  /** Atalho para o primeiro carrinho (sempre existe se `count >= 1`). */
  cartA: MockCart;
  /** Atalho para o segundo carrinho (undefined se `count < 2`). */
  cartB: MockCart | undefined;
}

/**
 * Garante sessão autenticada + N carrinhos mockados prontos antes do fluxo.
 *
 * ORDEM CRÍTICA (não altere sem ler o header deste arquivo):
 *   loginAs → mockSellerCartsAPI → gotoAndSettle [→ waitForResponse]
 */
export async function setupAuthedWithCarts(
  page: Page,
  opts: SetupAuthedWithCartsOptions = {},
): Promise<SetupAuthedWithCartsResult> {
  const {
    role = "user",
    count = 2,
    itemsPerCart = 1,
    gotoUrl = "/produtos",
    transform,
    waitForHydration = false,
  } = opts;

  if (count < 1) {
    throw new Error("setupAuthedWithCarts: `count` deve ser >= 1");
  }

  // 1. Sessão — reaproveita storageState quando possível.
  await loginAs(page, role);

  // 2. Gera os carrinhos e aplica transform opcional ANTES do mock.
  const carts: MockCart[] = Array.from({ length: count }, (_, i) => {
    const base = makeMockCart(i, itemsPerCart);
    return transform ? transform(base, i) : base;
  });

  // 3. Registra o mock ANTES da navegação — a query é disparada no boot.
  await mockSellerCartsAPI(page, carts);

  // 4. Navega (opcional) — dispara a query já interceptada.
  if (gotoUrl !== null) {
    if (waitForHydration) {
      // Arma o waiter ANTES do goto: a resposta pode chegar imediatamente
      // após o boot do SellerCartContext e queremos capturá-la sem race.
      const hydration = page.waitForResponse(
        (res) =>
          res.url().includes("/rest/v1/seller_carts") &&
          res.request().method() === "GET",
        { timeout: 10_000 },
      );
      await gotoAndSettle(page, gotoUrl);
      await hydration;
    } else {
      await gotoAndSettle(page, gotoUrl);
    }
  }

  return {
    carts,
    cartA: carts[0]!,
    cartB: carts[1],
  };
}
