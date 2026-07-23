/**
 * Regressão do "loop do CartSelectorDialog" no QuickAddToQuote.
 *
 * Antes: o botão "Adicionar ao Carrinho" reabria o seletor sempre que houvesse
 * 2+ carrinhos, mesmo com um activeCart já definido — travando o vendedor num
 * loop após clicar em "Trocar" e escolher outra empresa.
 *
 * Agora: o seletor só abre quando NÃO há carrinho ativo. Este teste blinda a
 * decisão como lógica pura para evitar regressão futura.
 *
 * Guarda espelhada em src/components/products/QuickAddToQuote.tsx (handleAddToQuote):
 *   if (!cartId && !activeCart && carts.length > 1 && !showSelector) { showSelector() }
 */
import { describe, it, expect } from 'vitest';

function shouldOpenSelector(args: {
  cartId?: string;
  activeCart: unknown;
  cartCount: number;
  showSelector: boolean;
}): boolean {
  const { cartId, activeCart, cartCount, showSelector } = args;
  return !cartId && !activeCart && cartCount > 1 && !showSelector;
}

describe('QuickAddToQuote — guarda do CartSelectorDialog', () => {
  it('NÃO reabre o seletor quando já existe activeCart (fix do loop)', () => {
    expect(
      shouldOpenSelector({
        cartId: undefined,
        activeCart: { id: 'cart-B' },
        cartCount: 2,
        showSelector: false,
      }),
    ).toBe(false);
  });

  it('abre o seletor quando há vários carrinhos e nenhum ativo', () => {
    expect(
      shouldOpenSelector({
        cartId: undefined,
        activeCart: null,
        cartCount: 2,
        showSelector: false,
      }),
    ).toBe(true);
  });

  it('NÃO abre se o cartId foi passado explicitamente (fluxo "Trocar")', () => {
    expect(
      shouldOpenSelector({
        cartId: 'cart-B',
        activeCart: null,
        cartCount: 2,
        showSelector: false,
      }),
    ).toBe(false);
  });

  it('NÃO abre com apenas 1 carrinho', () => {
    expect(
      shouldOpenSelector({
        cartId: undefined,
        activeCart: null,
        cartCount: 1,
        showSelector: false,
      }),
    ).toBe(false);
  });

  it('NÃO reabre quando o seletor já está visível (evita re-entrada)', () => {
    expect(
      shouldOpenSelector({
        cartId: undefined,
        activeCart: null,
        cartCount: 3,
        showSelector: true,
      }),
    ).toBe(false);
  });
});
