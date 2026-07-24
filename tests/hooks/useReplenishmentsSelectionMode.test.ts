/**
 * Unit tests for replenishmentToProduct mapping.
 */
import { describe, it, expect, vi } from 'vitest';
import { replenishmentToProduct } from '@/hooks/products/useReplenishmentsSelectionMode';
import type { ReplenishmentWithDetails } from '@/hooks/useReplenishments';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const mockReplenishment: ReplenishmentWithDetails = {
  replenishment_id: 'rep-1',
  product_id: 'prod-1',
  product_sku: 'SKU-001',
  product_name: 'Test Product',
  product_description: 'A test product',
  base_price: 29.99,
  product_image: 'https://example.com/img.jpg',
  category_id: 'cat-1',
  category_name: 'Electronics',
  supplier_code: 'SUP-01',
  supplier_id: 'sup-1',
  supplier_name: 'Test Supplier',
  supplier_product_code: 'SP-001',
  replenished_at: '2026-04-10T10:00:00Z',
  created_at: '2026-03-01T10:00:00Z',
  expires_at: '2026-05-10T10:00:00Z',
  days_remaining: 28,
  days_since: 2,
  status: 'active',
  is_highlighted: true,
  is_active: true,
  stock_quantity: 100,
  min_quantity: 10,
  stock_status: 'in-stock',
};

describe('replenishmentToProduct', () => {
  it('maps replenishment fields to Product type correctly', () => {
    const product = replenishmentToProduct(mockReplenishment);

    expect(product.id).toBe('prod-1');
    expect(product.name).toBe('Test Product');
    expect(product.price).toBe(29.99);
    expect(product.sku).toBe('SKU-001');
    expect(product.image_url).toBe('https://example.com/img.jpg');
    expect(product.images).toEqual(['https://example.com/img.jpg']);
    expect(product.category_id).toBe('cat-1');
    expect(product.category_name).toBe('Electronics');
    expect(product.supplier?.id).toBe('sup-1');
    expect(product.supplier?.name).toBe('Test Supplier');
    expect(product.featured).toBe(true);
    expect(product.supplier_reference).toBe('SP-001');
  });

  it('handles null/missing image', () => {
    const rep = { ...mockReplenishment, product_image: null };
    const product = replenishmentToProduct(rep);

    expect(product.image_url).toBeUndefined();
    expect(product.images).toEqual([]);
  });

  it('handles null price by defaulting to 0', () => {
    const rep = { ...mockReplenishment, base_price: null };
    const product = replenishmentToProduct(rep);

    expect(product.price).toBe(0);
  });

  it('handles null category and supplier', () => {
    const rep = {
      ...mockReplenishment,
      category_id: null,
      category_name: null,
      supplier_id: null,
      supplier_name: null,
    };
    const product = replenishmentToProduct(rep);

    expect(product.category?.id).toBe('');
    expect(product.supplier?.id).toBe('');
  });

  // Regressão: o converter hardcodava stock:0 / stockStatus:'in-stock',
  // fazendo a list-view mostrar "0 Unid · Em estoque" e liberar add-to-cart
  // de itens esgotados. Deve refletir o estoque REAL da reposição.
  it('propagates real stock quantity and status (in-stock)', () => {
    const product = replenishmentToProduct(mockReplenishment);
    expect(product.stock).toBe(100);
    expect(product.stockStatus).toBe('in-stock');
  });

  it('propagates out-of-stock status instead of forcing in-stock', () => {
    const rep = {
      ...mockReplenishment,
      stock_quantity: 0,
      stock_status: 'out-of-stock' as const,
    };
    const product = replenishmentToProduct(rep);
    expect(product.stock).toBe(0);
    expect(product.stockStatus).toBe('out-of-stock');
  });

  it('propagates low-stock status', () => {
    const rep = {
      ...mockReplenishment,
      stock_quantity: 3,
      stock_status: 'low-stock' as const,
    };
    const product = replenishmentToProduct(rep);
    expect(product.stock).toBe(3);
    expect(product.stockStatus).toBe('low-stock');
  });
});
