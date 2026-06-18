import { describe, it, expect, vi, beforeEach } from 'vitest';
import { productService } from '@/services/productService';
import * as externalDb from '@/lib/external-db';

vi.mock('@/lib/external-db', () => ({
  fetchPromobrindProducts: vi.fn(),
  fetchPromobrindProductById: vi.fn(),
  getProductImageUrl: vi.fn((p) => `http://example.com/${p.sku}.jpg`),
  getProductStock: vi.fn((p) => p.stock ?? 0),
  getProductPrice: vi.fn((p) => p.price || 0),
}));

describe('productService', () => {
  const fetchPromobrindProductsMock = vi.mocked(externalDb.fetchPromobrindProducts);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch and map products correctly', async () => {
    const mockRawProduct = {
      id: '123',
      name: 'Test Product',
      price: 10.5,
      sku: 'SKU123',
      stock: 100,
    };

    fetchPromobrindProductsMock.mockResolvedValue([mockRawProduct] as unknown as Awaited<
      ReturnType<typeof externalDb.fetchPromobrindProducts>
    >);

    const products = await productService.fetchProducts();

    expect(products).toHaveLength(1);
    expect(products[0].id).toBe('123');
    expect(products[0].name).toBe('Test Product');
    expect(externalDb.fetchPromobrindProducts).toHaveBeenCalled();
  });

  it('should apply search filter', async () => {
    await productService.fetchProducts({ search: 'caneca' });
    expect(externalDb.fetchPromobrindProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'caneca',
      }),
    );
  });

  it('should filter results client-side (category, price, stock)', async () => {
    const mockProducts = [
      { id: '1', name: 'A', price: 10, category_name: 'Tech', stock: 10 },
      { id: '2', name: 'B', price: 50, category_name: 'Office', stock: 0 },
    ];
    fetchPromobrindProductsMock.mockResolvedValue(
      mockProducts as unknown as Awaited<ReturnType<typeof externalDb.fetchPromobrindProducts>>,
    );

    // Filter by price
    let result = await productService.fetchProducts({ minPrice: 20 });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');

    // Filter by stock
    result = await productService.fetchProducts({ inStock: true });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('should ignore invalid price bounds instead of filtering out products', async () => {
    const mockProducts = [
      { id: '1', name: 'A', price: 10, category_name: 'Tech', stock: 10 },
      { id: '2', name: 'B', price: 50, category_name: 'Office', stock: 0 },
    ];
    fetchPromobrindProductsMock.mockResolvedValue(
      mockProducts as unknown as Awaited<ReturnType<typeof externalDb.fetchPromobrindProducts>>,
    );

    const result = await productService.fetchProducts({
      minPrice: Number.NaN,
      maxPrice: Number.POSITIVE_INFINITY,
    });

    expect(result.map((product) => product.id)).toEqual(['1', '2']);
  });
});
