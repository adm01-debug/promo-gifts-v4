/**
 * SSOT — Textos dos toasts emitidos pelo fluxo de "seller carts".
 *
 * Motivação
 * ---------
 * O toast de erro exibido quando o insert em `seller_cart_items` falha
 * (5xx, abort de rede ou 403/RLS durante a "troca de empresa" no
 * QuickAddToQuote) é um contrato observável tanto pela UI quanto pelos
 * testes E2E (`12i`, `12m`, `12n`). Centralizar o texto aqui:
 *
 *   - garante que qualquer refactor visual mantenha a mesma cópia PT-BR;
 *   - permite que testes unitários (mockando `sonner`) e specs Playwright
 *     (via `getByText`) referenciem a mesma string sem duplicação;
 *   - evita drift silencioso caso o Lovable regenere o hook.
 *
 * REGRA: não passar `duration:` no `toast.error` — assim o sonner mantém
 * o comportamento auto-dismiss padrão (~4 s) que os asserts de CI usam
 * para validar que a mensagem "some" e não empilha em loops.
 */

export const SELLER_CART_TOASTS = {
  /** Falha ao adicionar item ao carrinho (mutation `addItem` onError). */
  addItemError: {
    title: 'Não foi possível adicionar ao carrinho',
  },
  /** Sem carrinho de destino resolvível (usuário não escolheu empresa). */
  missingTarget: {
    title: 'Selecione uma empresa antes de adicionar produtos',
    description: 'Crie um carrinho vinculado a uma empresa primeiro.',
  },
} as const;

export type SellerCartToastKey = keyof typeof SELLER_CART_TOASTS;
