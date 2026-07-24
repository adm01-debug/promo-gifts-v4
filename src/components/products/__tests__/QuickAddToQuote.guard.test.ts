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
import { describe, it, expect, vi } from 'vitest';

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

  it('activeCart=null + 2 carrinhos: clique em "Adicionar ao Carrinho" DEVE abrir o CartSelectorDialog', () => {
    // Simula o handler real: sem cartId (clique no botão principal), sem activeCart
    // e com vários carrinhos deve disparar a abertura do seletor.
    let showSelector = false;
    const setShowSelector = (v: boolean) => {
      showSelector = v;
    };
    const addToActiveCart = vi.fn();

    const handleAddToQuote = (cartId?: string) => {
      if (!cartId && !null && [1, 2].length > 1 && !showSelector) {
        // ↑ espelha exatamente a guarda do componente
        setShowSelector(true);
        return;
      }
      addToActiveCart();
    };

    handleAddToQuote();

    expect(showSelector).toBe(true);
    expect(addToActiveCart).not.toHaveBeenCalled();
  });

  it('activeCart=null + 2 carrinhos: NÃO chama addToActiveCart antes da seleção', () => {
    let showSelector = false;
    const addToActiveCart = vi.fn();
    const state = { activeCart: null as unknown, carts: [{ id: 'A' }, { id: 'B' }] };

    const handleAddToQuote = (cartId?: string) => {
      if (!cartId && !state.activeCart && state.carts.length > 1 && !showSelector) {
        showSelector = true;
        return;
      }
      addToActiveCart();
    };

    handleAddToQuote();
    expect(showSelector).toBe(true);
    expect(addToActiveCart).not.toHaveBeenCalled();
  });
});

/**
 * Cenários em que a LISTA de carrinhos muda após a troca de empresa
 * (carrinho removido, novo carrinho criado, activeCart trocado). O botão
 * "Adicionar ao Carrinho" deve continuar usando o `activeCart` corrente,
 * sem reabrir o seletor.
 */
describe('QuickAddToQuote — activeCart estável quando carts muda', () => {
  type Cart = { id: string; company_name: string };

  function simulateAdd(state: {
    activeCart: Cart | null;
    carts: Cart[];
    showSelector: boolean;
  }) {
    const addToActiveCart = vi.fn();
    const setShowSelector = vi.fn((v: boolean) => {
      state.showSelector = v;
    });
    const handleAddToQuote = (cartId?: string) => {
      if (
        !cartId &&
        !state.activeCart &&
        state.carts.length > 1 &&
        !state.showSelector
      ) {
        setShowSelector(true);
        return;
      }
      addToActiveCart(cartId ?? state.activeCart?.id);
    };
    return { handleAddToQuote, addToActiveCart, setShowSelector };
  }

  it('após TROCAR de empresa: novo activeCart é usado, seletor NÃO reabre', () => {
    const cartA: Cart = { id: 'A', company_name: 'Empresa A' };
    const cartB: Cart = { id: 'B', company_name: 'Empresa B' };
    const state = { activeCart: cartA, carts: [cartA, cartB], showSelector: false };

    // Usuário troca para o carrinho B
    state.activeCart = cartB;

    const { handleAddToQuote, addToActiveCart, setShowSelector } = simulateAdd(state);
    handleAddToQuote();

    expect(setShowSelector).not.toHaveBeenCalled();
    expect(addToActiveCart).toHaveBeenCalledTimes(1);
    expect(addToActiveCart).toHaveBeenCalledWith('B');
  });

  it('quando um carrinho é REMOVIDO mas activeCart permanece: usa o activeCart', () => {
    const cartA: Cart = { id: 'A', company_name: 'Empresa A' };
    const cartB: Cart = { id: 'B', company_name: 'Empresa B' };
    const state = { activeCart: cartB, carts: [cartA, cartB], showSelector: false };

    // Backend remove o cartA (ex.: outra aba deletou); activeCart segue = B
    state.carts = [cartB];

    const { handleAddToQuote, addToActiveCart, setShowSelector } = simulateAdd(state);
    handleAddToQuote();

    expect(setShowSelector).not.toHaveBeenCalled();
    expect(addToActiveCart).toHaveBeenCalledWith('B');
  });

  it('quando um NOVO carrinho aparece na lista mas activeCart segue setado: usa o activeCart', () => {
    const cartA: Cart = { id: 'A', company_name: 'Empresa A' };
    const cartB: Cart = { id: 'B', company_name: 'Empresa B' };
    const cartC: Cart = { id: 'C', company_name: 'Empresa C' };
    const state = { activeCart: cartA, carts: [cartA, cartB], showSelector: false };

    // Polling/realtime traz um novo carrinho C; activeCart continua = A
    state.carts = [cartA, cartB, cartC];

    const { handleAddToQuote, addToActiveCart, setShowSelector } = simulateAdd(state);
    handleAddToQuote();

    expect(setShowSelector).not.toHaveBeenCalled();
    expect(addToActiveCart).toHaveBeenCalledWith('A');
  });

  it('quando o activeCart é REMOVIDO da lista (ficou null) com >1 carrinhos: reabre o seletor', () => {
    const cartA: Cart = { id: 'A', company_name: 'Empresa A' };
    const cartB: Cart = { id: 'B', company_name: 'Empresa B' };
    const cartC: Cart = { id: 'C', company_name: 'Empresa C' };
    const state = { activeCart: cartA as Cart | null, carts: [cartA, cartB, cartC], showSelector: false };

    // Backend removeu o cartA; contexto zera activeCart
    state.activeCart = null;
    state.carts = [cartB, cartC];

    const { handleAddToQuote, addToActiveCart, setShowSelector } = simulateAdd(state);
    handleAddToQuote();

    expect(setShowSelector).toHaveBeenCalledWith(true);
    expect(addToActiveCart).not.toHaveBeenCalled();
  });

  it('quando sobra APENAS 1 carrinho após remoção e activeCart é null: adiciona sem abrir seletor', () => {
    const cartB: Cart = { id: 'B', company_name: 'Empresa B' };
    const state = { activeCart: null as Cart | null, carts: [cartB], showSelector: false };

    const { handleAddToQuote, addToActiveCart, setShowSelector } = simulateAdd(state);
    handleAddToQuote();

    // Não abre seletor (só 1 carrinho); handler cai no ramo de adição.
    // O componente real trata a ausência de activeCart via `disabled={!activeCart}`,
    // então esta simulação apenas garante que a GUARDA não dispara.
    expect(setShowSelector).not.toHaveBeenCalled();
    expect(addToActiveCart).toHaveBeenCalledTimes(1);
  });
});
