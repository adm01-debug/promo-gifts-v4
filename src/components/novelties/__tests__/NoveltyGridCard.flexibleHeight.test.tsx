/**
 * Garante que o card de Novidades NÃO usa altura fixa (`h-[420px]`) nem
 * `max-h-*`, de modo que conteúdo longo + skeleton de preço/estoque
 * não sejam recortados — o que invalida a medição do virtualizer e
 * quebra o scroll do módulo /novidades.
 *
 * Cobre o regressivo introduzido pelo fix "min-h-[420px] only".
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

describe('NoveltyGridCard › altura flexível (sem max-h / h fixo)', () => {
  it('não aplica max-h-* nem h-[420px] no estado normal com nome longo', () => {
    const { container } = render(<NoveltyGridCard product={product} />);
    const cls = getArticle(container).className;
    expect(cls).toMatch(/min-h-\[420px\]/);
    expect(cls).not.toMatch(/(^|\s)max-h-/);
    expect(cls).not.toMatch(/(^|\s)h-\[420px\]/);
    expect(cls).not.toMatch(/(^|\s)h-\[\d+px\]/);
  });

  it('mantém min-h-[420px] (sem h/max-h fixo) também com skeleton de preço/estoque', () => {
    const { container } = render(<NoveltyGridCard product={product} isPriceStockLoading />);
    const cls = getArticle(container).className;
    expect(cls).toMatch(/min-h-\[420px\]/);
    expect(cls).not.toMatch(/(^|\s)max-h-/);
    expect(cls).not.toMatch(/(^|\s)h-\[\d+px\]/);
  });

  it('não usa overflow-hidden no article (que recortaria conteúdo e quebraria measureElement)', () => {
    const { container } = render(<NoveltyGridCard product={product} />);
    const cls = getArticle(container).className;
    expect(cls).not.toMatch(/(^|\s)overflow-hidden/);
  });
});
