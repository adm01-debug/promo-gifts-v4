/**
 * CartSidebar — render smoke
 *
 * Garante que o componente monta SEM as dependências removidas
 * (`SmartSuggestions`, `ActionHistoryPanel`, `CartHealthChecklist`) e
 * renderiza apenas os cards remanescentes:
 *   - Hero Pricing (subtotal + métricas + CTA Gerar Orçamento)
 *   - CartActionsMenu (ações secundárias)
 *
 * Se algum import morto for reintroduzido por engano, o teste quebra
 * porque os símbolos não existem mais em `CartUtilComponents`.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LazyMotion, domAnimation } from 'framer-motion';
import { CartSidebar } from '../CartSidebar';
import type { SellerCart } from '@/hooks/products';
import * as CartUtilComponents from '@/components/cart/CartUtilComponents';

const baseCart: SellerCart = {
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
} as unknown as SellerCart;

function renderSidebar() {
  const onDeleteTemplate = {
    mutate: vi.fn(),
    isPending: false,
  } as unknown as React.ComponentProps<typeof CartSidebar>['onDeleteTemplate'];

  return render(
    <LazyMotion features={domAnimation}>
      <CartSidebar
        cart={baseCart}
        cartSubtotal={500}
        cartTotalQty={50}
        weightVolume={null}
        templates={[]}
        canCreateCart
        onGenerateQuote={vi.fn()}
        onShareCart={vi.fn()}
        onDuplicateCart={vi.fn()}
        onExportCSV={vi.fn()}
        onExportPDF={vi.fn()}
        onSaveTemplate={vi.fn()}
        onLoadTemplate={vi.fn()}
        onDeleteTemplate={onDeleteTemplate}
        onClear={vi.fn()}
        onNavigate={vi.fn()}
      />
    </LazyMotion>,
  );
}

describe('CartSidebar — render smoke pós-faxina', () => {
  it('monta sem dependências removidas e mostra hero pricing + CTA', () => {
    renderSidebar();

    expect(screen.getByText(/Subtotal do carrinho/i)).toBeInTheDocument();
    expect(screen.getByTestId('cart-checkout-cta')).toBeInTheDocument();
    expect(screen.getByText(/Gerar Orçamento/i)).toBeInTheDocument();
  });

  it('NÃO renderiza painéis legados (Saúde do carrinho / Inteligência de vendas / Histórico de ações / Sugestões inteligentes)', () => {
    const { container } = renderSidebar();

    // Textos visíveis dos painéis removidos
    expect(screen.queryByText(/Saúde do carrinho/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Inteligência de vendas/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Histórico de ações/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sugestões inteligentes/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Checklist/i)).not.toBeInTheDocument();

    // Aria-labels / botões dos painéis legados
    expect(screen.queryByRole('button', { name: /recolher/i })).not.toBeInTheDocument();

    // Garante que SOMENTE o card hero (ZONE 1) é renderizado no sidebar.
    // Os painéis removidos eram <Card> irmãos; se reintroduzidos, este count quebra.
    const cards = container.querySelectorAll('[data-slot="card"], .rounded-lg.border.bg-card, [class*="bg-gradient-to-br"]');
    // Hero card é o único <Card> visível no sidebar (dialogs ficam em portal).
    const heroCards = Array.from(cards).filter((el) =>
      el.textContent?.includes('Subtotal do carrinho'),
    );
    expect(heroCards).toHaveLength(1);
  });

  it('CartUtilComponents NÃO expõe mais SmartSuggestions/ActionHistoryPanel e helpers de histórico', () => {
    const exported = CartUtilComponents as Record<string, unknown>;
    expect(exported.SmartSuggestions).toBeUndefined();
    expect(exported.ActionHistoryPanel).toBeUndefined();
    expect(exported.SuggestionSkeleton).toBeUndefined();
    expect(exported.CartHealthChecklist).toBeUndefined();
    expect(exported.recordAction).toBeUndefined();
    expect(exported.getActionHistory).toBeUndefined();
    expect(exported.clearActionHistory).toBeUndefined();
  });

  it('renderiza apenas o card hero + menu de ações secundárias (sem outros cards de painel)', () => {
    renderSidebar();

    // Hero pricing
    expect(screen.getByText(/Subtotal do carrinho/i)).toBeInTheDocument();
    expect(screen.getByText(/SKUs/i)).toBeInTheDocument();
    expect(screen.getByText(/Qtd\. total/i)).toBeInTheDocument();

    // CTA principal
    expect(screen.getByTestId('cart-checkout-cta')).toBeInTheDocument();

    // Nenhum dos labels dos painéis removidos
    const forbiddenLabels = [
      /Próximo passo recomendado/i,
      /Conversão estimada/i,
      /Margem do carrinho/i,
      /Última ação/i,
    ];
    for (const re of forbiddenLabels) {
      expect(screen.queryByText(re)).not.toBeInTheDocument();
    }
  });
});
