/**
 * CartHeaderActions — contrato do CTA "Gerar Orçamento".
 *
 * Cobre:
 *   1) CTA habilitado quando o carrinho tem itens → dispara onGenerateQuote com o cart.
 *   2) CTA desabilitado (aria-disabled + disabled + não dispara) quando o carrinho é inválido.
 *   3) O antigo botão "Gerenciar Carrinho" NÃO existe mais no header.
 *   4) O atalho "Ver Orçamentos" também foi removido.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CartHeaderActions } from '../CartHeaderActions';
import type { SellerCart } from '@/hooks/products';

type Props = React.ComponentProps<typeof CartHeaderActions>;

function makeCart(items: SellerCart['items']): SellerCart {
  return {
    id: 'c1',
    user_id: 'u1',
    company_id: 'comp1',
    company_name: 'Acme',
    status: 'em_separacao',
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    items,
  } as unknown as SellerCart;
}

function makeItem(): SellerCart['items'][number] {
  return {
    id: 'i1',
    cart_id: 'c1',
    product_id: 'p1',
    product_name: 'Caneta',
    product_sku: 'SKU-1',
    product_image_url: null,
    product_price: 10,
    quantity: 50,
    color_name: null,
    color_hex: null,
    notes: null,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  } as unknown as SellerCart['items'][number];
}

function renderHeader(overrides: Partial<Props> = {}) {
  const onDeleteTemplate = { mutate: vi.fn(), isPending: false } as unknown as Props['onDeleteTemplate'];
  const props: Props = {
    cart: makeCart([makeItem()]),
    templates: [],
    canCreateCart: true,
    onGenerateQuote: vi.fn(),
    onShareCart: vi.fn(),
    onDuplicateCart: vi.fn(),
    onExportCSV: vi.fn(),
    onExportPDF: vi.fn(),
    onSaveTemplate: vi.fn(),
    onLoadTemplate: vi.fn(),
    onDeleteTemplate,
    onClear: vi.fn(),
    onNavigate: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<CartHeaderActions {...props} />) };
}

describe('CartHeaderActions — CTA "Gerar Orçamento"', () => {
  it('está HABILITADO e dispara onGenerateQuote(cart) quando o carrinho tem itens', () => {
    const onGenerateQuote = vi.fn();
    const cart = makeCart([makeItem()]);
    renderHeader({ cart, onGenerateQuote });

    const cta = screen.getByTestId('cart-checkout-cta');
    expect(cta).toBeEnabled();
    expect(cta).toHaveAttribute('aria-disabled', 'false');

    fireEvent.click(cta);
    expect(onGenerateQuote).toHaveBeenCalledTimes(1);
    expect(onGenerateQuote).toHaveBeenCalledWith(expect.objectContaining({ id: cart.id }));
  });

  it('está DESABILITADO e NÃO dispara onGenerateQuote quando o carrinho está vazio', () => {
    const onGenerateQuote = vi.fn();
    renderHeader({ cart: makeCart([]), onGenerateQuote });

    const cta = screen.getByTestId('cart-checkout-cta');
    expect(cta).toBeDisabled();
    expect(cta).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(cta);
    expect(onGenerateQuote).not.toHaveBeenCalled();
  });
});

describe('CartHeaderActions — regressão "Ver Orçamentos"', () => {
  it('NÃO renderiza mais o botão "Ver Orçamentos" (removido em definitivo)', () => {
    renderHeader();
    expect(screen.queryByTestId('cart-view-quotes')).not.toBeInTheDocument();
    expect(screen.queryByText(/Ver Orçamentos/i)).not.toBeInTheDocument();
  });
});

describe('CartHeaderActions — regressão "Gerenciar Carrinho"', () => {
  it('NÃO renderiza mais o botão "Gerenciar Carrinho"', () => {
    renderHeader();
    expect(screen.queryByText(/Gerenciar Carrinho/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Gerenciar Carrinho/i })).not.toBeInTheDocument();
  });
});
