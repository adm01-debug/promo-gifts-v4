import { describe, it, expect, vi } from 'vitest';
import { productService } from '@/services/productService';
import { fetchPromobrindProducts } from '@/lib/external-db';

vi.mock('@/lib/external-db', () => ({
  fetchPromobrindProducts: vi.fn(() => Promise.resolve([])),
  fetchPromobrindProductById: vi.fn(),
}));


describe('Catalog Integration - Sort Contracts', () => {
  it('maps "price-asc" to sale_price ascending', async () => {
    await productService.fetchProducts({ sortBy: 'price-asc' });
    expect(fetchPromobrindProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { column: 'sale_price', ascending: true }
      })
    );
  });

  it('maps "price-desc" to sale_price descending', async () => {
    await productService.fetchProducts({ sortBy: 'price-desc' });
    expect(fetchPromobrindProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { column: 'sale_price', ascending: false }
      })
    );
  });

  it('maps "newest" to created_at descending', async () => {
    await productService.fetchProducts({ sortBy: 'newest' });
    expect(fetchPromobrindProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { column: 'created_at', ascending: false }
      })
    );
  });

  it('maps "stock" to stock_quantity descending', async () => {
    await productService.fetchProducts({ sortBy: 'stock' });
    expect(fetchPromobrindProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { column: 'stock_quantity', ascending: false }
      })
    );
  });

  it('maps "best-seller-supplier" to is_bestseller descending', async () => {
    await productService.fetchProducts({ sortBy: 'best-seller-supplier' });
    expect(fetchPromobrindProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { column: 'is_bestseller', ascending: false }
      })
    );
  });

  it('maps "best-seller-promo" to is_featured descending', async () => {
    await productService.fetchProducts({ sortBy: 'best-seller-promo' });
    expect(fetchPromobrindProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { column: 'is_featured', ascending: false }
      })
    );
  });

  it('defaults to "name" ascending for unknown sort values', async () => {
    await productService.fetchProducts({ sortBy: 'invalid-value' });
    expect(fetchPromobrindProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { column: 'name', ascending: true }
      })
    );
  });
});
