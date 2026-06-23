import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { CartTabsRich } from '../CartTabsRich';
import { MAX_SELLER_CARTS } from '@/hooks/products/useSellerCarts';
import type { SellerCart } from '@/hooks/products';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  const stub = {
    div: (p: React.HTMLAttributes<HTMLDivElement>) => <div {...p} />,
    span: (p: React.HTMLAttributes<HTMLSpanElement>) => <span {...p} />,
  };
  return {
    ...actual,
    motion: stub,
    m: stub,
    LazyMotion: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

function makeCart(i: number): SellerCart {
  return {
    id: `c-${i}`,
    seller_id: 'u1',
    company_id: `co-${i}`,
    company_name: `Empresa ${i}`,
    company_location: null,
    company_logo_url: null,
    notes: null,
    status: 'novo',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: [],
  } as unknown as SellerCart;
}

describe('CartTabsRich · contador X/10 e estado do CTA', () => {
  afterEach(cleanup);

  it('mostra contador "3/10" e CTA habilitado abaixo do limite', () => {
    const carts = Array.from({ length: 3 }, (_, i) => makeCart(i));
    render(
      <CartTabsRich
        carts={carts}
        activeCartId={carts[0].id}
        canCreateCart
        onSelect={vi.fn()}
        onNew={vi.fn()}
      />,
    );
    const counter = screen.getByTestId('cart-tab-new-counter');
    expect(counter.textContent).toBe(`3/${MAX_SELLER_CARTS}`);
    const btn = screen.getByTestId('cart-tab-new') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.getAttribute('aria-label')).toBe('Criar novo carrinho');
    expect(btn.getAttribute('title')).toMatch(/3\/10/);
    // Sem link de detalhes quando não atingiu o limite.
    expect(screen.queryByTestId('cart-limit-details-link')).toBeNull();
  });

  it('mostra contador "10/10", CTA desabilitado e link "Ver detalhes" no limite', () => {
    const carts = Array.from({ length: MAX_SELLER_CARTS }, (_, i) => makeCart(i));
    render(
      <CartTabsRich
        carts={carts}
        activeCartId={carts[0].id}
        canCreateCart={false}
        onSelect={vi.fn()}
        onNew={vi.fn()}
      />,
    );
    const counter = screen.getByTestId('cart-tab-new-counter');
    expect(counter.textContent).toBe(`${MAX_SELLER_CARTS}/${MAX_SELLER_CARTS}`);
    const btn = screen.getByTestId('cart-tab-new') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('title')).toMatch(/Exclua um carrinho para criar outro/);

    const link = screen.getByTestId('cart-limit-details-link');
    fireEvent.click(link);
    const modal = screen.getByTestId('cart-limit-details-modal');
    expect(modal.textContent).toMatch(/Limite de 10 carrinhos/);
    expect(modal.textContent).toMatch(/10 de 10/);
  });

  it('contador permanece "15/10" quando ultrapassa o limite', () => {
    const carts = Array.from({ length: 15 }, (_, i) => makeCart(i));
    render(
      <CartTabsRich
        carts={carts}
        activeCartId={carts[0].id}
        canCreateCart={false}
        onSelect={vi.fn()}
        onNew={vi.fn()}
      />,
    );
    expect(screen.getByTestId('cart-tab-new-counter').textContent).toBe(`15/${MAX_SELLER_CARTS}`);
    expect((screen.getByTestId('cart-tab-new') as HTMLButtonElement).disabled).toBe(true);
  });
});
