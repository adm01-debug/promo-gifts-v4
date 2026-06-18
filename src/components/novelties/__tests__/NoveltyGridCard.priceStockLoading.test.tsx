/**
 * Verifica que o card de Novidades (Grade) renderiza skeletons no lugar
 * do preço e do estoque quando `isPriceStockLoading=true`, e volta a
 * mostrar os valores reais quando `false`.
 *
 * Sub-componentes pesados (FAB, swatches, imagens, badges) são mockados
 * para isolar o teste à área do rodapé preço/estoque.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@/components/products/ProductQuickActionsFAB', () => ({
  ProductQuickActionsFAB: () => null,
}));
vi.mock('@/components/products/HoverSetImage', () => ({
  HoverSetImage: () => null,
}));
vi.mock('@/components/products/ProductCategoryBadges', () => ({
  ProductCategoryBadges: () => null,
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
vi.mock('@/components/inventory/StockBadge', () => ({
  StockBadge: ({ quantity }: { quantity: number }) => (
    <div data-testid="mock-stock-badge">{quantity}</div>
  ),
  getStockStatus: () => 'in-stock' as const,
}));

import { NoveltyGridCard } from '../NoveltyCards';
import type { NoveltyWithDetails } from '@/hooks/products/useNovelties';

const baseProduct: NoveltyWithDetails = {
  novelty_id: 'n-1',
  product_id: 'p-1',
  product_sku: 'SKU-1',
  product_name: 'Produto Teste',
  product_description: null,
  base_price: 99.9,
  product_image: null,
  product_set_image: null,
  category_id: null,
  category_name: null,
  supplier_code: null,
  supplier_id: null,
  supplier_name: null,
  supplier_product_code: null,
  detected_at: new Date().toISOString(),
  expires_at: new Date().toISOString(),
  days_remaining: 20,
  days_as_novelty: 10,
  status: 'active',
  is_highlighted: false,
  is_active: true,
  stock_quantity: 100,
  min_quantity: 10,
  stock_status: 'in-stock',
};

describe('NoveltyGridCard › isPriceStockLoading', () => {
  it('renderiza skeletons de preço e estoque quando isPriceStockLoading=true', () => {
    const { queryByTestId } = render(<NoveltyGridCard product={baseProduct} isPriceStockLoading />);
    expect(queryByTestId('novelty-card-price-skeleton')).not.toBeNull();
    expect(queryByTestId('novelty-card-stock-skeleton')).not.toBeNull();
    // Conteúdo real não deve aparecer
    expect(queryByTestId('novelty-card-price')).toBeNull();
    expect(queryByTestId('mock-stock-badge')).toBeNull();
  });

  it('skeletons têm atributos de acessibilidade (aria-busy/aria-label)', () => {
    const { getByTestId } = render(<NoveltyGridCard product={baseProduct} isPriceStockLoading />);
    const priceSk = getByTestId('novelty-card-price-skeleton');
    expect(priceSk.getAttribute('aria-busy')).toBe('true');
    expect(priceSk.getAttribute('aria-label')).toBe('Carregando preço');
    expect(getByTestId('novelty-card-stock-skeleton').getAttribute('aria-label')).toBe(
      'Carregando estoque',
    );
  });

  it('renderiza preço real + StockBadge quando isPriceStockLoading=false (default)', () => {
    const { queryByTestId, getByText } = render(<NoveltyGridCard product={baseProduct} />);
    expect(queryByTestId('novelty-card-price-skeleton')).toBeNull();
    expect(queryByTestId('novelty-card-stock-skeleton')).toBeNull();
    expect(queryByTestId('novelty-card-price')).not.toBeNull();
    expect(queryByTestId('novelty-card-price-prefix')?.textContent).toBe('A partir de');
    expect(getByText(/R\$\s*99,90/)).toBeInTheDocument();
    expect(queryByTestId('mock-stock-badge')?.textContent).toBe('100');
  });

  it('rodapé permanece presente e ancorado mesmo no estado de loading', () => {
    const { getByTestId } = render(<NoveltyGridCard product={baseProduct} isPriceStockLoading />);
    const footer = getByTestId('novelty-card-footer');
    expect(footer.className).toContain('mt-auto');
    expect(footer.className).toContain('min-h-[2.75rem]');
  });
});
