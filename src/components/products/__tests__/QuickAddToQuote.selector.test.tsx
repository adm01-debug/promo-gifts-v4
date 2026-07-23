/**
 * Teste de unidade em nível de componente — garante que, quando `activeCart`
 * é `null` e o vendedor possui múltiplos carrinhos, o clique em
 * "Adicionar ao Carrinho" abre o CartSelectorDialog (e NÃO chama
 * addToActiveCart em loop).
 *
 * Complementa QuickAddToQuote.guard.test.ts (que cobre a lógica pura) com um
 * teste de renderização real usando @testing-library/react.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ---- Mocks das dependências pesadas (imagens, pickers, contexto) ----
const addToActiveCart = vi.fn();
const mockCtx: {
  activeCart: unknown;
  carts: Array<{ id: string; company_name: string }>;
  addToActiveCart: typeof addToActiveCart;
  canCreateCart: boolean;
} = {
  activeCart: null,
  carts: [
    { id: 'cart-A', company_name: 'Empresa A' },
    { id: 'cart-B', company_name: 'Empresa B' },
  ],
  addToActiveCart,
  canCreateCart: true,
};

vi.mock('@/contexts/SellerCartContext', () => ({
  useSellerCartContext: () => mockCtx,
}));

vi.mock('@/components/cart/CartSelectorDialog', () => ({
  CartSelectorDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="cart-selector-dialog">selector-aberto</div> : null,
}));

vi.mock('@/components/cart/CartCompanyPicker', () => ({
  CartCompanyPicker: () => <div data-testid="cart-company-picker" />,
}));

vi.mock('@/components/products/SingleVariantPicker', () => ({
  SingleVariantPicker: ({
    onSelect,
  }: {
    onSelect: (v: { id: string; sku: string } | null) => void;
  }) => (
    <button
      type="button"
      data-testid="variant-picker"
      onClick={() => onSelect({ id: 'v1', sku: 'SKU-1' })}
    >
      pick-variant
    </button>
  ),
}));

vi.mock('@/components/ui/OptimizedImage', () => ({
  OptimizedImage: () => <div data-testid="img" />,
}));

vi.mock('@/utils/image-utils', () => ({ getCdnUrl: (u: string) => u }));
vi.mock('@/utils/imageProxy', () => ({ getProxiedImageUrl: (u: string) => u }));

import { QuickAddToQuote } from '../QuickAddToQuote';

describe('QuickAddToQuote — abre CartSelectorDialog sem activeCart', () => {
  beforeEach(() => {
    addToActiveCart.mockReset();
    mockCtx.activeCart = null;
    mockCtx.carts = [
      { id: 'cart-A', company_name: 'Empresa A' },
      { id: 'cart-B', company_name: 'Empresa B' },
    ];
  });

  it('abre o seletor ao clicar em "Adicionar ao Carrinho" com múltiplos carrinhos e nenhum ativo', () => {
    render(
      <QuickAddToQuote
        productId="p1"
        productName="Caneta Promocional"
        productSku="SKU-1"
      />,
    );

    // Abre popover (trigger visível: "Orçar")
    fireEvent.click(screen.getByRole('button', { name: /orçar/i }));

    // Seleciona variante (SingleVariantPicker mockado)
    fireEvent.click(screen.getByTestId('variant-picker'));

    // Botão de confirmação dentro do popover
    const confirm = screen
      .getAllByRole('button')
      .find((b) => /adicionar ao carrinho/i.test(b.textContent ?? ''));
    expect(confirm, 'botão "Adicionar ao Carrinho" deve existir').toBeTruthy();
    fireEvent.click(confirm!);

    // Deve abrir o seletor e NÃO chamar addToActiveCart
    expect(screen.getByTestId('cart-selector-dialog')).toBeTruthy();
    expect(addToActiveCart).not.toHaveBeenCalled();
  });
});
