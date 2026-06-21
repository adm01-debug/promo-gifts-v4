/**
 * NoveltyGridCard — badge de urgência "Últimos dias".
 * Aparece quando status === 'expiring_soon' e o produto não é fresh.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
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
vi.mock('@/components/products/HoverSetImage', () => ({ HoverSetImage: () => null }));
vi.mock('@/components/products/ProductColorSwatches', () => ({ ProductColorSwatches: () => null }));
vi.mock('@/components/products/NoveltyBadge', () => ({ NoveltyBadge: () => null }));
vi.mock('@/components/products/ProductStatusBadge', () => ({ ProductStatusBadge: () => null }));
vi.mock('@/components/products/QuickViewThumb', () => ({ QuickViewThumb: () => null }));

function makeNovelty(overrides: Partial<NoveltyWithDetails> = {}): NoveltyWithDetails {
  return {
    novelty_id: 'nov-1',
    product_id: 'prod-1',
    product_sku: 'SKU-1',
    product_name: 'Produto',
    product_description: null,
    base_price: 10,
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
    days_remaining: 30,
    days_as_novelty: 10,
    status: 'active',
    is_highlighted: false,
    is_active: true,
    stock_quantity: 100,
    min_quantity: 10,
    stock_status: 'in-stock',
    ...overrides,
  };
}

const renderCard = (n: NoveltyWithDetails) =>
  render(
    <MemoryRouter>
      <TooltipProvider>
        <NoveltyGridCard product={n} />
      </TooltipProvider>
    </MemoryRouter>,
  );

describe('NoveltyGridCard › badge "Últimos dias" (urgência)', () => {
  it('mostra "Últimos Nd" quando expiring_soon e não fresh', () => {
    const staleDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { getByTestId } = renderCard(
      makeNovelty({
        status: 'expiring_soon',
        days_remaining: 5,
        is_highlighted: false,
        detected_at: staleDate,
      }),
    );
    expect(getByTestId('novelty-expiring-badge').textContent).toContain('Últimos 5d');
  });

  it('mostra "Último dia" quando resta ≤ 1 dia', () => {
    const staleDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { getByTestId } = renderCard(
      makeNovelty({
        status: 'expiring_soon',
        days_remaining: 1,
        is_highlighted: false,
        detected_at: staleDate,
      }),
    );
    expect(getByTestId('novelty-expiring-badge').textContent).toContain('Último dia');
  });

  it('NÃO mostra o badge quando status active', () => {
    const { queryByTestId } = renderCard(makeNovelty({ status: 'active' }));
    expect(queryByTestId('novelty-expiring-badge')).toBeNull();
  });

  it('NÃO mostra o badge quando fresh (recém-chegado tem prioridade)', () => {
    const { queryByTestId } = renderCard(
      makeNovelty({ status: 'expiring_soon', is_highlighted: true }),
    );
    expect(queryByTestId('novelty-expiring-badge')).toBeNull();
  });

  it('NÃO mostra o badge em selectionMode', () => {
    const { queryByTestId } = render(
      <MemoryRouter>
        <TooltipProvider>
          <NoveltyGridCard
            product={makeNovelty({ status: 'expiring_soon', is_highlighted: false })}
            selectionMode
          />
        </TooltipProvider>
      </MemoryRouter>,
    );
    expect(queryByTestId('novelty-expiring-badge')).toBeNull();
  });
});
