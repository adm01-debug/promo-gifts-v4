/**
 * CartSidebar — render smoke + isolamento do carrinho ativo
 *
 * Após a repaginação, o subtotal/SKUs/Qtd. total saíram da sidebar
 * e passaram a viver no header da página. A sidebar mantém
 * EXCLUSIVAMENTE o card hero de peso/volume.
 * O CTA "Gerar Orçamento" foi movido para CartHeaderActions (ver
 * CartHeaderActions.render.test.tsx para o contrato do CTA).
 *
 * Estes testes garantem:
 *   1) Render mínimo (hero card com peso/volume quando presentes)
 *   2) NÃO reintroduziu painéis legados nem os labels Subtotal/SKUs/Qtd
 *   3) Peso/Volume aparecem quando `weightVolume` os traz
 *   4) A sidebar consome APENAS o `weightVolume` recebido — nunca agrega
 *      dados de outros carrinhos.
 *   5) O botão "Gerenciar Carrinho" foi removido em definitivo.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LazyMotion, domAnimation } from 'framer-motion';
import { CartSidebar } from '../CartSidebar';
import type { SellerCart } from '@/hooks/products';
import * as CartUtilComponents from '@/components/cart/CartUtilComponents';

function makeCart(overrides: Partial<SellerCart> = {}): SellerCart {
  return {
    id: 'c1',
    user_id: 'u1',
    company_id: 'comp1',
    company_name: 'Acme Brindes',
    status: 'em_separacao',
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    items: [
      {
        id: 'i1',
        cart_id: 'c1',
        product_id: 'p1',
        product_name: 'Caneta personalizada',
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
      },
    ],
    ...overrides,
  } as unknown as SellerCart;
}

type SidebarProps = React.ComponentProps<typeof CartSidebar>;

function renderSidebar(props: Partial<SidebarProps> = {}) {
  const onDeleteTemplate = {
    mutate: vi.fn(),
    isPending: false,
  } as unknown as SidebarProps['onDeleteTemplate'];

  const merged: SidebarProps = {
    cart: makeCart(),
    cartSubtotal: 500,
    cartTotalQty: 50,
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
    onDeleteTemplate,
    onClear: vi.fn(),
    onNavigate: vi.fn(),
    ...props,
  };

  return render(
    <LazyMotion features={domAnimation}>
      <CartSidebar {...merged} />
    </LazyMotion>,
  );
}

describe('CartSidebar — render smoke pós-repaginação', () => {
  it('monta card hero com data-loaded=true quando há peso/volume (CTA vive no CartHeaderActions)', () => {
    renderSidebar({ weightVolume: { weightKg: 2.5, volumeM3: 0.012, volumeCm3: 12000 } });
    const hero = screen.getByTestId('cart-sidebar-hero');
    expect(hero).toBeInTheDocument();
    expect(hero).toHaveAttribute('data-loaded', 'true');
    // CTA foi movido para CartHeaderActions — não deve aparecer na sidebar.
    expect(screen.queryByTestId('cart-checkout-cta')).not.toBeInTheDocument();
  });

  it('NÃO renderiza mais Subtotal/SKUs/Qtd. total (vivem no header agora)', () => {
    renderSidebar({ cartSubtotal: 999_999, cartTotalQty: 12345 });
    expect(screen.queryByText(/Subtotal do carrinho/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^SKUs$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Qtd\. total/i)).not.toBeInTheDocument();
    // Valores numéricos duplicados também não podem vazar na sidebar.
    expect(screen.queryByText(/999\.999/)).not.toBeInTheDocument();
    expect(screen.queryByText(/12\.345/)).not.toBeInTheDocument();
  });

  it('NÃO renderiza painéis legados', () => {
    renderSidebar();
    expect(screen.queryByText(/Saúde do carrinho/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Inteligência de vendas/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Histórico de ações/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sugestões inteligentes/i)).not.toBeInTheDocument();
  });

  it('NÃO renderiza mais o botão "Gerenciar Carrinho" (removido em definitivo)', () => {
    renderSidebar();
    expect(screen.queryByText(/Gerenciar Carrinho/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Gerenciar Carrinho/i })).not.toBeInTheDocument();
  });

  it('NÃO renderiza mais o atalho "Ver Orçamentos" (removido em definitivo)', () => {
    renderSidebar();
    expect(screen.queryByTestId('cart-view-quotes')).not.toBeInTheDocument();
    expect(screen.queryByText(/Ver Orçamentos/i)).not.toBeInTheDocument();
  });

  it('CartUtilComponents NÃO expõe mais SmartSuggestions/ActionHistoryPanel', () => {
    const exported = CartUtilComponents as Record<string, unknown>;
    expect(exported.SmartSuggestions).toBeUndefined();
    expect(exported.ActionHistoryPanel).toBeUndefined();
    expect(exported.SuggestionSkeleton).toBeUndefined();
    expect(exported.CartHealthChecklist).toBeUndefined();
    expect(exported.recordAction).toBeUndefined();
    expect(exported.getActionHistory).toBeUndefined();
    expect(exported.clearActionHistory).toBeUndefined();
  });

  it('renderiza Peso/Volume quando weightVolume os traz', () => {
    renderSidebar({
      weightVolume: { weightKg: 2.5, volumeM3: 0.012, volumeCm3: 12000 },
    });
    expect(screen.getByText(/Peso/i)).toBeInTheDocument();
    expect(screen.getByText(/2\.5kg/)).toBeInTheDocument();
    expect(screen.getByText(/Volume/i)).toBeInTheDocument();
    expect(screen.getByText(/0\.012m³/)).toBeInTheDocument();
  });

  it('OMITE bloco de peso/volume quando ambos são zero/nulos', () => {
    renderSidebar({ weightVolume: { weightKg: 0, volumeM3: 0, volumeCm3: 0 } });
    expect(screen.queryByText(/Peso/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Volume/i)).not.toBeInTheDocument();
  });
});

describe('CartSidebar — isolamento do carrinho ativo (sem agregação)', () => {
  it('usa APENAS o `weightVolume` recebido — troca de carrinho refletida no peso exibido', () => {
    const cartA = makeCart({ id: 'A', company_name: 'Empresa A' });
    const cartB = makeCart({ id: 'B', company_name: 'Empresa B' });

    const onGenerateQuote = vi.fn();
    const { rerender } = render(
      <LazyMotion features={domAnimation}>
        <CartSidebar
          cart={cartA}
          cartSubtotal={100}
          cartTotalQty={10}
          weightVolume={{ weightKg: 1, volumeM3: 0.001, volumeCm3: 1000 }}
          templates={[]}
          canCreateCart
          onGenerateQuote={onGenerateQuote}
          onShareCart={vi.fn()}
          onDuplicateCart={vi.fn()}
          onExportCSV={vi.fn()}
          onExportPDF={vi.fn()}
          onSaveTemplate={vi.fn()}
          onLoadTemplate={vi.fn()}
          onDeleteTemplate={
            { mutate: vi.fn(), isPending: false } as unknown as SidebarProps['onDeleteTemplate']
          }
          onClear={vi.fn()}
          onNavigate={vi.fn()}
        />
      </LazyMotion>,
    );

    // Peso do cartA (1kg exato).
    expect(screen.getByText(/1\.0kg/)).toBeInTheDocument();

    // Rerender com cartB e peso distinto.
    rerender(
      <LazyMotion features={domAnimation}>
        <CartSidebar
          cart={cartB}
          cartSubtotal={7777}
          cartTotalQty={77}
          weightVolume={{ weightKg: 3.7, volumeM3: 0.02, volumeCm3: 20000 }}
          templates={[]}
          canCreateCart
          onGenerateQuote={onGenerateQuote}
          onShareCart={vi.fn()}
          onDuplicateCart={vi.fn()}
          onExportCSV={vi.fn()}
          onExportPDF={vi.fn()}
          onSaveTemplate={vi.fn()}
          onLoadTemplate={vi.fn()}
          onDeleteTemplate={
            { mutate: vi.fn(), isPending: false } as unknown as SidebarProps['onDeleteTemplate']
          }
          onClear={vi.fn()}
          onNavigate={vi.fn()}
        />
      </LazyMotion>,
    );

    // Peso trocou para o do cartB e o do cartA sumiu.
    expect(screen.getByText(/3\.7kg/)).toBeInTheDocument();
    expect(screen.queryByText(/1\.0kg/)).not.toBeInTheDocument();
    // O CTA foi movido para CartHeaderActions; isolamento do CTA
    // é coberto em CartHeaderActions.render.test.tsx.
  });
});
