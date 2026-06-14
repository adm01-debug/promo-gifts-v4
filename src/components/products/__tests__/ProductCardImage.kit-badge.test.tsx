/**
 * Valida que o badge "Kit" renderiza no card do catálogo quando product.isKit=true.
 *
 * Caminho exercitado:
 *   DB.is_kit=true → mapLightweightToProduct → product.isKit=true →
 *   ProductCardImage → <ProductStatusBadge type="kit"> → texto "Kit" no DOM.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ProductCardImage } from '@/components/products/ProductCardImage';
import { mapLightweightToProduct } from '@/hooks/products/useProductsLightweight';
import type { LightweightProduct } from '@/lib/external-db/products-lightweight';

vi.mock('@/hooks/ui/useReducedMotion', () => ({ useReducedMotion: () => true }));
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ actualTheme: 'light' }),
}));
vi.mock('@/stores/useBadgeVisibilityStore', () => ({
  useBadgeVisibilityStore: (sel: (s: unknown) => unknown) =>
    sel({ routeSettings: {}, badgesEnabled: true }),
}));

const base: LightweightProduct = {
  id: 'kit-1',
  name: 'Kit Executivo',
  sku: 'KIT-1',
  supplier_reference: null,
  sale_price: 100,
  cost_price: 80,
  image_url: null,
  primary_image_url: null,
  set_image_url: null,
  supplier_id: null,
  category_id: null,
  main_category_id: null,
  brand: null,
  is_active: true,
  active: true,
  stock_quantity: 10,
  min_quantity: 1,
  is_kit: true,
  is_new: false,
  created_at: '2020-01-01T00:00:00.000Z',
  gender: null,
  short_description: null,
};

const Wrap = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>
    <TooltipProvider>{children}</TooltipProvider>
  </MemoryRouter>
);

describe('ProductCardImage — badge Kit', () => {
  it('renderiza "Kit" quando is_kit=true no BD', () => {
    const product = mapLightweightToProduct(base);
    expect(product.isKit).toBe(true);

    render(
      <Wrap>
        <ProductCardImage product={product} />
      </Wrap>,
    );

    expect(screen.getByText('Kit')).toBeDefined();
  });

  it('NÃO renderiza "Kit" quando is_kit=false', () => {
    const product = mapLightweightToProduct({ ...base, is_kit: false });
    expect(product.isKit).toBe(false);

    render(
      <Wrap>
        <ProductCardImage product={product} />
      </Wrap>,
    );

    expect(screen.queryByText('Kit')).toBeNull();
  });
});
