/**
 * NoveltyGridCard — contrato de ALTURA FIXA (paridade com BaseProductGridCard).
 *
 * Histórico: o card de Novidades já oscilou entre altura flexível (`min-h-[420px]`)
 * e fixa. A decisão canônica (PR#1078, "fix novelties 40 bugs") alinhou o card ao
 * BaseProductGridCard do catálogo —
 *   `h-[400px] max-h-[400px] sm:h-[430px] sm:max-h-[430px] overflow-hidden`
 * — garantindo uniformidade visual entre Catálogo, Reposição e Novidades. Antes
 * deste teste existia `NoveltyGridCard.flexibleHeight.test.tsx`, que travava o
 * contrato ANTIGO (flexível) e passou a falhar quando o card foi alinhado ao
 * padrão canônico. Substituído por este, que trava o contrato ATUAL.
 *
 * Por que `overflow-hidden` é seguro com o virtualizer: o VirtualizedNoveltyGrid
 * mede a ALTURA DA LINHA (`measureElement` na div da row), determinística porque
 * os cards têm altura fixa — o clip interno do card não afeta a medição/scroll.
 *
 * Se o BaseProductGridCard mudar a estratégia de altura, este card deve acompanhar
 * (e este teste, ser atualizado junto).
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
  'Produto com um nome extremamente longo que ocupa várias linhas — o overflow-hidden + altura fixa é intencional (paridade com o card canônico do catálogo)';

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
  const el = container.querySelector('[data-testid="novelty-grid-card"]');
  if (!el) throw new Error('article não encontrado');
  return el as HTMLElement;
}

describe('NoveltyGridCard › altura fixa (paridade BaseProductGridCard)', () => {
  it('aplica altura fixa 400px (mobile) e 430px (≥sm), com max-h correspondente', () => {
    const { container } = render(<NoveltyGridCard product={product} />);
    const cls = getArticle(container).className;
    // `(^|\s)h-\[400px\]` distingue `h-[400px]` de `max-h-[400px]` (precedido por "-").
    expect(cls).toMatch(/(^|\s)h-\[400px\]/);
    expect(cls).toMatch(/(^|\s)max-h-\[400px\]/);
    expect(cls).toMatch(/(^|\s)sm:h-\[430px\]/);
    expect(cls).toMatch(/(^|\s)sm:max-h-\[430px\]/);
  });

  it('usa overflow-hidden (clip seguro: o virtualizer mede a row, não o card)', () => {
    const { container } = render(<NoveltyGridCard product={product} />);
    expect(getArticle(container).className).toMatch(/(^|\s)overflow-hidden/);
  });

  it('mantém a altura fixa também no estado de loading de preço/estoque', () => {
    const { container } = render(<NoveltyGridCard product={product} isPriceStockLoading />);
    const cls = getArticle(container).className;
    expect(cls).toMatch(/(^|\s)h-\[400px\]/);
    expect(cls).toMatch(/(^|\s)sm:h-\[430px\]/);
  });
});
