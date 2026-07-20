/**
 * CartSidebar — isolamento durante troca/loading entre carrinhos.
 *
 * A sidebar é remontada em `SellerCartsPage` via `key={activeCart.id}`, o que
 * garante que trocar de carrinho descarta qualquer estado interno anterior.
 *
 * Estes testes simulam a troca rápida (rerender consecutivo) e o momento
 * "loading" onde o consumidor ainda não terminou de recomputar
 * `weightVolume`/`cartSubtotal`, e garantem que:
 *
 *  - Nenhum dado do carrinho ANTERIOR persiste ao remontar por `key`.
 *  - Peso/Volume só aparecem quando explicitamente presentes no prop atual.
 *  - Durante o loading (weightVolume nulo) a sidebar fica oculta.
 *
 * Nota: o CTA "Gerar Orçamento" foi movido para CartHeaderActions.
 * O isolamento do CTA é coberto em CartHeaderActions.render.test.tsx.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LazyMotion, domAnimation } from 'framer-motion';
import { CartSidebar } from '../CartSidebar';
import type { SellerCart } from '@/hooks/products';

function makeCart(id: string, name: string): SellerCart {
  return {
    id,
    user_id: 'u1',
    company_id: `comp-${id}`,
    company_name: name,
    status: 'em_separacao',
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    items: [
      {
        id: `${id}-i1`,
        cart_id: id,
        product_id: 'p1',
        product_name: 'Produto',
        product_sku: 'SKU-1',
        product_image_url: null,
        product_price: 10,
        quantity: 5,
        color_name: null,
        color_hex: null,
        notes: null,
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ],
  } as unknown as SellerCart;
}

type Props = React.ComponentProps<typeof CartSidebar>;

function props(cart: SellerCart, overrides: Partial<Props> = {}): Props {
  return {
    cart,
    cartSubtotal: 100,
    cartTotalQty: 5,
    weightVolume: null,
    templates: [],
    canCreateCart: true,
    onGenerateQuote: vi.fn(),
    onShareCart: vi.fn(),
    onDuplicateCart: vi.fn(),
    onExportCSV: vi.fn(),
    onExportPDF: vi.fn(),
    onSaveTemplate: vi.fn(),
    onLoadTemplate: vi.fn(),
    onDeleteTemplate: {
      mutate: vi.fn(),
      isPending: false,
    } as unknown as Props['onDeleteTemplate'],
    onClear: vi.fn(),
    onNavigate: vi.fn(),
    ...overrides,
  };
}

function renderWithKey(cart: SellerCart, extra: Partial<Props> = {}) {
  return render(
    <LazyMotion features={domAnimation}>
      {/* Reproduz `key={cart.id}` usado em SellerCartsPage */}
      <CartSidebar key={cart.id} {...props(cart, extra)} />
    </LazyMotion>,
  );
}

describe('CartSidebar — trocas rápidas e loading não vazam dados', () => {
  it('remonta por key ao trocar de carrinho — peso do anterior desaparece imediatamente', () => {
    const cartA = makeCart('A', 'Empresa A');
    const cartB = makeCart('B', 'Empresa B');

    const { rerender } = renderWithKey(cartA, {
      weightVolume: { weightKg: 2.5, volumeM3: 0.01, volumeCm3: 10000 },
    });
    expect(screen.getByText(/2\.5kg/)).toBeInTheDocument();

    // Troca para carrinho B ainda "carregando" — sem weightVolume computado.
    rerender(
      <LazyMotion features={domAnimation}>
        <CartSidebar key={cartB.id} {...props(cartB, { weightVolume: null })} />
      </LazyMotion>,
    );

    // Peso do carrinho A NÃO pode ter persistido durante o loading do B.
    expect(screen.queryByText(/2\.5kg/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Peso/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Volume/i)).not.toBeInTheDocument();

    // Quando o weightVolume do B finalmente chega, exibe SÓ o do B.
    rerender(
      <LazyMotion features={domAnimation}>
        <CartSidebar
          key={cartB.id}
          {...props(cartB, { weightVolume: { weightKg: 7.7, volumeM3: 0.05, volumeCm3: 50000 } })}
        />
      </LazyMotion>,
    );
    expect(screen.getByText(/7\.7kg/)).toBeInTheDocument();
    expect(screen.queryByText(/2\.5kg/)).not.toBeInTheDocument();
  });

  it('três trocas encadeadas convergem para o último carrinho (sem eco intermediário)', () => {
    const a = makeCart('A', 'A');
    const b = makeCart('B', 'B');
    const c = makeCart('C', 'C');

    const { rerender } = renderWithKey(a, {
      weightVolume: { weightKg: 1, volumeM3: 0.001, volumeCm3: 1000 },
    });
    rerender(
      <LazyMotion features={domAnimation}>
        <CartSidebar
          key={b.id}
          {...props(b, { weightVolume: { weightKg: 2, volumeM3: 0.002, volumeCm3: 2000 } })}
        />
      </LazyMotion>,
    );
    rerender(
      <LazyMotion features={domAnimation}>
        <CartSidebar
          key={c.id}
          {...props(c, { weightVolume: { weightKg: 3, volumeM3: 0.003, volumeCm3: 3000 } })}
        />
      </LazyMotion>,
    );

    // Só o peso do C está no DOM.
    expect(screen.getByText(/3\.0kg/)).toBeInTheDocument();
    expect(screen.queryByText(/1\.0kg/)).not.toBeInTheDocument();
    expect(screen.queryByText(/2\.0kg/)).not.toBeInTheDocument();
  });

  it('fica oculta (retorna null) durante o loading — sem peso/volume do carrinho anterior', () => {
    const a = makeCart('A', 'A');
    const b = makeCart('B', 'B');

    const { rerender } = renderWithKey(a, {
      weightVolume: { weightKg: 5, volumeM3: 0.05, volumeCm3: 50000 },
    });
    expect(screen.getByText(/5\.0kg/)).toBeInTheDocument();

    // Troca para B: weightVolume ainda null (loading) → sidebar deve ficar oculta.
    rerender(
      <LazyMotion features={domAnimation}>
        <CartSidebar key={b.id} {...props(b, { weightVolume: null })} />
      </LazyMotion>,
    );

    // Nenhum rastro do carrinho A nem da sidebar visível durante o loading.
    expect(screen.queryByTestId('cart-sidebar-hero')).not.toBeInTheDocument();
    expect(screen.queryByText(/5\.0kg/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Peso/i)).not.toBeInTheDocument();
  });
});
