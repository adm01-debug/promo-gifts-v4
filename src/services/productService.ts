import { fetchPromobrindProducts, fetchPromobrindProductById } from '@/lib/external-db';
import { mapPromobrindToProduct } from '@/utils/product-mapper';
import { Product, ProductFilters } from '@/types/product-catalog';

export const productService = {
  async fetchProducts(filters?: ProductFilters) {
    const products = await fetchPromobrindProducts({
      search: filters?.search,
      limit: filters?.limit,
    });

    let result = products.map(mapPromobrindToProduct);

    if (filters?.category) {
      result = result.filter(p =>
        p.category_name?.toLowerCase().includes(filters.category!.toLowerCase()) ||
        p.category_id === filters.category
      );
    }
    
    if (filters?.minPrice !== undefined) {
      result = result.filter(p => p.price >= filters.minPrice!);
    }
    
    if (filters?.maxPrice !== undefined) {
      result = result.filter(p => p.price <= filters.maxPrice!);
    }
    
    if (filters?.inStock) {
      result = result.filter(p => (p.stock || 0) > 0);
    }

    return result;
  },

  async fetchProductById(id: string) {
    const product = await fetchPromobrindProductById(id);
    return product ? mapPromobrindToProduct(product) : null;
  },

  async fetchRelatedProducts(product: Product, limit = 20) {
    const supplierId = product?.supplier?.id;
    const categoryId = product?.category_id;
    const productId = product?.id;

    const filters: Record<string, unknown> = {};
    if (supplierId && supplierId !== 'unknown') {
      filters.supplier_id = supplierId;
    } else if (categoryId) {
      filters.main_category_id = categoryId;
    }

    const raw = await fetchPromobrindProducts({
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      limit: limit + 1,
      orderBy: { column: 'name', ascending: true },
    });

    return raw
      .map(mapPromobrindToProduct)
      .filter(p => p.id !== productId)
      .slice(0, limit);
  }
};
