/**
 * NoveltyGridCard — footer de preço/estoque.
 *
 * Cobre:
 *  - "A partir de" renderizado acima do preço quando há base_price válido
 *  - footer ancorado no final do card (classe `mt-auto` no container)
 *  - fallback "Sob consulta" quando preço é null/0/NaN/negativo
 *  - StockBadge sempre presente no mesmo footer
 */
import { describe, it, expect, vi } from 'vitest';
import { render, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { NoveltyGridCard } from '../NoveltyCards';
import type { NoveltyWithDetails } from '@/hooks/products/useNovelties';

vi.mock('@/components/products/ProductQuickActionsFAB', () => ({
  ProductQuickActionsFAB: () => null,
}));
vi.mock('@/components/products/ProductCategoryBadges', () => ({
  ProductCategoryBadges: () => null,
}));
vi.mock('@/components/products/HoverSetImage', () => ({
  HoverSetImage: () => null,
}));
vi.mock('@/components/products/ProductColorSwatches', () => ({
  ProductColorSwatches: () => null,
}));
vi.mock('@/components/products/NoveltyBadge', () => ({
  NoveltyBadge: () => null,
}));
vi.mock('@/components/products/ProductStatusBadge', () => ({
  ProductStatusBadge: () => null,
}));

function makeNovelty(overrides: Partial<NoveltyWithDetails> = {}): NoveltyWithDetails {
  return {
    novelty_id: 'nov-1',
    product_id: 'prod-1',
    product_sku: 'SKU-1',
    product_name: 'Caneta Promocional',
    product_description: null,
    base_price: 31.02,
    product_image: null,
    product_set_image: null,
    category_id: 'cat-1',
    category_name: 'Esportes',
    supplier_code: null,
    supplier_id: 'sup-1',
    supplier_name: 'Spot',
    supplier_product_code: null,
    detected_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    days_remaining: 27,
    days_as_novelty: 3,
    status: 'active',
    is_highlighted: false,
    is_active: true,
    stock_quantity: 20_700,
    min_quantity: 10,
    stock_status: 'in-stock',
    ...overrides,
  };
}

function renderCard(novelty: NoveltyWithDetails) {
  return render(
    <MemoryRouter>
      <TooltipProvider>
        <NoveltyGridCard product={novelty} />
      </TooltipProvider>
    </MemoryRouter>,
  );
}

describe('NoveltyGridCard › footer de preço/estoque', () => {
  it('renderiza "A partir de" acima do preço quando base_price é válido', () => {
    const { getByTestId } = renderCard(makeNovelty({ base_price: 31.02 }));
    const footer = getByTestId('novelty-card-footer');
    const prefix = within(footer).getByTestId('novelty-card-price-prefix');
    expect(prefix).toHaveTextContent(/A partir de/i);
    expect(within(footer).getByTestId('novelty-card-price')).toHaveTextContent(/R\$\s?31,02/);
  });

  it('ancora o footer no rodapé do card (mt-auto)', () => {
    const { getByTestId } = renderCard(makeNovelty());
    expect(getByTestId('novelty-card-footer').className).toContain('mt-auto');
  });

  it('mantém o StockBadge no mesmo footer', () => {
    const { getByTestId } = renderCard(makeNovelty({ stock_quantity: 20_700 }));
    const footer = getByTestId('novelty-card-footer');
    expect(within(footer).getByText(/un\./)).toBeInTheDocument();
  });

  describe('fallback para preço inválido', () => {
    it.each<[string, number | null]>([
      ['null', null],
      ['zero', 0],
      ['negativo', -5],
      ['NaN', Number.NaN],
    ])('exibe "Sob consulta" quando base_price = %s', (_label, value) => {
      const { getByTestId, queryByTestId } = renderCard(makeNovelty({ base_price: value }));
      expect(getByTestId('novelty-card-price-unavailable')).toHaveTextContent(/Sob consulta/i);
      expect(queryByTestId('novelty-card-price')).toBeNull();
      expect(queryByTestId('novelty-card-price-prefix')).toBeNull();
    });
  });
});
