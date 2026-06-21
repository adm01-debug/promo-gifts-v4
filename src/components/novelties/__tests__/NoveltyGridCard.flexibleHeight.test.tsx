/**
 * Garante que o card de Novidades usa min-h-[420px] (altura mínima com piso),
 * permitindo que o virtualizer (measureElement) meça a altura real do card.
 * Alturas fixas + overflow-hidden corrompem a medição/scroll de /novidades.
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

const product: NoveltyWithDetails = {
  novelty_id: 'n-1',
  product_id: 'p-1',
  product_sku: 'SKU-LONG',
  product_name: 'Produto com nome longo',
  product_description: null,
  base_price: 99.9,
  product_image: null,
  product_set_image: null,
  category_id: null,
  category_name: null,
  supplier_code: null,
  supplier_id: null,
  supplier_name: 'Fornecedor Teste',
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

describe('NoveltyGridCard › altura mínima com piso (virtualizer-friendly)', () => {
  it('aplica min-h-[420px] no estado normal', () => {
    const { container } = render(<NoveltyGridCard product={product} />);
    const cls = getArticle(container).className;
    expect(cls).toMatch(/min-h-\[420px\]/);
  });

  it('aplica min-h-[420px] também com skeleton de preço/estoque', () => {
    const { container } = render(<NoveltyGridCard product={product} isPriceStockLoading />);
    const cls = getArticle(container).className;
    expect(cls).toMatch(/min-h-\[420px\]/);
  });

  it('NÃO usa overflow-hidden — conteúdo precisa ser visível para medição do virtualizer', () => {
    const { container } = render(<NoveltyGridCard product={product} />);
    const cls = getArticle(container).className;
    expect(cls).not.toMatch(/\boverflow-hidden\b/);
  });
});
