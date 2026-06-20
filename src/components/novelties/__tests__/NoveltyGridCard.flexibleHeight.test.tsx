/**
 * NoveltyGridCard — altura fixa por breakpoint (paridade com BaseProductGridCard).
 * O card usa h-[400px]/max-h-[400px] (mobile) e sm:h-[430px]/sm:max-h-[430px] (≥sm)
 * para garantir uniformidade visual entre Novidades e Reposição em todos os viewports.
 *
 * Regressivo de paridade: evita remoção acidental das classes de altura fixa.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@/components/products/ProductQuickActionsFAB', () => ({
  ProductQuickActionsFAB: () => null,
}));
vi.mock('@/components/products/HoverSetImage', () => ({ HoverSetImage: () => null }));
vi.mock('@/components/products/ProductCategoryBadges', () => ({
  ProductCategoryBadges: () => null,
}));
vi.mock('@/components/products/ProductColorSwatches', () => ({
  ProductColorSwatches: () => null,
}));
vi.mock('@/components/products/NoveltyBadge', () => ({ NoveltyBadge: () => null }));
vi.mock('@/components/products/ProductStatusBadge', () => ({ ProductStatusBadge: () => null }));
vi.mock('@/components/products/QuickViewThumb', () => ({ QuickViewThumb: () => null }));
vi.mock('@/components/inventory/StockBadge', () => ({
  StockBadge: () => null,
  getStockStatus: () => 'in-stock' as const,
}));

import { NoveltyGridCard } from '../NoveltyCards';
import type { NoveltyWithDetails } from '@/hooks/products/useNovelties';

const longName =
  'Produto com um nome extremamente longo que ocupa várias linhas e historicamente quebrava o layout quando o card tinha altura fixa máxima definida em pixels';

const product: NoveltyWithDetails = {
  novelty_id: 'n-1',
  product_id: 'p-1',
  product_sku: 'SKU-LONG',
  product_name: longName,
  product_description: null,
  base_price: 99.9,
  product_image: null,
  product_set_image: null,
  category_id: null,
  category_name: null,
  supplier_code: null,
  supplier_id: null,
  supplier_name: 'Fornecedor Teste Longo',
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

function getArticle(container: HTMLElement): HTMLElement {
  const el = container.querySelector('article');
  if (!el) throw new Error('article não encontrado');
  return el as HTMLElement;
}

describe('NoveltyGridCard › altura fixa por breakpoint (paridade com BaseProductGridCard)', () => {
  it('aplica h-[400px] e max-h-[400px] no estado normal', () => {
    const { container } = render(<NoveltyGridCard product={product} />);
    const cls = getArticle(container).className;
    expect(cls).toMatch(/h-\[400px\]/);
    expect(cls).toMatch(/max-h-\[400px\]/);
    expect(cls).toMatch(/sm:h-\[430px\]/);
    expect(cls).toMatch(/sm:max-h-\[430px\]/);
  });

  it('mantém h-[400px] e max-h-[400px] também com skeleton de preço/estoque', () => {
    const { container } = render(<NoveltyGridCard product={product} isPriceStockLoading />);
    const cls = getArticle(container).className;
    expect(cls).toMatch(/h-\[400px\]/);
    expect(cls).toMatch(/max-h-\[400px\]/);
    expect(cls).toMatch(/sm:h-\[430px\]/);
    expect(cls).toMatch(/sm:max-h-\[430px\]/);
  });

  it('aplica overflow-hidden para conter conteúdo na altura fixa', () => {
    const { container } = render(<NoveltyGridCard product={product} />);
    const cls = getArticle(container).className;
    expect(cls).toMatch(/(^|\s)overflow-hidden/);
  });
});
