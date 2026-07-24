/**
 * Guard SSOT para transições de status do carrinho do vendedor.
 *
 * Regra de negócio: um carrinho SÓ pode transitar para `pronto_orcamento`
 * se tiver ao menos 1 item. Carrinho vazio não pode estar "pronto".
 *
 * Este módulo é a fonte única de verdade para essa regra — usado pela UI
 * (CartStatusSelect) e pelo hook (`useSellerCarts.updateCartStatus`) como
 * defesa em profundidade.
 *
 * Contrato:
 *  - `evaluateCartStatusTransition({ nextStatus, itemCount })` retorna um
 *    objeto discriminado `{ allowed: true }` ou `{ allowed: false, reason,
 *    message }`. Nunca lança.
 *  - `itemCount` é normalizado defensivamente (NaN/negativo/não-inteiro/
 *    Infinity → 0). Isso protege contra payloads corrompidos e evita que
 *    uma coerção implícita autorize a transição.
 *  - Qualquer `nextStatus` diferente de `pronto_orcamento` é sempre
 *    permitido — a regra de vazio se aplica exclusivamente à entrada em
 *    "Pronto p/ orçamento".
 */
import type { CartStatus } from '@/hooks/products';

export const EMPTY_CART_BLOCK_MESSAGE =
  'Adicione ao menos um produto antes de marcar como pronto para orçamento.';

export const EMPTY_CART_BLOCK_TITLE = 'Carrinho vazio';

export type TransitionDecision =
  { allowed: false; reason: 'empty_cart_ready_blocked'; message: string } | { allowed: true };

export interface EvaluateCartStatusTransitionInput {
  nextStatus: CartStatus;
  itemCount: number | null | undefined;
}

/** Normaliza `itemCount` para inteiro finito >= 0. Qualquer coisa esquisita vira 0. */
export function normalizeItemCount(raw: number | null | undefined): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw !== 'number') return 0;
  if (!Number.isFinite(raw)) return 0;
  if (Number.isNaN(raw)) return 0;
  if (raw < 0) return 0;
  // Trata 1.7 como 1 (nunca inflar para permitir transição).
  // `+ 0` normaliza `-0` para `+0` — evita surpresas com Object.is.
  return Math.floor(raw) + 0;
}

export function evaluateCartStatusTransition(
  input: EvaluateCartStatusTransitionInput,
): TransitionDecision {
  const { nextStatus } = input;
  const count = normalizeItemCount(input.itemCount);

  if (nextStatus === 'pronto_orcamento' && count < 1) {
    return {
      allowed: false,
      reason: 'empty_cart_ready_blocked',
      message: EMPTY_CART_BLOCK_MESSAGE,
    };
  }
  return { allowed: true };
}
